import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'chat',
  label: 'sidebar.newChat',
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
          </svg>`,
  order: 1,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
