import { AutomationEngine } from '../Features/Automation/Core/AutomationEngine.js';
import { ConnectorEngine } from '../Features/Connectors/Core/ConnectorEngine.js';
import { AgentsEngine } from '../Features/Agents/Core/AgentsEngine.js';
import { ChannelEngine } from '../Features/Channels/Core/ChannelEngine.js';
import FeatureRegistry from '../Capabilities/Core/FeatureRegistry.js';

import { getBrowserPreviewService } from './Services/BrowserPreviewService.js';
import { invalidate as invalidateSystemPrompt } from './Services/SystemPromptService.js';

import Paths from './Core/Paths.js';
import { discoverAndRegisterIPC } from './Core/DiscoverIPC.js';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGES_DIR = path.resolve(__dirname, '..');

const IPC_SCAN_DIRS = [
  path.join(PACKAGES_DIR, 'Main', 'IPC'),
  path.join(PACKAGES_DIR, 'Features'),
];

export async function boot() {
  const featureRegistry = await FeatureRegistry.load(Paths.FEATURES_DIR);

  const connectorEngine = new ConnectorEngine(Paths.CONNECTORS_FILE, featureRegistry);
  featureRegistry.setBaseContext({
    connectorEngine,
    paths: Paths,
    invalidateSystemPrompt,
  });

  const automationEngine = new AutomationEngine(Paths.AUTOMATIONS_FILE, connectorEngine, featureRegistry);
  const agentsEngine = new AgentsEngine(Paths.AGENTS_FILE, connectorEngine, featureRegistry);
  const channelEngine = new ChannelEngine(Paths.CHANNELS_FILE);

  const browserPreviewService = getBrowserPreviewService();

  const registered = await discoverAndRegisterIPC(IPC_SCAN_DIRS, {
    connectorEngine,
    featureRegistry,
    automationEngine,
    agentsEngine,
    channelEngine,
    browserPreviewService,
  });

  console.log(`[Boot] Auto-discovered ${registered.length} IPC modules: ${registered.join(', ')}`);

  return {
    featureRegistry,
    connectorEngine,
    automationEngine,
    agentsEngine,
    channelEngine,
    browserPreviewService,
  };
}

export function startEngines({ automationEngine, agentsEngine, channelEngine }) {
  automationEngine.start();
  agentsEngine.start();
  channelEngine.start();
}

export function stopEngines({ automationEngine, agentsEngine, channelEngine }) {
  automationEngine?.stop();
  agentsEngine?.stop();
  channelEngine?.stop();
}
