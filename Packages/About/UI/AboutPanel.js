import { createElement, formatText } from '../../Shared/Utils/DomUtils.js';
import { invokeIpc, onIpc } from '../../Shared/Ipc/RendererIpc.js';
import { iconMarkup } from '../../Shared/Icons/Icons.js';
import { formatBytes, getUpdatePresentation, parseBuildDate } from './Utils.js';

function createSocialLink({ icon, url, label }) {
  const link = createElement('a', 'chat-profile__about-social-link');
  link.setAttribute('aria-label', label);
  link.href = '#';

  const iconEl = createElement('span', 'chat-profile__about-social-icon');
  iconEl.innerHTML = iconMarkup[icon] ?? '';
  link.append(iconEl);

  link.addEventListener('click', (event) => {
    event.preventDefault();
    void invokeIpc('about:open-external', url);
  });

  return link;
}

function createMetaCard(rows) {
  const card = createElement('div', 'chat-profile__about-meta');

  for (const { label, value } of rows) {
    const row = createElement('div', 'chat-profile__about-meta-row');
    row.append(
      createElement('span', 'chat-profile__about-meta-label', label),
      createElement('span', 'chat-profile__about-meta-value', value),
    );
    card.append(row);
  }

  return card;
}

function createUpdateCard(strings) {
  const card = createElement('section', 'chat-profile__about-update');
  const top = createElement('div', 'chat-profile__about-update-top');
  const heading = createElement('div', 'chat-profile__about-update-heading');
  const icon = createElement('span', 'chat-profile__about-update-icon');
  icon.innerHTML = iconMarkup.download ?? '';

  const titleWrap = createElement('div', 'chat-profile__about-update-title-wrap');
  const title = createElement('h2', 'chat-profile__about-update-title', strings.title);
  const subtitle = createElement('p', 'chat-profile__about-update-subtitle', strings.subtitle);
  titleWrap.append(title, subtitle);
  heading.append(icon, titleWrap);

  const statusPill = createElement('span', 'chat-profile__about-update-pill');
  top.append(heading, statusPill);

  const body = createElement('div', 'chat-profile__about-update-body');
  const summary = createElement('div', 'chat-profile__about-update-summary');
  const detail = createElement('p', 'chat-profile__about-update-detail');
  summary.append(detail);

  const actions = createElement('div', 'chat-profile__about-update-actions');
  const checkButton = createElement('button', 'chat-profile__about-update-btn');
  checkButton.type = 'button';
  const checkIcon = createElement('span', 'chat-profile__about-update-btn-icon');
  checkIcon.innerHTML = iconMarkup.retry ?? '';
  const checkLabel = createElement('span', 'chat-profile__about-update-btn-label', strings.check);
  checkButton.append(checkIcon, checkLabel);

  const installButton = createElement(
    'button',
    'chat-profile__about-update-btn chat-profile__about-update-btn--primary',
  );
  installButton.type = 'button';
  const installIcon = createElement('span', 'chat-profile__about-update-btn-icon');
  installIcon.innerHTML = iconMarkup.download ?? '';
  const installLabel = createElement(
    'span',
    'chat-profile__about-update-btn-label',
    strings.install,
  );
  installButton.append(installIcon, installLabel);
  actions.append(checkButton, installButton);

  body.append(summary, actions);

  const progress = createElement('div', 'chat-profile__about-update-progress');
  const progressHeader = createElement('div', 'chat-profile__about-update-progress-header');
  const progressPercent = createElement('strong', 'chat-profile__about-update-progress-percent');
  const progressCaption = createElement('span', 'chat-profile__about-update-progress-caption');
  progressHeader.append(progressPercent, progressCaption);

  const progressTrack = createElement('div', 'chat-profile__about-update-progress-track');
  const progressBar = createElement('div', 'chat-profile__about-update-progress-bar');
  progressTrack.append(progressBar);
  progress.append(progressHeader, progressTrack);

  let installing = false;
  let currentState = null;

  async function handleCheck() {
    checkButton.disabled = true;
    checkLabel.textContent = strings.checking;
    try {
      currentState = await invokeIpc('auto-update:check');
      render(currentState);
    } catch {
      render({
        ...(currentState ?? {}),
        status: 'error',
        error: strings.details.error,
      });
    }
  }

  async function handleInstall() {
    installing = true;
    render(currentState);

    try {
      const installed = await invokeIpc('auto-update:install');
      if (!installed) {
        installing = false;
        render(currentState);
      }
    } catch {
      installing = false;
      render({
        ...(currentState ?? {}),
        status: 'error',
        error: strings.details.error,
      });
    }
  }

  checkButton.addEventListener('click', () => {
    void handleCheck();
  });
  installButton.addEventListener('click', () => {
    void handleInstall();
  });

  function render(updateState) {
    currentState = updateState ?? {};
    const presentation = getUpdatePresentation(currentState, strings);

    card.className = `chat-profile__about-update chat-profile__about-update--${presentation.status}`;
    statusPill.textContent = presentation.statusLabel;
    detail.textContent = presentation.detail;
    detail.hidden = !presentation.detail;

    progress.hidden = !presentation.showProgress;
    if (presentation.showProgress) {
      progressPercent.textContent = `${presentation.percent}%`;
      progressCaption.textContent = presentation.progressDetail;
      progressBar.style.width = `${presentation.percent}%`;
    } else {
      progressBar.style.width = '0%';
      progressPercent.textContent = '0%';
      progressCaption.textContent = strings.idleDetail;
    }

    checkButton.hidden = !presentation.canCheck;
    checkButton.disabled = !presentation.canCheck || installing;
    checkLabel.textContent = presentation.status === 'checking' ? strings.checking : strings.check;

    installButton.hidden = !presentation.canInstall;
    installButton.disabled = !presentation.canInstall || installing;
    installLabel.textContent = installing ? strings.installing : strings.install;
  }

  card.append(top, body, progress);
  return { element: card, render };
}

