import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'personas',
  label: 'personas.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"/>\n           <circle cx="12" cy="10" r="3" stroke-linecap="round"/>\n           <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" stroke-linecap="round" stroke-linejoin="round"/>\n         </svg>',
  css: new URL('./UI/Styles/PersonasPage.css', import.meta.url).href,
  order: 50,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
