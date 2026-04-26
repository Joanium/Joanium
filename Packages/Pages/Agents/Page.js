import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'agents',
  label: 'agents.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <rect x="3" y="11" width="18" height="10" rx="2" stroke-linecap="round" stroke-linejoin="round"/>\n           <path d="M9 11V8a3 3 0 0 1 6 0v3" stroke-linecap="round" stroke-linejoin="round"/>\n           <circle cx="9" cy="16" r="1.5" fill="currentColor" stroke="none"/>\n           <circle cx="15" cy="16" r="1.5" fill="currentColor" stroke="none"/>\n           <path d="M12 3v2" stroke-linecap="round"/>\n         </svg>',
  css: new URL('./UI/Styles/AgentsPage.css', import.meta.url).href,
  order: 30,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
