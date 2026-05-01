import { fileURLToPath } from 'url';
import path from 'path';
import { app } from 'electron';
import { FEATURE_DISCOVERY_ROOTS, PAGE_DISCOVERY_ROOT } from './DiscoveryManifest.js';
const __filename = fileURLToPath(import.meta.url),
  __dirname = path.dirname(__filename),
  ROOT = path.resolve(__dirname, '..', '..', '..');
function getBundledRoot() {
  return app.isPackaged ? process.resourcesPath : ROOT;
}
function getStateRoot() {
  return app.isPackaged ? app.getPath('userData') : ROOT;
}
function getDevLibraryDir(folderName) {
  return path.join(ROOT, folderName);
}
function getLibraryDir(folderName) {
  return app.isPackaged
    ? path.join(app.getPath('userData'), folderName)
    : getDevLibraryDir(folderName);
}
function getLibrarySeedDir(folderName) {
  return app.isPackaged
    ? path.join(process.resourcesPath, folderName)
    : getDevLibraryDir(folderName);
}
export const Paths = {
  ROOT: ROOT,
  get BUNDLED_ROOT() {
    return getBundledRoot();
  },
  get STATE_ROOT() {
    return getStateRoot();
  },
  get USER_FILE() {
    return path.join(getStateRoot(), 'Config', 'User.json');
  },
  get SYSTEM_FILE() {
    return path.join(getStateRoot(), 'Config', 'System.json');
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
  get APP_LOCK_FILE() {
    return path.join(getStateRoot(), 'Config', 'AppLock.json');
  },
  get APP_LOCK_BACKUP_FILE() {
    return path.join(getStateRoot(), 'Data', 'Features', 'AppLock.backup.json');
  },
  get DATA_DIR() {
    return path.join(getStateRoot(), 'Data');
  },
  get PROFILE_DIR() {
    return path.join(getStateRoot(), 'Data', 'Profile');
  },
  get AVATAR_FILE() {
    return path.join(getStateRoot(), 'Data', 'Profile', 'Avatar.png');
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
  get CUSTOM_INSTRUCTIONS_FILE() {
    return path.join(getStateRoot(), 'Instructions', 'CustomInstructions.md');
  },
  get MEMORIES_DIR() {
    return path.join(getStateRoot(), 'Memories');
  },
  get MEMORY_FILE() {
    return path.join(getStateRoot(), 'Memories', 'Memory.md');
  },
  get USER_SKILLS_DIR() {
    return getLibraryDir('Skills');
  },
  get USER_PERSONAS_DIR() {
    return getLibraryDir('Personas');
  },
  get SKILLS_SEED_DIR() {
    return getLibrarySeedDir('Skills');
  },
  get PERSONAS_SEED_DIR() {
    return getLibrarySeedDir('Personas');
  },
  FEATURES_DIRS: FEATURE_DISCOVERY_ROOTS,
  FEATURES_DIR: FEATURE_DISCOVERY_ROOTS[0] ?? path.join(ROOT, 'Packages', 'Capabilities'),
  PAGES_DIR: PAGE_DISCOVERY_ROOT,
  PRELOAD: path.join(ROOT, 'Core', 'Electron', 'Bridge', 'Preload.js'),
  SETUP_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Setup', 'Setup.html'),
  INDEX_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Chat', 'Chat.html'),
  LOCK_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Lock', 'Lock.html'),
  USAGE_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Usage', 'Usage.html'),
  EVENTS_PAGE: path.join(ROOT, 'Packages', 'Pages', 'Events', 'Events.html'),
};
export default Paths;
