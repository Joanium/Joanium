import definePage from '../../System/Contracts/DefinePage.js';

export default definePage({
  id: 'agents',
  label: 'Agents',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <rect x="4" y="4" width="16" height="16" rx="4" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M9 9h6v6H9z" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/AgentsPage.css', import.meta.url).href,
  order: 10,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
