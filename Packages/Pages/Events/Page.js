import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'events',
  label: 'Events',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round"/>\n         </svg>',
  css: new URL('./UI/Styles/EventsPage.css', import.meta.url).href,
  order: 60,
  section: 'bottom',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
