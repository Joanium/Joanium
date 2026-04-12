import { ipcMain } from 'electron';
import { wrapHandler, wrapRead } from './IPCWrapper.js';
export const ipcMeta = { needs: ['marketplaceService'] };
export function register(marketplaceService) {
  (ipcMain.handle(
    'marketplace-get-config',
    wrapRead(() => ({
      origins: marketplaceService.getMarketplaceOrigins(),
      siteUrl: 'https://www.joanium.com/marketplace',
    })),
  ),
    ipcMain.handle(
      'marketplace-list-items',
      wrapHandler((payload) => marketplaceService.listItems(payload)),
    ),
    ipcMain.handle(
      'marketplace-get-item-detail',
      wrapHandler(async (payload) => ({ item: await marketplaceService.getItemDetail(payload) })),
    ),
    ipcMain.handle(
      'marketplace-install-item',
      wrapHandler((payload) => marketplaceService.installItem(payload)),
    ));
}
