import { createElement, setupDismissListeners } from '../../Shared/Utils/DomUtils.js';
import { collapseWhitespace } from '../../Shared/Utils/StringUtils.js';
import { attachCustomScrollbar } from '../../Shared/CustomScrollbar/CustomScrollbar.js';
import { createProviderIcon } from '../../Shared/Icons/Icons.js';
import { createSearchBar } from '../../Shared/SearchBar/SearchBar.js';
import {
  orderProvidersBySelection,
  providerIsConfigured,
} from '../../Shared/ProviderCatalog/ProviderUtils.js';
import {
  formatPrice,
  formatTokenCount,
  hasModelInfo,
  resolveContextWindow,
  resolveMaxOutput,
} from '../../Shared/Utils/ModelInfoUtils.js';

// ── Provider/model preference helpers ────────────────────────────────────

export function getPreferredProvider(payload) {
  const ordered = orderProvidersBySelection(payload.user, payload.providers);

  return (
    ordered.find((provider) => {
      const details = payload.user?.providers?.details?.[provider.id] ?? {};
      return providerIsConfigured(provider, details);
    }) ??
    ordered.find((provider) => provider.models?.length > 0) ??
    payload.providers[0] ??
    null
  );
}

// ── Info button SVG ───────────────────────────────────────────────────────

function createInfoButtonIcon() {
  const wrap = createElement('span', 'chat-model-picker__info-icon');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const border = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  border.setAttribute('cx', '8');
  border.setAttribute('cy', '8');
  border.setAttribute('r', '6.5');
  border.setAttribute('stroke', 'currentColor');
  border.setAttribute('stroke-width', '1.25');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', 'M8 7v5');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-linecap', 'round');

  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', '8');
  dot.setAttribute('cy', '4.5');
  dot.setAttribute('r', '0.8');
  dot.setAttribute('fill', 'currentColor');

  svg.append(border, line, dot);
  wrap.append(svg);
  return wrap;
}

// ── Model info popover ────────────────────────────────────────────────────
// A single shared popover instance re-populated for each model on demand.

