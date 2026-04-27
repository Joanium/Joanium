import definePage from '../../System/Contracts/DefinePage.js';

export default definePage({
  id: 'templates',
  label: 'templates.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <rect x="3" y="3" width="18" height="18" rx="2" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M9 3v18" stroke-linecap="round"/>\n           <path d="M3 9h6" stroke-linecap="round"/>\n           <path d="M3 15h6" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/TemplatesPage.css', import.meta.url).href,
  order: 15,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
