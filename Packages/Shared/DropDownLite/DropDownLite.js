import { createElement, setupDismissListeners } from '../Utils/DomUtils.js';
import { createPortalDropdownController } from '../Bubbly/DropDown/PortalDropdown.js';
import { createProviderIcon } from '../Icons/Icons.js';
import {
  formatPrice,
  formatTokenCount,
  hasModelInfo,
  resolveContextWindow,
  resolveMaxOutput,
} from '../Utils/ModelInfoUtils.js';

function createInfoIcon() {
  const wrap = createElement('span', 'joanium-ddm-lite__info-icon');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '8');
  circle.setAttribute('cy', '8');
  circle.setAttribute('r', '6.5');
  circle.setAttribute('stroke', 'currentColor');
  circle.setAttribute('stroke-width', '1.25');
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
  svg.append(circle, line, dot);
  wrap.append(svg);
  return wrap;
}

function createModelInfoPopoverDdm() {
  const pop = createElement('div', 'chat-model-info-popover');
  document.body.append(pop);
  let activeValue = null;
  let disposeListeners = null;

  function build(provider, model) {
    pop.replaceChildren();
    // Header
    const header = createElement('div', 'chat-model-info-popover__header');
    if (provider?.iconPath) {
      const img = createProviderIcon(provider.iconPath, {
        className: 'chat-model-info-popover__provider-icon',
      });
      header.append(img);
    }
    header.append(createElement('span', 'chat-model-info-popover__title', model.name ?? model.id));
    pop.append(header);
    // Description
    if (model.description)
      pop.append(createElement('p', 'chat-model-info-popover__desc', model.description));
    // Context + max output
    const rows = createElement('div', 'chat-model-info-popover__rows');
    const ctx = resolveContextWindow(model);
    if (ctx) {
      const r = createElement('div', 'chat-model-info-popover__row');
      r.append(
        createElement('span', 'chat-model-info-popover__row-label', 'Context'),
        createElement(
          'span',
          'chat-model-info-popover__row-value',
          `${formatTokenCount(ctx)} tokens`,
        ),
      );
      rows.append(r);
    }
    const mo = resolveMaxOutput(model);
    if (mo) {
      const r = createElement('div', 'chat-model-info-popover__row');
      r.append(
        createElement('span', 'chat-model-info-popover__row-label', 'Max output'),
        createElement(
          'span',
          'chat-model-info-popover__row-value',
          `${formatTokenCount(mo)} tokens`,
        ),
      );
      rows.append(r);
    }
    if (rows.children.length) pop.append(rows);
    // Pricing
    if (model.pricing) {
      const wrap = createElement('div', 'chat-model-info-popover__pricing-wrap');
      wrap.append(createElement('span', 'chat-model-info-popover__section-label', 'Pricing'));
      const grid = createElement('div', 'chat-model-info-popover__pricing-grid');
      const inp = createElement('div', 'chat-model-info-popover__pricing-item');
      inp.append(
        createElement('span', 'chat-model-info-popover__pricing-kind', 'Input'),
        createElement(
          'span',
          'chat-model-info-popover__pricing-amount',
          `${formatPrice(model.pricing.input)}/1M tokens`,
        ),
      );
      const out = createElement('div', 'chat-model-info-popover__pricing-item');
      out.append(
        createElement('span', 'chat-model-info-popover__pricing-kind', 'Output'),
        createElement(
          'span',
          'chat-model-info-popover__pricing-amount',
          `${formatPrice(model.pricing.output)}/1M tokens`,
        ),
      );
      grid.append(inp, out);
      wrap.append(grid);
      pop.append(wrap);
    }
    // Capability chips
    const inputs = model.inputs ?? {};
    const caps = [];
    if (inputs.text) caps.push('Text');
    if (inputs.image) caps.push('Images');
    if (inputs.pdf) caps.push('PDF');
    if (inputs.docx) caps.push('Documents');
    if (model.thinking) caps.push('Extended thinking');
    if (caps.length) {
      const row = createElement('div', 'chat-model-info-popover__caps');
      for (const c of caps) row.append(createElement('span', 'chat-model-info-popover__cap', c));
      pop.append(row);
    }
  }

  function position(triggerEl, panelEl) {
    const tRect = triggerEl.getBoundingClientRect();
    const pRect = panelEl?.getBoundingClientRect();
    const margin = 10;
    const popW = pop.offsetWidth || 260;
    const popH = pop.offsetHeight || 180;
    const rightAnchor = pRect ? pRect.right : tRect.right;
    let left;
    if (window.innerWidth - rightAnchor - margin >= popW) {
      left = rightAnchor + margin;
    } else {
      left = Math.max(margin, (pRect ? pRect.left : tRect.left) - popW - margin);
    }
    let top = Math.max(margin, Math.min(tRect.top, window.innerHeight - popH - margin));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function open(value, provider, model, triggerEl, panelEl) {
    activeValue = value;
    build(provider, model);
    pop.style.cssText =
      'transition:none; opacity:0; transform:translateX(-6px) scale(0.97); visibility:hidden; left:-9999px; top:-9999px;';
    pop.classList.remove('chat-model-info-popover--open');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        position(triggerEl, panelEl);
        pop.style.cssText = `left:${pop.style.left}; top:${pop.style.top};`;
        pop.classList.add('chat-model-info-popover--open');
      });
    });
    disposeListeners?.();
    const onDocClick = (e) => {
      if (!pop.contains(e.target) && !triggerEl.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    disposeListeners = setupDismissListeners(onDocClick, onKey);
  }

  function close() {
    activeValue = null;
    pop.classList.remove('chat-model-info-popover--open');
    disposeListeners?.();
    disposeListeners = null;
  }

  function isOpenFor(value) {
    return activeValue === value;
  }

  function dispose() {
    close();
    pop.remove();
  }

  return { open, close, isOpenFor, dispose };
}

