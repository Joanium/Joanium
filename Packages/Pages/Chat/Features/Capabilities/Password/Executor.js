import { createExecutor } from '../Shared/createExecutor.js';
import {
  generatePassword,
  generatePassphrase,
  generatePin,
  generateMemorable,
  strengthLabel,
} from './Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'PasswordExecutor',
  tools: toolsList,
  handlers: {
    generate_password: async (params, onStage) => {
      const type = String(params.type ?? 'password').toLowerCase(),
        count = Math.min(Math.max(1, Number(params.count) || 1), 10),
        includeSymbols = !1 !== params.include_symbols,
        includeNumbers = !1 !== params.include_numbers,
        includeUppercase = !1 !== params.include_uppercase;
      onStage(`🔐 Generating ${count > 1 ? count + ' ' : ''}${type}${count > 1 ? 's' : ''}…`);
      const passwords = [];
      if ('passphrase' === type) {
        const wordCount = Math.min(Math.max(2, Number(params.length) || 4), 10);
        for (let i = 0; i < count; i++) passwords.push(generatePassphrase(wordCount));
      } else if ('pin' === type) {
        const len = Math.min(Math.max(4, Number(params.length) || 6), 20);
        for (let i = 0; i < count; i++) passwords.push(generatePin(len));
      } else if ('memorable' === type) {
        const len = Math.min(Math.max(6, Number(params.length) || 10), 20);
        for (let i = 0; i < count; i++) passwords.push(generateMemorable(len));
      } else {
        const len = Math.min(Math.max(4, Number(params.length) || 16), 128);
        for (let i = 0; i < count; i++)
          passwords.push(generatePassword(len, includeSymbols, includeNumbers, includeUppercase));
      }
      const lines = [
        `🔐 Generated ${type.charAt(0).toUpperCase() + type.slice(1)}${count > 1 ? 's' : ''}`,
        '',
      ];
      if (1 === count) {
        const pw = passwords[0];
        if (
          (lines.push('```'),
          lines.push(pw),
          lines.push('```'),
          lines.push(''),
          'password' === type || 'memorable' === type)
        ) {
          (lines.push(`Strength: ${strengthLabel(pw)}`),
            lines.push(`Length: ${pw.length} characters`));
          const entropy = Math.floor(
            pw.length *
              Math.log2(
                (includeUppercase ? 26 : 0) +
                  (includeNumbers ? 10 : 0) +
                  (includeSymbols && 'password' === type ? 28 : 0) +
                  26,
              ),
          );
          lines.push(`Estimated entropy: ~${entropy} bits`);
        }
      } else
        passwords.forEach((pw, i) => {
          (lines.push(`${i + 1}. \`${pw}\``),
            'password' === type && lines.push(`   ${strengthLabel(pw)}`));
        });
      return (
        lines.push(''),
        lines.push(
          '⚠️ Store passwords in a password manager (Bitwarden, 1Password, etc.) — never in plain text.',
        ),
        lines.join('\n')
      );
    },
  },
});
