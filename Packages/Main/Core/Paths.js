import { fileURLToPath } from 'url';
import path from 'path';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const EXTERNAL = app.isPackaged ? process.resourcesPath : ROOT;

export const Paths = {
  ROOT,

  // Config
  USER_FILE: path.join(EXTERNAL, 'Config', 'User.json'),
  MODELS_FILE: path.join(EXTERNAL, 'Config', 'Models.json'),
  WINDOW_STATE_FILE: path.join(EXTERNAL, 'Config', 'WindowState.json'),

  // Data
  DATA_DIR: path.join(EXTERNAL, 'Data'),
  CHATS_DIR: path.join(EXTERNAL, 'Data', 'Chats'),
  PROJECTS_DIR: path.join(EXTERNAL, 'Data', 'Projects'),
  AUTOMATIONS_FILE: path.join(EXTERNAL, 'Data', 'Automations.json'),
  SKILLS_FILE: path.join(EXTERNAL, 'Data', 'Skills.json'),
  CONNECTORS_FILE: path.join(EXTERNAL, 'Data', 'Connectors.json'),
  ACTIVE_PERSONA_FILE: path.join(EXTERNAL, 'Data', 'ActivePersona.json'),
  USAGE_FILE: path.join(EXTERNAL, 'Data', 'Usage.json'),
  AGENTS_FILE: path.join(EXTERNAL, 'Data', 'Agents.json'),
  CHANNELS_FILE: path.join(EXTERNAL, 'Data', 'Channels.json'),
  MCP_FILE: path.join(EXTERNAL, 'Data', 'MCPServers.json'),
  FEATURES_DATA_DIR: path.join(EXTERNAL, 'Data', 'Features'),

  // Instructions
  CUSTOM_INSTRUCTIONS_FILE: path.join(EXTERNAL, 'Instructions', 'CustomInstructions.md'),
  MEMORY_FILE: path.join(EXTERNAL, 'Instructions', 'Memory.md'),

  // Skills
  SKILLS_DIR: path.join(EXTERNAL, 'Skills'),

  // Personas
  PERSONAS_DIR: path.join(EXTERNAL, 'Personas'),

  // Features
  FEATURES_DIR: path.join(ROOT, 'Packages', 'Capabilities'),

  // Preload
  PRELOAD: path.join(ROOT, 'Core', 'Electron', 'Bridge', 'Preload.js'),

  // Pages
  SETUP_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Setup', 'Setup.html'),
  INDEX_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Chat', 'Chat.html'),
  AUTOMATIONS_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Automations', 'Automations.html'),
  SKILLS_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Skills', 'Skills.html'),
  PERSONAS_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Personas', 'Personas.html'),
  USAGE_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Usage', 'Usage.html'),
  AGENTS_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Agents', 'Agents.html'),
  EVENTS_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Events', 'Events.html'),
};

export default Paths;
