import { fileURLToPath } from 'url';
import path from 'path';
import { app } from 'electron';
import { FEATURE_DISCOVERY_ROOTS, PAGE_DISCOVERY_ROOT } from './DiscoveryManifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..', '..');

function getBundledRoot() {
  return app.isPackaged ? process.resourcesPath : ROOT;
}

function getStateRoot() {
  return app.isPackaged ? app.getPath('userData') : ROOT;
}

export const Paths = {
  ROOT,
  get BUNDLED_ROOT() {
    return getBundledRoot();
  },
  get STATE_ROOT() {
    return getStateRoot();
  },

  // Config
  get USER_FILE() {
    return path.join(getStateRoot(), 'Config', 'User.json');
  },
  get MODELS_DIR() {
    return path.join(getBundledRoot(), 'Config', 'Models');
  },
  get MODELS_INDEX_FILE() {
    return path.join(getBundledRoot(), 'Config', 'Models', 'index.json');
  },
  get WINDOW_STATE_FILE() {
    return path.join(getStateRoot(), 'Config', 'WindowState.json');
  },

  // Data
  get DATA_DIR() {
    return path.join(getStateRoot(), 'Data');
  },
  get CHATS_DIR() {
    return path.join(getStateRoot(), 'Data', 'Chats');
  },
  get PROJECTS_DIR() {
    return path.join(getStateRoot(), 'Data', 'Projects');
  },
  get SKILLS_FILE() {
    return path.join(getStateRoot(), 'Data', 'Skills.json');
  },
  get ACTIVE_PERSONA_FILE() {
    return path.join(getStateRoot(), 'Data', 'ActivePersona.json');
  },
  get USAGE_FILE() {
    return path.join(getStateRoot(), 'Data', 'Usage.json');
  },
  get MCP_FILE() {
    return path.join(getStateRoot(), 'Data', 'MCPServers.json');
  },
  get FEATURES_DATA_DIR() {
    return path.join(getStateRoot(), 'Data', 'Features');
  },

  // Instructions
  get CUSTOM_INSTRUCTIONS_FILE() {
    return path.join(getStateRoot(), 'Instructions', 'CustomInstructions.md');
  },
  get MEMORY_FILE() {
    return path.join(getStateRoot(), 'Memories', 'Memory.md');
  },

  // Skills
  get SKILLS_DIR() {
    return path.join(getBundledRoot(), 'Skills');
  },

  // Personas
  get PERSONAS_DIR() {
    return path.join(getBundledRoot(), 'Personas');
  },

  // Features
  FEATURES_DIRS: FEATURE_DISCOVERY_ROOTS,
  FEATURES_DIR: FEATURE_DISCOVERY_ROOTS[0] ?? path.join(ROOT, 'Packages', 'Capabilities'),

  // Pages (renderer)
  PAGES_DIR: PAGE_DISCOVERY_ROOT,

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