function createModelInfoPopover() {
  const panel = createElement('div', 'chat-model-info-popover');
  document.body.append(panel);

  let activeProviderId = null;
  let activeModelId = null;
  let disposeListeners = null;

  function buildContent(provider, model, strings) {
    panel.replaceChildren();

    // ── Header: provider icon + model name ────────────────────────────────
    const header = createElement('div', 'chat-model-info-popover__header');
    if (provider.iconPath) {
      const img = createProviderIcon(provider.iconPath, {
        className: 'chat-model-info-popover__provider-icon',
      });
      header.append(img);
    }
    header.append(createElement('span', 'chat-model-info-popover__title', model.name ?? model.id));
    panel.append(header);

    // ── Description ───────────────────────────────────────────────────────
    if (model.description) {
      panel.append(createElement('p', 'chat-model-info-popover__desc', model.description));
    }

    // ── Context window + max output rows ──────────────────────────────────
    const rows = createElement('div', 'chat-model-info-popover__rows');

    const contextWindow = resolveContextWindow(model);
    if (contextWindow) {
      const row = createElement('div', 'chat-model-info-popover__row');
      row.append(
        createElement(
          'span',
          'chat-model-info-popover__row-label',
          strings.modelInfo.contextWindow,
        ),
        createElement(
          'span',
          'chat-model-info-popover__row-value',
          `${formatTokenCount(contextWindow)} tokens`,
        ),
      );
      rows.append(row);
    }

    const maxOutput = resolveMaxOutput(model);
    if (maxOutput) {
      const row = createElement('div', 'chat-model-info-popover__row');
      row.append(
        createElement('span', 'chat-model-info-popover__row-label', strings.modelInfo.maxOutput),
        createElement(
          'span',
          'chat-model-info-popover__row-value',
          `${formatTokenCount(maxOutput)} tokens`,
        ),
      );
      rows.append(row);
    }

    if (rows.children.length > 0) panel.append(rows);

    // ── Pricing block ─────────────────────────────────────────────────────
    if (model.pricing) {
      const pricingWrap = createElement('div', 'chat-model-info-popover__pricing-wrap');
      pricingWrap.append(
        createElement('span', 'chat-model-info-popover__section-label', strings.modelInfo.pricing),
      );
      const grid = createElement('div', 'chat-model-info-popover__pricing-grid');

      const inputItem = createElement('div', 'chat-model-info-popover__pricing-item');
      inputItem.append(
        createElement(
          'span',
          'chat-model-info-popover__pricing-kind',
          strings.modelInfo.inputPrice,
        ),
        createElement(
          'span',
          'chat-model-info-popover__pricing-amount',
          `${formatPrice(model.pricing.input)}${strings.modelInfo.perMillion}`,
        ),
      );

      const outputItem = createElement('div', 'chat-model-info-popover__pricing-item');
      outputItem.append(
        createElement(
          'span',
          'chat-model-info-popover__pricing-kind',
          strings.modelInfo.outputPrice,
        ),
        createElement(
          'span',
          'chat-model-info-popover__pricing-amount',
          `${formatPrice(model.pricing.output)}${strings.modelInfo.perMillion}`,
        ),
      );

      grid.append(inputItem, outputItem);
      pricingWrap.append(grid);
      panel.append(pricingWrap);
    }

    // ── Capability chips: supported input types + thinking ─────────────────
    const inputsObj = model.inputs ?? {};
    const caps = [];
    if (inputsObj.text) caps.push(strings.modelInfo.supportsText);
    if (inputsObj.image) caps.push(strings.modelInfo.supportsImage);
    if (inputsObj.pdf) caps.push(strings.modelInfo.supportsPdf);
    if (inputsObj.docx) caps.push(strings.modelInfo.supportsDocx);
    if (model.thinking) caps.push(strings.modelInfo.thinking);

    if (caps.length > 0) {
      const capsRow = createElement('div', 'chat-model-info-popover__caps');
      for (const cap of caps) {
        capsRow.append(createElement('span', 'chat-model-info-popover__cap', cap));
      }
      panel.append(capsRow);
    }
  }

  function positionPanel(triggerEl, pickerEl) {
    const triggerRect = triggerEl.getBoundingClientRect();
    const pickerRect = pickerEl ? pickerEl.getBoundingClientRect() : null;
    const margin = 10;

    const popoverW = panel.offsetWidth || 260;
    const popoverH = panel.offsetHeight || 180;

    // Prefer right of picker, fall back to left
    const rightAnchor = pickerRect ? pickerRect.right : triggerRect.right;
    let left;
    if (window.innerWidth - rightAnchor - margin >= popoverW) {
      left = rightAnchor + margin;
    } else {
      const leftAnchor = pickerRect ? pickerRect.left : triggerRect.left;
      left = Math.max(margin, leftAnchor - popoverW - margin);
    }

    // Align top with trigger row, clamped inside viewport
    let top = triggerRect.top;
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverH - margin));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function open(provider, model, triggerEl, pickerEl, strings) {
    activeProviderId = provider.id;
    activeModelId = model.id;

    buildContent(provider, model, strings);

    // Snap to off-screen with no transition so any previous close animation
    // is instantly killed — inline styles are cleared in the second rAF so
    // the CSS class rules take over cleanly.
    panel.style.cssText =
      'transition:none; opacity:0; transform:translateX(-6px) scale(0.97); visibility:hidden; left:-9999px; top:-9999px;';
    panel.classList.remove('chat-model-info-popover--open');

    // Double-rAF: first frame lets the browser commit the hard-reset above;
    // second frame clears ALL inline overrides so the CSS class drives
    // opacity/transform, then we position and reveal.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        positionPanel(triggerEl, pickerEl);
        // Clear every inline override — the --open class now controls opacity
        // and transform without anything fighting it.
        panel.style.cssText = `left:${panel.style.left}; top:${panel.style.top};`;
        panel.classList.add('chat-model-info-popover--open');
      });
    });

    // Register dismiss listeners after a tick so the opening click doesn't
    // immediately close the panel.
    disposeListeners?.();

    const onDocClick = (event) => {
      if (!panel.contains(event.target) && !triggerEl.contains(event.target)) {
        close();
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };

    disposeListeners = setupDismissListeners(onDocClick, onKey);
  }

  function close() {
    activeProviderId = null;
    activeModelId = null;
    panel.classList.remove('chat-model-info-popover--open');
    disposeListeners?.();
    disposeListeners = null;
  }

  function isOpenFor(providerId, modelId) {
    return activeProviderId === providerId && activeModelId === modelId;
  }

  function dispose() {
    close();
    panel.remove();
  }

  return { open, close, isOpenFor, dispose };
}

// ── Main panel factory ────────────────────────────────────────────────────

