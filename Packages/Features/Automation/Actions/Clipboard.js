import { clipboard } from 'electron';

export function copyToClipboard(text) {
    if (text === undefined || text === null) throw new Error('copyToClipboard: no text provided');
    clipboard.writeText(String(text));
}