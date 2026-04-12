import { ipcMain } from 'electron';
import * as ProjectService from '../Services/ProjectService.js';
import { wrapHandler, wrapRead } from './IPCWrapper.js';
export const ipcMeta = { needs: [] };
export function register() {
  (ipcMain.handle(
    'get-projects',
    wrapRead(() => ProjectService.list()),
  ),
    ipcMain.handle(
      'get-project',
      wrapRead((projectId) => ProjectService.get(projectId)),
    ),
    ipcMain.handle(
      'create-project',
      wrapHandler((projectData) => ({ project: ProjectService.create(projectData) })),
    ),
    ipcMain.handle(
      'update-project',
      wrapHandler((projectId, patch) => ({ project: ProjectService.update(projectId, patch) })),
    ),
    ipcMain.handle(
      'delete-project',
      wrapHandler((projectId) => {
        ProjectService.remove(projectId);
      }),
    ),
    ipcMain.handle(
      'validate-project',
      wrapHandler((projectId) => {
        const project = ProjectService.get(projectId);
        return { project: project, folderExists: project.folderExists };
      }),
    ));
}
