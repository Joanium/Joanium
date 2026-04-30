import agentsPage from './Agents/Page.js';
import chatPage from './Chat/Page.js';
import eventsPage from './Events/Page.js';
import marketplacePage from './Marketplace/Page.js';
import personasPage from './Personas/Page.js';
import setupPage from './Setup/Page.js';
import skillsPage from './Skills/Page.js';
import templatesPage from './Templates/Page.js';
import usagePage from './Usage/Page.js';
export { default as agentsPage } from './Agents/Page.js';
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
  agentsPage,
  skillsPage,
  marketplacePage,
  personasPage,
  eventsPage,
  usagePage,
]);
export default pages;
