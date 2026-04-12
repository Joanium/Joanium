import { ipcMain } from 'electron';
export const ipcMeta = { needs: ['featureRegistry'] };
export function register(featureRegistry) {
  (ipcMain.handle('feature:get-boot', async () => featureRegistry.getBootPayload()),
    ipcMain.handle('feature:invoke', async (event, featureId, method, payload = {}) =>
      featureRegistry.invoke(featureId, method, payload, { sender: event.sender }),
    ));
}
export default { register: register };
