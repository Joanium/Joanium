import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'marketplace',
  label: 'marketplace.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <path d="M4 7.5h16l-1.3 10.4a2 2 0 0 1-1.98 1.85H7.28A2 2 0 0 1 5.3 17.9L4 7.5z" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M8 7.5V6a4 4 0 0 1 8 0v1.5" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M9.5 11.5h5" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/MarketplacePage.css', import.meta.url).href,
  order: 45,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
