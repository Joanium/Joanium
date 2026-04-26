import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'marketplace',
  label: 'marketplace.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M3 6h18" stroke-linecap="round"/>\n           <path d="M16 10a4 4 0 0 1-8 0" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/MarketplacePage.css', import.meta.url).href,
  order: 45,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
