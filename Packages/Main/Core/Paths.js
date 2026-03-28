import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Two levels up from Packages/Main/ → project root
const ROOT = path.resolve(__dirname, '..', '..', '..');

export const Paths = {
  ROOT,

  // Data
  DATA_DIR: path.join(ROOT, 'Data'),
  USER_FILE: path.join(ROOT, 'Data', 'User.json'),
  MODELS_FILE: path.join(ROOT, 'Data', 'Models.json'),
  CUSTOM_INSTRUCTIONS_FILE: path.join(ROOT, 'Data', 'CustomInstructions.md'),
  MEMORY_FILE: path.join(ROOT, 'Data', 'Memory.md'),
  CHATS_DIR: path.join(ROOT, 'Data', 'Chats'),
  PROJECTS_DIR: path.join(ROOT, 'Data', 'Projects'),
  AUTOMATIONS_FILE: path.join(ROOT, 'Data', 'Automations.json'),
  SKILLS_FILE: path.join(ROOT, 'Data', 'Skills.json'),
  CONNECTORS_FILE: path.join(ROOT, 'Data', 'Connectors.json'),
  ACTIVE_PERSONA_FILE: path.join(ROOT, 'Data', 'ActivePersona.json'),
  USAGE_FILE: path.join(ROOT, 'Data', 'Usage.json'),
  AGENTS_FILE: path.join(ROOT, 'Data', 'Agents.json'),
  CHANNELS_FILE: path.join(ROOT, 'Data', 'Channels.json'),
  MCP_FILE: path.join(ROOT, 'Data', 'MCPServers.json'),
  WINDOW_STATE_FILE: path.join(ROOT, 'Data', 'WindowState.json'),

  // Skills & Personas directories (project root)
  SKILLS_DIR: path.join(ROOT, 'Skills'),
  PERSONAS_DIR: path.join(ROOT, 'Personas'),

  // Electron
  PRELOAD: path.join(ROOT, 'Packages', 'Electron', 'Bridge', 'Preload.js'),
  SETUP_PAGE: path.join(ROOT, 'Public', 'Setup.html'),
  INDEX_PAGE: path.join(ROOT, 'Public', 'index.html'),
  AUTOMATIONS_PAGE: path.join(ROOT, 'Public', 'Automations.html'),
  SKILLS_PAGE: path.join(ROOT, 'Public', 'Skills.html'),
  PERSONAS_PAGE: path.join(ROOT, 'Public', 'Personas.html'),
  USAGE_PAGE: path.join(ROOT, 'Public', 'Usage.html'),
  AGENTS_PAGE: path.join(ROOT, 'Public', 'Agents.html'),
  EVENTS_PAGE: path.join(ROOT, 'Public', 'Events.html'),
  CHANNELS_PAGE: path.join(ROOT, 'Public', 'Channels.html'),
};

export default Paths;
