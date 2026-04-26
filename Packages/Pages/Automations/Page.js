import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'automations',
  label: 'automations.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke-linecap="round" stroke-linejoin="round"/>\n         </svg>',
  css: new URL('./UI/Styles/AutomationsPage.css', import.meta.url).href,
  order: 20,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