export function createAboutPanel(strings) {
  const view = createElement('div', 'chat-profile__about');
  let removeUpdateListener = null;

  async function populate() {
    removeUpdateListener?.();

    const [info, updateState] = await Promise.all([
      invokeIpc('about:get-info'),
      invokeIpc('auto-update:get-state').catch(() => ({
        enabled: false,
        supported: false,
        status: 'unsupported',
      })),
    ]);

    const system = info.system ?? {};
    const unknownValue = strings.unknownValue;

    const nameEl = createElement('h1', 'chat-profile__about-name', info.name || '');
    const versionEl = createElement(
      'p',
      'chat-profile__about-version',
      formatText(strings.version, { version: info.version || '' }),
    );
    const descEl = createElement('p', 'chat-profile__about-desc', strings.description || '');

    const iconWrap = createElement('div', 'chat-profile__about-icon-wrap');
    const iconImg = document.createElement('img');
    iconImg.className = 'chat-profile__about-icon';
    iconImg.src = info.logoPath ?? '';
    iconImg.alt = info.name || '';
    iconImg.draggable = false;
    iconWrap.append(iconImg);
    iconWrap.append(createElement('div', 'chat-profile__about-icon-reflect'));

    const socialBar = createElement('div', 'chat-profile__about-social');
    for (const socialLink of [
      {
        icon: 'globe',
        url: 'https://www.joanium.com',
        label: strings.social.website,
      },
      {
        icon: 'github',
        url: 'https://github.com/joanium',
        label: strings.social.github,
      },
      {
        icon: 'discord',
        url: 'https://discord.com/invite/5yHKxxx5fK',
        label: strings.social.discord,
      },
      {
        icon: 'x',
        url: 'https://x.com/joanium',
        label: strings.social.x,
      },
      {
        icon: 'instagram',
        url: 'https://instagram.com/joaniumhere',
        label: strings.social.instagram,
      },
      {
        icon: 'youtube',
        url: 'https://www.youtube.com/@Joaniumhere',
        label: strings.social.youtube,
      },
    ]) {
      socialBar.append(createSocialLink(socialLink));
    }

    const sponsorBtn = createElement('a', 'chat-profile__about-sponsor');
    sponsorBtn.setAttribute('aria-label', strings.sponsor);
    sponsorBtn.href = '#';
    const heartEl = createElement('span', 'chat-profile__about-social-icon');
    heartEl.innerHTML = iconMarkup.heart ?? '';
    sponsorBtn.append(heartEl);
    sponsorBtn.addEventListener('click', (event) => {
      event.preventDefault();
      void invokeIpc('about:open-external', strings.sponsorUrl);
    });
    socialBar.append(sponsorBtn);

    const updateCard = createUpdateCard(strings.updates);
    updateCard.render(updateState);
    removeUpdateListener = onIpc('auto-update:state', (nextState) => {
      updateCard.render(nextState);
    });

    const metaCard = createMetaCard([
      { label: strings.author, value: info.author || unknownValue },
      { label: strings.lastUpdated, value: parseBuildDate(info.version) || unknownValue },
    ]);

    const productsBtn = createElement('a', 'chat-profile__about-products-btn');
    productsBtn.href = '#';
    productsBtn.setAttribute('aria-label', strings.otherProducts);

    const productsLabel = createElement(
      'span',
      'chat-profile__about-products-label',
      strings.otherProducts,
    );

    const productsIcon = createElement('span', 'chat-profile__about-products-icon');
    productsIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    `;

    productsBtn.append(productsLabel, productsIcon);

    productsBtn.addEventListener('click', (event) => {
      event.preventDefault();
      void invokeIpc('about:open-external', strings.otherProductsUrl);
    });

    const osVersion = system.osVersion || '';
    const osName = system.osName || '';
    const osDisplay = osVersion.startsWith(osName)
      ? osVersion
      : [osName, osVersion].filter(Boolean).join(' ');

    const systemCard = createMetaCard([
      {
        label: strings.os,
        value: [osDisplay, system.arch].filter(Boolean).join(' ') || unknownValue,
      },
      {
        label: strings.cpu,
        value:
          [system.cpuModel, system.cpuCores ? `${system.cpuCores} cores` : '']
            .filter(Boolean)
            .join(' ') || unknownValue,
      },
      {
        label: strings.memory,
        value: formatBytes(system.totalMem) || unknownValue,
      },
      {
        label: strings.locale,
        value: system.locale || unknownValue,
      },
      {
        label: strings.timezone,
        value: system.timezone || unknownValue,
      },
    ]);

    const leftCol = createElement('div', 'chat-profile__about-col chat-profile__about-col--left');
    leftCol.append(metaCard, productsBtn);

    const rightCol = createElement('div', 'chat-profile__about-col chat-profile__about-col--right');
    rightCol.append(systemCard);

    const columnsRow = createElement('div', 'chat-profile__about-columns');
    columnsRow.append(leftCol, rightCol);

    const heroText = createElement('div', 'chat-profile__about-hero-text');
    heroText.append(nameEl, versionEl, descEl);

    const heroRow = createElement('div', 'chat-profile__about-hero');
    heroRow.append(iconWrap, heroText);

    view.replaceChildren(heroRow, socialBar, updateCard.element, columnsRow);
  }

  function dispose() {
    removeUpdateListener?.();
    removeUpdateListener = null;
  }

  view._dispose = dispose;

  return {
    element: view,
    populate,
    dispose,
  };
}
