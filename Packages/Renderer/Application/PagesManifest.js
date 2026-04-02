/**
 * Pages Manifest — single source of truth for all navigable pages.
 *
 * Each entry defines:
 *   id       — route key (used in PAGES map and sidebar data-view)
 *   label    — sidebar tooltip text
 *   icon     — SVG string for the sidebar button
 *   load     — dynamic import function
 *   css      — optional stylesheet path (null if none)
 *   order    — sort order in the sidebar
 *   section  — 'top' (above spacer) or 'bottom' (below spacer)
 */
export const pages = [
  {
    id: 'chat',
    label: 'New chat',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
           </svg>`,
    load: () => import('../../Pages/Chat/UI/Render/index.js'),
    css: null,
    order: 1,
    section: 'top',
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M13 2L4.5 13H11l-1 9L20.5 11H14L13 2z" stroke-linejoin="round"/>
           </svg>`,
    load: () => import('../../Pages/Automations/UI/Render/index.js'),
    css: '../Automations/UI/Styles/AutomationsPage.css',
    order: 20,
    section: 'top',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-3.14Z" stroke-linecap="round"/>
             <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-3.14Z" stroke-linecap="round"/>
           </svg>`,
    load: () => import('../../Pages/Agents/UI/Render/index.js'),
    css: '../Agents/UI/Styles/AgentsPage.css',
    order: 30,
    section: 'top',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                   stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`,
    load: () => import('../../Pages/Skills/UI/Render/index.js'),
    css: '../Skills/UI/Styles/SkillsPage.css',
    order: 40,
    section: 'top',
  },
  {
    id: 'personas',
    label: 'Personas',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <circle cx="12" cy="8" r="4"/>
             <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/>
           </svg>`,
    load: () => import('../../Pages/Personas/UI/Render/index.js'),
    css: '../Personas/UI/Styles/PersonasPage.css',
    order: 50,
    section: 'top',
  },
  {
    id: 'events',
    label: 'Events',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>`,
    load: () => import('../../Pages/Events/UI/Render/index.js'),
    css: '../Events/UI/Styles/EventsPage.css',
    order: 60,
    section: 'bottom',
  },
  {
    id: 'usage',
    label: 'Usage',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <rect x="2" y="3" width="20" height="14" rx="2"/>
             <path d="M8 21h8M12 17v4" stroke-linecap="round"/>
           </svg>`,
    load: () => import('../../Pages/Usage/UI/Render/index.js'),
    css: '../Usage/UI/Styles/UsagePage.css',
    order: 70,
    section: 'bottom',
  },
];

/**
 * Build the PAGES map for the router from the manifest.
 * Returns { chat: { load, css }, automations: { load, css }, ... }
 */
export function buildPagesMap() {
  const map = {};
  for (const page of pages) {
    map[page.id] = { load: page.load, css: page.css };
  }
  return map;
}

/**
 * Build sidebar nav items from the manifest.
 * Returns { top: [...], bottom: [...] } each sorted by order.
 */
export function buildSidebarNav() {
  const top = [], bottom = [];
  for (const page of pages) {
    const item = { id: page.id, label: page.label, icon: page.icon };
    if (page.section === 'bottom') bottom.push(item);
    else top.push(item);
  }
  top.sort((a, b) => pages.find(p => p.id === a.id).order - pages.find(p => p.id === b.id).order);
  bottom.sort((a, b) => pages.find(p => p.id === a.id).order - pages.find(p => p.id === b.id).order);
  return { top, bottom };
}
