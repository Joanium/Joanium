function hashString(value = '') {
  let hash = 2166136261;
  for (const char of String(value ?? '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hue(seed, offset = 0) {
  return ((hashString(`${seed}:${offset}`) % 360) + 360) % 360;
}

function point(seed, offset = 0, max = 100) {
  return hashString(`${seed}:${offset}`) % max;
}

function buildCells(seed = '') {
  const cells = [];
  for (let row = 0; row < 5; row += 1)
    for (let col = 0; col < 3; col += 1)
      if (1 === (hashString(`${seed}:${row}:${col}`) & 1)) {
        cells.push([col, row]);
        col < 2 && cells.push([4 - col, row]);
      }
  return cells;
}

export function createAgentAvatarSvg(seed = '', size = 72) {
  const normalizedSeed = String(seed ?? '').trim() || 'agent',
    primary = `hsl(${hue(normalizedSeed, 1)} 72% 54%)`,
    secondary = `hsl(${hue(normalizedSeed, 2)} 76% 42%)`,
    accent = `hsl(${hue(normalizedSeed, 3)} 78% 66%)`,
    cells = buildCells(normalizedSeed)
      .map(
        ([x, y], index) =>
          `<rect x="${12 + x * 14}" y="${12 + y * 14}" width="12" height="12" rx="${2 + (index % 3)}" fill="${index % 4 === 0 ? accent : primary}" opacity="${0.82 + (index % 3) * 0.06}"/>`,
      )
      .join(''),
    orbX = 20 + point(normalizedSeed, 11, 36),
    orbY = 18 + point(normalizedSeed, 12, 36),
    orbR = 10 + point(normalizedSeed, 13, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96" fill="none">
    <defs>
      <linearGradient id="bg" x1="8" y1="10" x2="88" y2="90" gradientUnits="userSpaceOnUse">
        <stop stop-color="${primary}"/>
        <stop offset="1" stop-color="${secondary}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${orbX} ${orbY}) rotate(90) scale(${orbR} ${orbR})">
        <stop stop-color="white" stop-opacity="0.7"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect x="4" y="4" width="88" height="88" rx="24" fill="url(#bg)"/>
    <rect x="10" y="10" width="76" height="76" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
    <circle cx="${orbX}" cy="${orbY}" r="${orbR}" fill="url(#glow)"/>
    ${cells}
  </svg>`;
}

export function createAgentAvatarDataUri(seed = '', size = 72) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(createAgentAvatarSvg(seed, size))}`;
}
