import { clipboard } from 'electron';

export function copyToClipboard(text) {
    if (text === undefined || text === null) throw new Error('copyToClipboard: no text provided');
    clipboard.writeText(String(text));
}

export const actionType = 'copy_to_clipboard';
export const actionMeta = {
  label: 'Copy to clipboard',
  group: 'System',
  fields: ['text'],
  requiredFields: ['text'],
};
export async function execute(action) {
  copyToClipboard(action.text);
}