export function createModelPickerPanel({ providers, userProviderDetails, strings, onSelect }) {
  const panel = createElement('div', 'chat-model-picker');
  document.body.append(panel);

  // ── Search bar (fixed above the scroll area) ──────────────────────────
  const searchWrap = createElement('div', 'chat-model-picker__search');
  const search = createSearchBar({
    placeholder: 'Search models…',
    onChange: (query) => filterGroups(query),
  });
  searchWrap.append(search.element);
  panel.append(searchWrap);

  const scroller = createElement('div', 'chat-model-picker__scroller');
  panel.append(scroller);

  // ── Shared info popover ───────────────────────────────────────────────
  const infoPopover = createModelInfoPopover();

  // ── Provider groups ───────────────────────────────────────────────────
  const readyProviders = providers.filter((provider) => {
    if (!provider.models?.length) return false;
    const details = userProviderDetails?.[provider.id] ?? {};
    const endpoint = collapseWhitespace(details.endpoint) || collapseWhitespace(provider.endpoint);
    if (!endpoint) return false;
    if (provider.requiresApiKey && !collapseWhitespace(details.apiKey)) return false;
    return true;
  });

  const groups = [];

  for (const provider of readyProviders) {
    const group = createElement('div', 'chat-model-picker__group');
    group.append(createElement('div', 'chat-model-picker__group-header', provider.label));

    const modelEntries = [];

    for (const model of provider.models) {
      const option = createElement('button', 'chat-model-picker__option');
      option.type = 'button';
      option._pickerProviderId = provider.id;
      option._pickerModelId = model.id;

      // Provider icon
      if (provider.iconPath) {
        option.append(
          createProviderIcon(provider.iconPath, {
            className: 'chat-model-picker__option-provider-icon',
            alt: provider.label ?? '',
          }),
        );
      }

      // Model name label
      const label = createElement(
        'span',
        'chat-model-picker__option-label',
        model.name ?? model.id,
      );
      option.append(label);

      // Info button — only when this model has metadata worth showing
      if (hasModelInfo(model)) {
        const infoBtn = createElement('button', 'chat-model-picker__info-btn');
        infoBtn.type = 'button';
        infoBtn.setAttribute('aria-label', strings.modelInfo.infoButton);
        infoBtn.append(createInfoButtonIcon());

        infoBtn.addEventListener('click', (event) => {
          event.stopPropagation();

          if (infoPopover.isOpenFor(provider.id, model.id)) {
            infoPopover.close();
            infoBtn.classList.remove('chat-model-picker__info-btn--active');
            return;
          }

          // Close any other active info button highlight
          panel
            .querySelectorAll('.chat-model-picker__info-btn--active')
            .forEach((btn) => btn.classList.remove('chat-model-picker__info-btn--active'));

          infoBtn.classList.add('chat-model-picker__info-btn--active');
          infoPopover.open(provider, model, infoBtn, panel, strings);
        });

        option.append(infoBtn);
      }

      option.addEventListener('click', (event) => {
        event.stopPropagation();
        infoPopover.close();
        panel
          .querySelectorAll('.chat-model-picker__info-btn--active')
          .forEach((btn) => btn.classList.remove('chat-model-picker__info-btn--active'));
        onSelect(provider, model);
      });

      group.append(option);
      modelEntries.push({
        option,
        searchText: `${model.name ?? model.id} ${provider.label}`.toLowerCase(),
      });
    }

    scroller.append(group);
    groups.push({ group, modelEntries });
  }

  // ── Empty state ───────────────────────────────────────────────────────
  const emptyEl = createElement('div', 'chat-model-picker__empty', 'No models match');
  emptyEl.hidden = true;
  scroller.append(emptyEl);

  // ── Filter function ───────────────────────────────────────────────────
  function filterGroups(query) {
    const q = query.trim().toLowerCase();
    let anyVisible = false;

    for (const { group, modelEntries } of groups) {
      let groupHasMatch = false;
      for (const { option, searchText } of modelEntries) {
        const visible = !q || searchText.includes(q);
        option.hidden = !visible;
        if (visible) groupHasMatch = true;
      }
      group.hidden = !groupHasMatch;
      if (groupHasMatch) anyVisible = true;
    }

    emptyEl.hidden = anyVisible || !q;
  }

  // ── Auto-focus search + close info popover when picker reopens ────────
  const observer = new MutationObserver(() => {
    if (panel.classList.contains('chat-model-picker--open')) {
      search.clear();
      filterGroups('');
      requestAnimationFrame(() => {
        search.focus();
        // The scroller was hidden (opacity:0 / pointer-events:none) so the
        // ResizeObserver may not have fired while it was closed. Force the
        // custom scrollbar to recalculate now that the picker is visible.
        scrollbar.update();
      });
    } else {
      infoPopover.close();
      panel
        .querySelectorAll('.chat-model-picker__info-btn--active')
        .forEach((btn) => btn.classList.remove('chat-model-picker__info-btn--active'));
    }
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });

  const scrollbar = attachCustomScrollbar(panel, scroller);

  return {
    element: panel,
    hide() {
      // Just visually close — keeps all listeners, scrollbar, and popover alive
      // so the panel can be reopened without rebuilding.
      infoPopover.close();
      panel
        .querySelectorAll('.chat-model-picker__info-btn--active')
        .forEach((btn) => btn.classList.remove('chat-model-picker__info-btn--active'));
    },
    dispose() {
      observer.disconnect();
      scrollbar.dispose();
      infoPopover.dispose();
    },
  };
}
