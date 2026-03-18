// ─────────────────────────────────────────────
//  openworld — Packages/Main/Paths.js
//  Single source of truth for all file-system paths.
//  Import this everywhere instead of computing paths ad-hoc.
// ─────────────────────────────────────────────

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Two levels up from Packages/Main/ → project root
const ROOT = path.resolve(__dirname, '..', '..');

export const Paths = {
  ROOT,

  // Data
  DATA_DIR:                 path.join(ROOT, 'Data'),
  USER_FILE:                path.join(ROOT, 'Data', 'User.json'),
  MODELS_FILE:              path.join(ROOT, 'Data', 'Models.json'),
  CUSTOM_INSTRUCTIONS_FILE: path.join(ROOT, 'Data', 'CustomInstructions.md'),
  MEMORY_FILE:              path.join(ROOT, 'Data', 'Memory.md'),
  CHATS_DIR:                path.join(ROOT, 'Data', 'Chats'),
  AUTOMATIONS_FILE:         path.join(ROOT, 'Data', 'Automations.json'),
  CONNECTORS_FILE:          path.join(ROOT, 'Data', 'Connectors.json'),

  // Electron
  PRELOAD:         path.join(ROOT, 'Packages', 'Electron', 'Preload.js'),
  SETUP_PAGE:      path.join(ROOT, 'Public', 'Setup.html'),
  MAIN_PAGE:       path.join(ROOT, 'Public', 'index.html'),
  AUTOMATIONS_PAGE: path.join(ROOT, 'Public', 'Automations.html'),
};

export default Paths;
