import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'personas',
  label: 'personas.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <circle cx="12" cy="8" r="4"/>\n           <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/PersonasPage.css', import.meta.url).href,
  order: 50,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
