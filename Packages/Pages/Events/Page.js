import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'events',
  label: 'nav.events',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <rect x="3" y="4" width="18" height="18" rx="2" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/EventsPage.css', import.meta.url).href,
  order: 60,
  section: 'bottom',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
