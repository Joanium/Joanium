import { ipcMain } from 'electron';
import crypto from 'crypto';
import * as AppLockService from '../Services/AppLockService.js';
import { wrapHandler } from './IPCWrapper.js';

export const ipcMeta = { needs: [] };

const resetTokens = new Set();

export function register() {
  ipcMain.on('app-lock-activity', () => {
    AppLockService.markActivity();
  });

  ipcMain.handle(
    'setup-app-lock',
    wrapHandler((payload = {}) => AppLockService.setupAppLock(payload)),
  );

  ipcMain.handle(
    'verify-system-password',
    wrapHandler(async (password) => AppLockService.verifyPassword(password)),
  );

  ipcMain.handle(
    'get-app-lock-question',
    wrapHandler(() => ({
      ok: true,
      question: AppLockService.getRecoveryQuestion(),
    })),
  );

  ipcMain.handle(
    'verify-app-lock-answer',
    wrapHandler((answer) => {
      const verification = AppLockService.verifyRecoveryAnswer(answer);
      if (!verification.ok) return verification;

      const token = crypto.randomBytes(16).toString('hex');
      resetTokens.add(token);
      setTimeout(() => resetTokens.delete(token), 5 * 60 * 1000);
      return { ok: true, resetToken: token };
    }),
  );

  ipcMain.handle(
    'reset-app-lock-password',
    wrapHandler(({ token, newPassword } = {}) => {
      if (!resetTokens.has(token)) {
        return {
          ok: false,
          error: 'Reset link expired. Please answer the security question again.',
        };
      }

      const result = AppLockService.resetPassword(newPassword);
      if (result.ok) resetTokens.delete(token);
      return result;
    }),
  );

  ipcMain.handle(
    'disable-app-lock',
    wrapHandler((password) => AppLockService.disableAppLock(password)),
  );

  ipcMain.handle(
    'unlock-app',
    wrapHandler(() => AppLockService.unlockApp()),
  );
}
