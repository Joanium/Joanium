/**
 * Agent avatar generator — produces GitHub-style identicons.
 *
 * Visual spec (mirrors real GitHub identicons exactly):
 *  • Square canvas with subtle rounding (matches GitHub's avatar shape)
 *  • Solid background color derived from seed (HSL, constrained ranges)
 *  • 5×5 symmetric pixel grid — columns 0‑2 are generated, column 3 mirrors
 *    col 1, column 4 mirrors col 0
 *  • Foreground cells: rgba(255,255,255,0.9)  ← near-white, like GitHub
 *  • No gradients, no glows, no variable opacity — flat and clean
 */

function fnv1a(value = '') {
  let hash = 2166136261;
  for (const char of String(value ?? '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Produce a sequence of pseudo-random bytes from a seed string.
 * We derive multiple 32-bit hashes by appending an index, then split
 * each into 4 bytes — giving us plenty of entropy for colour + grid.
 */
function seedBytes(seed, count) {
  const bytes = [];
  let i = 0;
  while (bytes.length < count) {
    const h = fnv1a(`${seed}:${i++}`);
    bytes.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
  }
  return bytes.slice(0, count);
}

/**
 * Generate the filled-cell map for a 5×5 symmetric grid.
 * Returns a flat 25-element boolean array, row-major.
 * Cells in columns 0‑2 are determined by bytes 0‑14 (one byte per cell).
 * Columns 3 and 4 are mirrors of columns 1 and 0 respectively.
 */
function buildGrid(bytes) {
  // We only need 15 bytes (5 rows × 3 unique cols)
  const grid = Array(25).fill(false);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const filled = (bytes[row * 3 + col] & 1) === 1; // odd byte → filled
      grid[row * 5 + col] = filled;
      // Mirror: col 3 ← col 1, col 4 ← col 0
      if (col < 2) grid[row * 5 + (4 - col)] = filled;
    }
  }
  return grid;
}

/**
 * Derive the background HSL colour from bytes 15–17.
 * Ranges are tuned to match GitHub's palette:
 *   hue  0–359  (full spectrum)
 *   sat  45–70%
 *   lit  50–65%
 */
function deriveColor(bytes) {
  const hue = (((bytes[15] | (bytes[16] << 8)) % 360) + 360) % 360;
  const sat = 45 + (bytes[17] % 26); // 45–70 %
  const lit = 50 + (bytes[18] % 16); // 50–65 %
  return `hsl(${hue} ${sat}% ${lit}%)`;
}

export function createAgentAvatarSvg(seed = '', size = 72) {
  const normalizedSeed =
    String(seed ?? '')
      .trim()
      .toLowerCase() || 'agent';

  // We need 19 bytes: 15 for the grid + 4 for the colour
  const bytes = seedBytes(normalizedSeed, 19);
  const grid = buildGrid(bytes);
  const bgColor = deriveColor(bytes);

  // Grid geometry — 5×5 cells inside a 96×96 canvas
  // Padding: 16px each side → 64px usable → cell = 12px, gap = 1px (64 / (5*12 + 4*1) ≈ 1)
  // Simplified: cell = 12, gap = 2, total = 5*12 + 4*2 = 68, offset = (96-68)/2 = 14
  const CELL = 12;
  const GAP = 2;
  const OFFSET = (96 - (5 * CELL + 4 * GAP)) / 2; // = 11

  const cells = grid
    .map((filled, i) => {
      if (!filled) return '';
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = OFFSET + col * (CELL + GAP);
      const y = OFFSET + row * (CELL + GAP);
      return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="1" fill="rgba(255,255,255,0.9)"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96" fill="none">
  <rect width="96" height="96" rx="18" fill="${bgColor}"/>
  ${cells}
</svg>`;
}

export function createAgentAvatarDataUri(seed = '', size = 72) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(createAgentAvatarSvg(seed, size))}`;
}
