const WORDS = [
  'apple',
  'brave',
  'cloud',
  'dance',
  'eagle',
  'flame',
  'grace',
  'happy',
  'ivory',
  'jazzy',
  'karma',
  'lemon',
  'maple',
  'noble',
  'ocean',
  'piano',
  'quest',
  'river',
  'solar',
  'tiger',
  'ultra',
  'vivid',
  'waves',
  'xenon',
  'yield',
  'zebra',
  'amber',
  'blaze',
  'coral',
  'drift',
  'ember',
  'frost',
  'globe',
  'haste',
  'ideal',
  'jewel',
  'khaki',
  'lunar',
  'misty',
  'night',
  'olive',
  'pearl',
  'quartz',
  'ridge',
  'stone',
  'torch',
  'umbra',
  'vault',
  'winds',
  'xceed',
  'young',
  'zesty',
  'adobe',
  'beach',
  'cedar',
  'delta',
  'elite',
  'forge',
  'gleam',
  'hawk',
  'inbox',
  'joker',
  'kneel',
  'lance',
  'magic',
  'nexus',
  'orbit',
  'pixel',
  'query',
  'rally',
  'shiny',
  'tidal',
  'unity',
  'vapor',
  'waltz',
  'xylem',
  'yacht',
  'zones',
  'acorn',
  'blend',
  'charm',
  'depot',
  'enter',
  'flint',
  'giant',
  'holly',
  'input',
  'judge',
  'kinky',
  'lodge',
  'micro',
  'north',
  'onion',
  'plumb',
  'quiet',
  'rocky',
  'swing',
  'trend',
  'upper',
  'venom',
];
function randomInt(max) {
  const [v] = (function () {
    if ('function' == typeof globalThis.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      return (globalThis.crypto.getRandomValues(arr), Array.from(arr));
    }
    return Array.from({ length: 1 }, () => Math.floor(4294967295 * Math.random()));
  })();
  return v % max;
}
export function generatePassword(length, useSymbols, useNumbers, useUppercase) {
  const lower = 'abcdefghijklmnopqrstuvwxyz',
    upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  let chars = lower;
  const required = [lower[randomInt(26)]];
  (useUppercase && ((chars += upper), required.push(upper[randomInt(26)])),
    useNumbers && ((chars += '0123456789'), required.push('0123456789'[randomInt(10)])),
    useSymbols && ((chars += symbols), required.push(symbols[randomInt(26)])));
  const remaining = Array.from(
      { length: length - required.length },
      () => chars[randomInt(chars.length)],
    ),
    all = [...required, ...remaining];
  for (let i = all.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join('');
}
export function generatePassphrase(wordCount, separator = '-') {
  const words = Array.from({ length: wordCount }, () => {
      const w = WORDS[randomInt(WORDS.length)];
      return w.charAt(0).toUpperCase() + w.slice(1);
    }),
    num = randomInt(999) + 1;
  return [...words, String(num)].join(separator);
}
export function generatePin(length) {
  return Array.from({ length: length }, () => randomInt(10)).join('');
}
export function generateMemorable(length) {
  let result = '';
  for (let i = 0; i < length; i++)
    result += i % 2 == 0 ? 'bcdfghjklmnprstvwxyz'[randomInt(20)] : 'aeiou'[randomInt(5)];
  return result;
}
export function strengthLabel(password) {
  let score = 0;
  return (
    password.length >= 12 && score++,
    password.length >= 16 && score++,
    /[A-Z]/.test(password) && score++,
    /[0-9]/.test(password) && score++,
    /[^A-Za-z0-9]/.test(password) && score++,
    password.length >= 20 && score++,
    score <= 2 ? 'Weak ⚠️' : score <= 4 ? 'Good ✅' : 'Strong 💪'
  );
}
