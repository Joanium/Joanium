/**
 * Minify.mjs — In-place minification for HTML, CSS, and JS files.
 *
 * Usage:
 *   import { minifyAll } from './Minify.mjs';
 *   await minifyAll(rootDir);
 *
 * Can also be run standalone:
 *   node Scripts/Minify.mjs          — minify in-place
 *   node Scripts/Minify.mjs --dry    — preview which files would be minified
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import CleanCSS from 'clean-css';
import { minify as minifyHTML } from 'html-minifier-terser';
import { minify as minifyJS } from 'terser';

// ── Configuration ──────────────────────────────────────────────────────────────

/** Directories (relative to project root) that contain packaged source files. */
const SOURCE_TARGETS = ['App.js', 'Core', 'Packages'];

/** Directory names to skip during traversal. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'test', 'tests', '__tests__']);

/** File extensions we handle. */
const SUPPORTED_EXTS = new Set(['.js', '.css', '.html']);

/** Shared CleanCSS instance. */
const cleanCSS = new CleanCSS({
  level: {
    1: { all: true },
    2: { restructureRules: true },
  },
});

// ── File collection ────────────────────────────────────────────────────────────

/**
 * Recursively collects file paths matching the supported extensions.
 * @param {string} target  Absolute path to a file or directory.
 * @returns {string[]}
 */
function collectFiles(target) {
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) return [];

  if (stat.isFile()) {
    return SUPPORTED_EXTS.has(path.extname(target).toLowerCase()) ? [target] : [];
  }

  if (!stat.isDirectory()) return [];

  const results = [];
  for (const entry of fs.readdirSync(target)) {
    if (SKIP_DIRS.has(entry)) continue;
    results.push(...collectFiles(path.join(target, entry)));
  }
  return results;
}

// ── Minification per file type ─────────────────────────────────────────────────

async function processJS(content) {
  const result = await minifyJS(content, {
    module: true,
    compress: {
      passes: 2,
      dead_code: true,
      drop_console: false, // keep console.* — useful for Electron diagnostics
    },
    mangle: false,
    format: {
      comments: false,
    },
  });
  return result.code;
}

function processCSS(content) {
  const result = cleanCSS.minify(content);
  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors.join('; '));
  }
  return result.styles;
}

async function processHTML(content) {
  return minifyHTML(content, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: {
      module: true,
      compress: { passes: 1 },
      mangle: false,
    },
  });
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Minifies all HTML, CSS, and JS files under the source targets.
 * Files are overwritten in-place.
 *
 * @param {string} rootDir  Absolute path to the project root.
 * @param {{ dry?: boolean }} [opts]
 */
export async function minifyAll(rootDir, opts = {}) {
  const { dry = false } = opts;
  let totalSavedBytes = 0;

  // Resolve absolute paths for all targets.
  const targets = SOURCE_TARGETS.map((t) => path.resolve(rootDir, t));

  // Collect every eligible file.
  const files = targets.flatMap(collectFiles);

  console.log(`[Minify] Found ${files.length} files to process in ${rootDir}`);

  // Process files in batches to avoid overwhelming the event loop.
  const BATCH = 50;
  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const original = fs.readFileSync(filePath, 'utf8');

        // Skip already-minified files (heuristic: .min.js / .min.css).
        const base = path.basename(filePath);
        if (base.includes('.min.')) {
          skipped++;
          return;
        }

        // Skip tiny files (< 64 bytes) — not worth the overhead.
        if (original.length < 64) {
          skipped++;
          return;
        }

        try {
          let minified;

          switch (ext) {
            case '.js':
              minified = await processJS(original);
              break;
            case '.css':
              minified = processCSS(original);
              break;
            case '.html':
              minified = await processHTML(original);
              break;
            default:
              return;
          }

          if (!minified || minified.length >= original.length) {
            // Minification didn't reduce size — skip to avoid risk.
            skipped++;
            return;
          }

          const savedBytes = Buffer.byteLength(original, 'utf8') - Buffer.byteLength(minified, 'utf8');

          if (dry) {
            const pct = ((savedBytes / Buffer.byteLength(original, 'utf8')) * 100).toFixed(1);
            console.log(`  ${path.relative(rootDir, filePath)}  ${savedBytes} bytes saved (${pct}%)`);
          } else {
            fs.writeFileSync(filePath, minified, 'utf8');
            totalSavedBytes += savedBytes;
          }

          processed++;
        } catch (err) {
          console.warn(`[Minify] SKIP ${path.relative(rootDir, filePath)}: ${err.message}`);
          skipped++;
        }
      }),
    );
  }

  console.log(
    `[Minify] Done. ${processed} minified, ${skipped} skipped.` +
      (!dry ? ` Total saved: ${(totalSavedBytes / 1024).toFixed(1)} KB` : ''),
  );
}

// ── Standalone execution ────────────────────────────────────────────────────────

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'Minify.mjs');

if (isMain) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dry = process.argv.includes('--dry');

  if (dry) {
    console.log('[Minify] Dry run — no files will be modified.\n');
  }

  await minifyAll(rootDir, { dry });
}
