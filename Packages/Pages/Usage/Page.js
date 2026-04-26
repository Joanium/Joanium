import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'usage',
  label: 'usage.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <path d="M18 20V10M12 20V4M6 20v-6" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M2 20h20" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/UsagePage.css', import.meta.url).href,
  order: 70,
  section: 'bottom',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
