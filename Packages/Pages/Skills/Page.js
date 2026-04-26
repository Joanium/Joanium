import definePage from '../../System/Contracts/DefinePage.js';
export default definePage({
  id: 'skills',
  label: 'skills.title',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">\n           <path d="M12 3C10.3 7.8 7.8 10.3 3 12c4.8 1.7 7.3 4.2 9 9 1.7-4.8 4.2-7.3 9-9-4.8-1.7-7.3-4.2-9-9z" stroke-linecap="round" stroke-linejoin="round"/>\n         </svg>',
  css: new URL('./UI/Styles/SkillsPage.css', import.meta.url).href,
  order: 40,
  section: 'top',
  moduleUrl: new URL('./UI/Render/index.js', import.meta.url).href,
});
