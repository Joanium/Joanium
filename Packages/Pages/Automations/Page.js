import definePage from '../../System/Contracts/DefinePage.js';

export default definePage({
  id: 'automations',
  label: 'Automations',
  icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
           <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/>
         </svg>`,
  css: new URL('../Agents/UI/Styles/AgentsPage.css', import.meta.url).href,
  order: 20,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
