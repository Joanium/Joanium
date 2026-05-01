export { default as chatPage } from './Chat/Page.js';
export { default as eventsPage } from './Events/Page.js';
export { default as marketplacePage } from './Marketplace/Page.js';
export { default as personasPage } from './Personas/Page.js';
export { default as setupPage } from './Setup/Page.js';
export { default as skillsPage } from './Skills/Page.js';
export { default as templatesPage } from './Templates/Page.js';
export { default as usagePage } from './Usage/Page.js';
export const pages = Object.freeze([
  chatPage,
  setupPage,
  templatesPage,
  skillsPage,
  marketplacePage,
  personasPage,
  eventsPage,
  usagePage,
]);
export default pages;