// ── createDropDownLite ─────────────────────────────────────────────────────
// A compact, inline-friendly dropdown built for settings panels and tight
// layouts. The option panel is portalled to document.body so it is never
// clipped by ancestor overflow or stacking contexts.
//
// Options shape: [{ value: string, label: string }]
//
// Returns: { element, getValue(), setValue(value), dispose() }

export function createDropDownLite({
  label = '',
  options = [],
  value = '',
  placeholder = 'Select',
  searchable = false,
  searchPlaceholder = 'Search…',
  onChange,
  onToggleFavourite,
} = {}) {
  let currentValue = value;
  let searchQuery = '';
  let dropdownController = null;
  const infoPopover = createModelInfoPopoverDdm();

  // ── Wrapper ──────────────────────────────────────────────────────────────

  const wrapper = createElement('div', 'joanium-ddm-lite');

  if (label) {
    wrapper.append(createElement('span', 'joanium-ddm-lite__label', label));
  }

  // ── Trigger ──────────────────────────────────────────────────────────────

  const trigger = createElement('button', 'joanium-ddm-lite__trigger');
  trigger.type = 'button';
  const triggerText = createElement('span', 'joanium-ddm-lite__trigger-text');

  const chevronSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevronSvg.setAttribute('class', 'joanium-ddm-lite__chevron');
  chevronSvg.setAttribute('viewBox', '0 0 16 16');
  chevronSvg.setAttribute('fill', 'none');
  chevronSvg.setAttribute('aria-hidden', 'true');
  const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevronPath.setAttribute('d', 'M3 5.5L8 10.5L13 5.5');
  chevronPath.setAttribute('stroke', 'currentColor');
  chevronPath.setAttribute('stroke-width', '1.75');
  chevronPath.setAttribute('stroke-linecap', 'round');
  chevronPath.setAttribute('stroke-linejoin', 'round');
  chevronSvg.append(chevronPath);

  trigger.append(triggerText, chevronSvg);
  wrapper.append(trigger);

  // ── Panel (portalled to body) ─────────────────────────────────────────────

  const panel = createElement('div', 'joanium-ddm-lite__panel');
  panel.setAttribute('role', 'listbox');
  document.body.append(panel);

  // ── In-panel search (optional) ────────────────────────────────────────────

  let panelSearchInput = null;

  if (searchable) {
    const searchWrap = createElement('div', 'joanium-ddm-lite__search-wrap');

    panelSearchInput = document.createElement('input');
    panelSearchInput.type = 'text';
    panelSearchInput.className = 'joanium-ddm-lite__search-input';
    panelSearchInput.placeholder = searchPlaceholder;
    panelSearchInput.autocomplete = 'off';
    panelSearchInput.spellcheck = false;

    panelSearchInput.addEventListener('input', () => {
      searchQuery = panelSearchInput.value.trim();
      buildOptionList();
    });

    // Prevent clicks inside the search from closing the panel
    panelSearchInput.addEventListener('click', (e) => e.stopPropagation());
    // Prevent Escape from bubbling to the portal controller while typing
    panelSearchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') e.stopPropagation();
    });

    searchWrap.append(panelSearchInput);
    panel.append(searchWrap);
  }

  // Always wrap options in a scrollable list so long option sets aren't clipped.
  const optionListEl = createElement('div', 'joanium-ddm-lite__option-list');
  panel.append(optionListEl);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function syncTriggerText() {
    const match = options.find((o) => o.value === currentValue);
    if (match) {
      triggerText.textContent = match.label;
      triggerText.classList.remove('joanium-ddm-lite__trigger-text--placeholder');
    } else {
      triggerText.textContent = placeholder;
      triggerText.classList.add('joanium-ddm-lite__trigger-text--placeholder');
    }

    // Show provider icon in the trigger when the selected option has one.
    const existingIcon = trigger.querySelector('.joanium-ddm-lite__trigger-icon');
    existingIcon?.remove();
    if (match?.iconPath) {
      const icon = createProviderIcon(match.iconPath, {
        className: 'joanium-ddm-lite__trigger-icon',
      });
      trigger.prepend(icon);
    }
  }

  function buildOptionList() {
    const container = optionListEl;
    const q = searchQuery.toLowerCase();
    const visible = searchQuery
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;

    container.replaceChildren();

    if (visible.length === 0) {
      const empty = createElement('div', 'joanium-ddm-lite__no-results');
      empty.textContent = 'No results';
      container.append(empty);
      return;
    }

    for (const opt of visible) {
      const item = createElement('button', 'joanium-ddm-lite__option');
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.classList.toggle('is-selected', opt.value === currentValue);

      if (opt.iconPath) {
        const icon = createProviderIcon(opt.iconPath, {
          className: 'joanium-ddm-lite__option-icon',
        });
        item.append(icon);
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = opt.label;
      labelSpan.style.flex = '1';
      item.append(labelSpan);

      // Info button — only when the option carries model metadata worth showing
      if (opt.model && hasModelInfo(opt.model)) {
        const infoBtn = createElement('button', 'joanium-ddm-lite__info-btn');
        infoBtn.type = 'button';
        infoBtn.setAttribute('aria-label', 'Model info');
        infoBtn.append(createInfoIcon());

        infoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (infoPopover.isOpenFor(opt.value)) {
            infoPopover.close();
            infoBtn.classList.remove('joanium-ddm-lite__info-btn--active');
            return;
          }
          // Clear any other active button
          panel
            .querySelectorAll('.joanium-ddm-lite__info-btn--active')
            .forEach((b) => b.classList.remove('joanium-ddm-lite__info-btn--active'));
          infoBtn.classList.add('joanium-ddm-lite__info-btn--active');
          infoPopover.open(opt.value, opt.provider, opt.model, infoBtn, panel);
        });

        item.append(infoBtn);
      }

      if (opt.favourite !== undefined || onToggleFavourite) {
        const starBtn = createElement('button', 'joanium-ddm-lite__star-btn');
        starBtn.type = 'button';
        if (opt.favourite) starBtn.classList.add('joanium-ddm-lite__star-btn--active');
        starBtn.setAttribute(
          'aria-label',
          opt.favourite ? 'Remove from favourites' : 'Add to favourites',
        );
        starBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="' +
          (opt.favourite ? 'currentColor' : 'none') +
          '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
        if (onToggleFavourite) {
          starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isNowFav = starBtn.classList.toggle('joanium-ddm-lite__star-btn--active');
            starBtn.setAttribute(
              'aria-label',
              isNowFav ? 'Remove from favourites' : 'Add to favourites',
            );
            starBtn.querySelector('svg').setAttribute('fill', isNowFav ? 'currentColor' : 'none');
            onToggleFavourite(opt);
          });
        } else {
          starBtn.disabled = true;
          starBtn.style.pointerEvents = 'none';
        }
        item.append(starBtn);
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        currentValue = opt.value;
        syncTriggerText();
        buildOptionList();
        dropdownController?.close();
        onChange?.(opt.value);
      });

      container.append(item);
    }
  }

  // Alias so callers (setValue, init) still work
  function buildPanel() {
    buildOptionList();
  }

  // ── Open / close ──────────────────────────────────────────────────────────

  function positionPanel() {
    const rect = trigger.getBoundingClientRect();
    const searchRowH = searchable ? 44 : 0;
    const panelH = Math.min(options.length * 38 + 16 + searchRowH, 240 + searchRowH);
    const goUp =
      window.innerHeight - rect.bottom < panelH && rect.top > window.innerHeight - rect.bottom;

    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;

    if (goUp) {
      panel.style.top = 'auto';
      panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
      panel.style.bottom = 'auto';
      panel.style.top = `${rect.bottom + 6}px`;
    }
  }

  // ── Document-level listeners ──────────────────────────────────────────────

  dropdownController = createPortalDropdownController({
    wrapper,
    panel,
    trigger,
    positionPanel,
    onOpen: () => {
      if (panelSearchInput) {
        panelSearchInput.value = '';
        searchQuery = '';
        buildOptionList();
        // Focus after the panel's open transition starts
        requestAnimationFrame(() => panelSearchInput.focus());
      }
    },
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  syncTriggerText();
  buildPanel();

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    element: wrapper,

    getValue() {
      return currentValue;
    },

    setValue(val) {
      currentValue = val;
      syncTriggerText();
      buildPanel();
    },

    dispose() {
      dropdownController.dispose();
    },
  };
}
