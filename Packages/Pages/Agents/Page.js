import definePage from '../../System/Contracts/DefinePage.js';

export default definePage({
  id: 'agents',
  label: 'Agents',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z" stroke-linecap="round" stroke-linejoin="round"/>\n         </svg>',
  css: new URL('./UI/Styles/AgentsPage.css', import.meta.url).href,
  order: 10,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
