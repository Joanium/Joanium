import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'usage',
  label: 'usage.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <rect x="2" y="3" width="20" height="14" rx="2"/>\n           <path d="M8 21h8M12 17v4" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/UsagePage.css', import.meta.url).href,
  order: 70,
  section: 'bottom',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
