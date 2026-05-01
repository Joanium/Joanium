import { ipcMain } from 'electron';
import { wrapHandler, wrapRead } from './IPCWrapper.js';
import * as AgentService from '../Services/AgentService.js';
import * as AgentRunService from '../Services/AgentRunService.js';

export const ipcMeta = { needs: [] };

export function register() {
  ipcMain.handle(
    'get-agents',
    wrapRead(() => AgentService.list()),
  );
  ipcMain.handle(
    'get-agent',
    wrapRead((agentId) => AgentService.get(agentId)),
  );
  ipcMain.handle(
    'create-agent',
    wrapHandler((input) => ({ agent: AgentService.create(input) })),
  );
  ipcMain.handle(
    'update-agent',
    wrapHandler((agentId, patch) => ({ agent: AgentService.update(agentId, patch) })),
  );
  ipcMain.handle(
    'delete-agent',
    wrapHandler((agentId) => {
      AgentService.remove(agentId);
    }),
  );
  ipcMain.handle(
    'update-agent-runtime',
    wrapHandler((agentId, fields) => ({ agent: AgentService.updateRuntime(agentId, fields) })),
  );
  ipcMain.handle(
    'start-agent-run',
    wrapHandler((run) => ({ run: AgentRunService.startRun(run) })),
  );
  ipcMain.handle(
    'finish-agent-run',
    wrapHandler((runId, patch) => ({ run: AgentRunService.finishRun(runId, patch) })),
  );
  ipcMain.handle(
    'get-agent-runs',
    wrapRead((limit) => ({ runs: AgentRunService.listRuns(limit) })),
  );
  ipcMain.handle(
    'get-running-jobs',
    wrapRead(() => ({ running: AgentRunService.listRunning() })),
  );
  ipcMain.handle(
    'clear-events-history',
    wrapHandler(() => {
      AgentRunService.clearRuns();
    }),
  );
}
