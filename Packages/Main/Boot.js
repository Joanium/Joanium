import FeatureRegistry from '../Capabilities/Core/FeatureRegistry.js';
import createFeatureStorageMap from '../Features/Core/FeatureStorage.js';
import {
  IPC_SCAN_DIRS,
  SERVICE_SCAN_DIRS,
  ENGINE_DISCOVERY_ROOTS,
  FEATURE_DISCOVERY_ROOTS,
} from './Core/DiscoveryManifest.js';
import { discoverAndRegisterIPC } from './Core/DiscoverIPC.js';
import { instantiateDiscoveredEngines } from './Core/EngineAssembly.js';
import { startEngines, stopEngines } from './Core/EngineLifecycle.js';
import { discoverEngines } from './Core/EngineDiscovery.js';
import Paths from './Core/Paths.js';
import { getBrowserPreviewService } from './Services/BrowserPreviewService.js';
import { invalidate as invalidateSystemPrompt } from './Services/SystemPromptService.js';
import * as UserService from './Services/UserService.js';
export async function boot() {
  const featureRegistry = await FeatureRegistry.load(FEATURE_DISCOVERY_ROOTS),
    browserPreviewService = getBrowserPreviewService(),
    discovered = await discoverEngines(ENGINE_DISCOVERY_ROOTS),
    featureStorage = createFeatureStorageMap(Paths, {
      featureRegistry: featureRegistry,
      engines: discovered,
    }),
    baseContext = {
      paths: Paths,
      featureRegistry: featureRegistry,
      featureStorage: featureStorage,
      invalidateSystemPrompt: invalidateSystemPrompt,
      userService: UserService,
    },
    { context: context } = await instantiateDiscoveredEngines(discovered, baseContext);
  (featureRegistry.setBaseContext({
    connectorEngine: context.connectorEngine,
    featureStorage: featureStorage,
    paths: Paths,
    invalidateSystemPrompt: invalidateSystemPrompt,
  }),
    await featureRegistry.runLifecycle('onBoot', context));
  const registered = await discoverAndRegisterIPC(
    IPC_SCAN_DIRS,
    { ...context, browserPreviewService: browserPreviewService },
    { serviceDirs: SERVICE_SCAN_DIRS },
  );
  return (
    console.log(
      `[Boot] Auto-discovered ${registered.length} IPC modules: ${registered.join(', ')}`,
    ),
    { featureRegistry: featureRegistry, browserPreviewService: browserPreviewService, ...context }
  );
}
export { startEngines, stopEngines };
