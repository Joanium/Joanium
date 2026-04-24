import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ensureStaticSystemInfo } from '../../Main/Services/SystemInfoService.js';
import { LANGUAGES_BY_CODE } from '../Languages.js';

const __filename = fileURLToPath(import.meta.url),
  __dirname = path.dirname(__filename),
  PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

let _cachedStaticInfo = null;
let _cachedFsInfo = null;

function normalizeSection(section) {
  return section
    ? 'string' == typeof section
      ? { title: 'Additional Context', body: section }
      : 'object' == typeof section && section.title && section.body
        ? { title: section.title, body: section.body }
        : null
    : null;
}

function normalizeForComparison(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shell(cmd) {
  try {
    return execSync(cmd, { timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function fmtBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024,
    sizes = ['B', 'KB', 'MB', 'GB', 'TB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}

function fmtUptime(seconds) {
  const d = Math.floor(seconds / 86400),
    h = Math.floor((seconds % 86400) / 3600),
    m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '__pycache__',
  '.cache',
  'venv',
  '.venv',
  'env',
  '.npm',
  '.yarn',
  '.pnpm-store',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'Caches',
  'Cache',
  'Logs',
  'Log',
  'Temp',
  'tmp',
  '$Recycle.Bin',
  'System Volume Information',
  'Recovery',
  'lost+found',
]);

function readDirShallow(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const dirs = [];
    let fileCount = 0;
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) dirs.push(e.name);
      } else {
        fileCount++;
      }
    }
    return { dirs, fileCount };
  } catch {
    return null;
  }
}

function buildTree(rootPath, maxDepth = 2, maxItems = 12, _depth = 0, _prefix = '') {
  if (_depth >= maxDepth) return [];
  const result = readDirShallow(rootPath);
  if (!result) return [];

  const lines = [];
  const { dirs, fileCount } = result;
  const shown = dirs.slice(0, maxItems);
  const hiddenCount = dirs.length - shown.length;

  for (let i = 0; i < shown.length; i++) {
    const isLast = i === shown.length - 1 && hiddenCount === 0;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = _prefix + (isLast ? '    ' : '│   ');
    const childPath = path.join(rootPath, shown[i]);
    lines.push(`${_prefix}${connector}${shown[i]}/`);
    const childLines = buildTree(childPath, maxDepth, maxItems, _depth + 1, childPrefix);
    lines.push(...childLines);
  }

  if (hiddenCount > 0) {
    lines.push(
      `${_prefix}└── … (${hiddenCount} more director${hiddenCount === 1 ? 'y' : 'ies'} hidden)`,
    );
  }

  if (_depth === 0 && fileCount > 0) {
    lines.push(`${_prefix}    [+ ${fileCount} file${fileCount !== 1 ? 's' : ''} at root]`);
  }

  return lines;
}

async function collectFilesystemInfo() {
  if (_cachedFsInfo) return _cachedFsInfo;

  const platform = process.platform;
  const homeDir = os.homedir();

  let drives = [];

  if (platform === 'win32') {
    const raw = shell(
      'wmic logicaldisk get DeviceID,VolumeName,FileSystem,Size,FreeSpace /format:csv 2>nul',
    );
    if (raw) {
      const rows = raw.split('\n').filter((l) => l.trim() && !l.startsWith('Node'));
      for (const row of rows) {
        const [, device, free, fs_, , size, label] = row.split(',').map((s) => s?.trim());
        if (!device) continue;
        drives.push({
          mount: device,
          label: label || device,
          fs: fs_ || '?',
          total: parseInt(size) || 0,
          free: parseInt(free) || 0,
        });
      }
    }
  } else if (platform === 'darwin') {
    const raw = shell("df -k | grep -v 'devfs\\|map\\|tmpfs\\|fdesc'");
    if (raw) {
      for (const line of raw.split('\n').slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) continue;
        const mount = parts[parts.length - 1];
        if (mount === '/dev') continue;
        drives.push({
          mount,
          label: mount === '/' ? 'Macintosh HD' : path.basename(mount),
          fs: parts[0].startsWith('/dev') ? 'apfs/hfs' : parts[0],
          total: parseInt(parts[1]) * 1024,
          free: parseInt(parts[3]) * 1024,
        });
      }
    }
    try {
      const vols = fs.readdirSync('/Volumes', { withFileTypes: true });
      for (const v of vols) {
        if (v.isDirectory() || v.isSymbolicLink()) {
          const mp = `/Volumes/${v.name}`;
          if (!drives.find((d) => d.mount === mp)) {
            drives.push({ mount: mp, label: v.name, fs: 'external', total: 0, free: 0 });
          }
        }
      }
    } catch {}
  } else {
    const raw = shell('df -k --output=target,fstype,size,avail,source 2>/dev/null | tail -n +2');
    if (raw) {
      for (const line of raw.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;
        const [mount, fsType, size, avail] = parts;
        if (
          ['tmpfs', 'devtmpfs', 'overlay', 'squashfs', 'sysfs', 'proc', 'devfs', 'cgroup'].includes(
            fsType,
          )
        )
          continue;
        drives.push({
          mount,
          label: mount === '/' ? 'Root' : path.basename(mount),
          fs: fsType,
          total: parseInt(size) * 1024,
          free: parseInt(avail) * 1024,
        });
      }
    }
  }

  const knownDirs = [
    { key: 'Home', p: homeDir },
    { key: 'Desktop', p: path.join(homeDir, 'Desktop') },
    { key: 'Downloads', p: path.join(homeDir, 'Downloads') },
    { key: 'Documents', p: path.join(homeDir, 'Documents') },
    { key: 'Pictures', p: path.join(homeDir, 'Pictures') },
    { key: 'Videos', p: path.join(homeDir, 'Videos') },
    { key: 'Music', p: path.join(homeDir, 'Music') },
    { key: 'Projects', p: path.join(homeDir, 'Projects') },
    { key: 'Code', p: path.join(homeDir, 'Code') },
    { key: 'Dev', p: path.join(homeDir, 'dev') },
    { key: 'Repos', p: path.join(homeDir, 'repos') },
    { key: 'Sites', p: path.join(homeDir, 'Sites') },
    { key: 'Workspace', p: path.join(homeDir, 'Workspace') },
    { key: 'src', p: path.join(homeDir, 'src') },
    { key: 'OneDrive', p: path.join(homeDir, 'OneDrive') },
    {
      key: 'iCloudDrive',
      p: path.join(homeDir, 'Library', 'Mobile Documents', 'com~apple~CloudDocs'),
    },
  ].filter(({ p }) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });

  const homeTree = buildTree(homeDir, 2, 14);

  _cachedFsInfo = { drives, knownDirs, homeDir, homeTree };
  return _cachedFsInfo;
}

let systemPromptConfig = {};
try {
  const spPath = path.join(PROJECT_ROOT, 'SystemInstructions', 'SystemPrompt.json');
  fs.existsSync(spPath) && (systemPromptConfig = JSON.parse(fs.readFileSync(spPath, 'utf-8')));
} catch {}

// Read app version once at module load from package.json
let _appVersion = 'unknown';
try {
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  _appVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version ?? 'unknown';
} catch {}

const getConfig = (key, fallback = null) => systemPromptConfig[key] || fallback;

async function fetchGeoInfo() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal });
    if (res.ok) {
      const data = await res.json();
      return {
        country: data.country_name,
        city: data.city,
        region: data.region,
        ip: data.ip,
        isp: data.org,
      };
    }
  } catch {
  } finally {
    clearTimeout(timer);
  }
  return null;
}

async function collectSystemInfo() {
  if (!_cachedStaticInfo) {
    _cachedStaticInfo = await ensureStaticSystemInfo();
  }

  const geoInfo = await fetchGeoInfo();

  const release = os.release();
  const freeMem = os.freemem();
  const usedMem = _cachedStaticInfo.totalMem - freeMem;
  const loadAvg = os.loadavg().map((v) => v.toFixed(2));
  const uptimeSeconds = os.uptime();
  const networkInterfaces = os.networkInterfaces();
  const nodeVersion = process.version;

  const {
    osName,
    osVersion,
    arch,
    kernel,
    hostname,
    homeDir,
    tmpDir,
    totalMem,
    cpuModel,
    cpuCores,
    cpuSpeed,
    shell: shell_,
    username,
    locale,
    timezone,
    gpuInfo,
    screenRes,
  } = _cachedStaticInfo;

  const nets = {};
  for (const [iface, addrs] of Object.entries(networkInterfaces)) {
    const relevant = (addrs ?? []).filter(
      (a) => !a.internal && !a.address.startsWith('fe80') && !a.address.startsWith('169.254'),
    );
    if (relevant.length) nets[iface] = relevant.map((a) => `${a.address} (${a.family})`);
  }

  return {
    osName,
    osVersion,
    arch,
    release,
    kernel,
    hostname,
    homeDir,
    tmpDir,
    totalMem,
    freeMem,
    usedMem,
    cpuModel,
    cpuCores,
    cpuSpeed,
    loadAvg,
    uptimeSeconds,
    shell: shell_,
    userInfo: { username },
    nodeVersion,
    locale,
    timezone,
    gpuInfo,
    screenRes,
    nets,
    country: geoInfo,
    env: {
      TERM: process.env.TERM || null,
      TERM_PROGRAM: process.env.TERM_PROGRAM || null,
      EDITOR: process.env.EDITOR || process.env.VISUAL || null,
      LANG: process.env.LANG || null,
      PATH_entries: (process.env.PATH || '').split(path.delimiter).length,
    },
  };
}

export async function buildSystemPrompt({
  userName: userName = '',
  customInstructions: customInstructions = '',
  gmailEmail: gmailEmail = null,
  activePersona: activePersona = null,
  connectedServices: connectedServices = [],
  extraContextSections: extraContextSections = [],
  appLanguage: appLanguage = 'en',
} = {}) {
  const [sys, fsInfo] = await Promise.all([collectSystemInfo(), collectFilesystemInfo()]);

  const timeStr = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const lines = [];
  const push = (...args) => lines.push(...args);
  const blank = () => lines.push('');

  if (activePersona) {
    const personaInstructions = activePersona.instructions?.trim() ?? '',
      normalizedInstructions = normalizeForComparison(personaInstructions),
      personaIntro = `You are ${activePersona.name}.`;
    normalizedInstructions.includes(normalizeForComparison(personaIntro)) || push(personaIntro);
    activePersona.personality && push(`Your personality: ${activePersona.personality}.`);
    !personaInstructions && activePersona.description && push(activePersona.description);
    personaInstructions && (blank(), push(personaInstructions));
    blank();
    push('---');
    blank();
    getConfig('joaniumContext') && push(getConfig('joaniumContext'));
  } else {
    push(getConfig('joaniumPersona'));
  }

  const languageLabel = LANGUAGES_BY_CODE[appLanguage]?.label ?? 'English';

  blank();
  push('# Application');
  push(`- Joanium version: ${_appVersion}`);
  push(`- App language: ${languageLabel} (${appLanguage})`);
  if (appLanguage != 'en') {
    push(
      `- Language instruction: The user has set the app language to ${languageLabel}. Respond in ${languageLabel} by default unless the user writes to you in a different language, in which case match their language.`,
    );
  }

  blank();
  push('# User');
  push(`- Name: ${userName || sys.userInfo.username || 'User'}`);
  push(`- Local time: ${timeStr}`);
  push(
    `- Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
  );
  push(`- Locale: ${sys.locale}`);
  push(`- Timezone: ${sys.timezone}`);
  sys.shell && push(`- Shell: ${sys.shell}`);
  if (sys.country) {
    push(`- Country: ${sys.country.country}`);
    sys.country.city && push(`- City/Region: ${sys.country.city}, ${sys.country.region}`);
    sys.country.ip && push(`- IP Address: ${sys.country.ip}`);
    sys.country.isp && push(`- ISP/Org: ${sys.country.isp}`);
  }

  blank();
  push('# System — Operating System');
  push(`- Platform: ${sys.osName} ${sys.osVersion || sys.release}`);
  push(`- Architecture: ${sys.arch}`);
  push(`- Kernel: ${sys.kernel}`);
  push(`- Hostname: ${sys.hostname}`);
  push(`- Home directory: ${sys.homeDir}`);
  push(`- Temp directory: ${sys.tmpDir}`);
  sys.env.TERM_PROGRAM && push(`- Terminal emulator: ${sys.env.TERM_PROGRAM}`);
  sys.env.EDITOR && push(`- Default editor: ${sys.env.EDITOR}`);
  sys.env.LANG && push(`- System language: ${sys.env.LANG}`);

  blank();
  push('# System — Hardware');
  push(`- CPU: ${sys.cpuModel}`);
  push(`- CPU cores: ${sys.cpuCores}${sys.cpuSpeed ? ` @ ${sys.cpuSpeed}` : ''}`);
  push(`- Load averages (1/5/15 min): ${sys.loadAvg.join(' / ')}`);
  push(`- RAM total: ${fmtBytes(sys.totalMem)}`);
  push(
    `- RAM used: ${fmtBytes(sys.usedMem)} (${((sys.usedMem / sys.totalMem) * 100).toFixed(1)}%)`,
  );
  push(`- RAM free: ${fmtBytes(sys.freeMem)}`);
  if (Array.isArray(sys.gpuInfo) && sys.gpuInfo.length > 0) {
    push(`- GPU: ${sys.gpuInfo.join(', ')}`);
  } else if (sys.gpuInfo) {
    push(`- GPU: ${sys.gpuInfo}`);
  }
  sys.screenRes && push(`- Display resolution: ${sys.screenRes}`);
  push(`- System uptime: ${fmtUptime(sys.uptimeSeconds)}`);

  const netEntries = Object.entries(sys.nets);
  if (netEntries.length) {
    blank();
    push('# System — Network Interfaces');
    for (const [iface, addrs] of netEntries) {
      push(`- ${iface}: ${addrs.join(', ')}`);
    }
  }

  if (fsInfo.drives.length) {
    blank();
    push('# System — Drives & Volumes');
    for (const d of fsInfo.drives) {
      const used = d.total > 0 ? d.total - d.free : null;
      const pct = d.total > 0 ? ((used / d.total) * 100).toFixed(1) : null;
      const sizes =
        d.total > 0
          ? ` | ${fmtBytes(used)} used / ${fmtBytes(d.total)} (${pct}% full) | ${fmtBytes(d.free)} free`
          : '';
      push(`- [${d.mount}]  "${d.label}"  (${d.fs})${sizes}`);
    }
  }

  if (fsInfo.knownDirs.length) {
    blank();
    push('# System — Known Directories');
    push(
      'Confirmed directories that exist on this machine (agent can reference these paths directly):',
    );
    for (const { key, p } of fsInfo.knownDirs) {
      push(`- ${key}: ${p}`);
    }
  }

  blank();
  push('# System — Home Directory Tree');
  push(`Base path: ${fsInfo.homeDir}`);
  if (fsInfo.homeTree.length) {
    push('```');
    push(fsInfo.homeDir + '/');
    push(...fsInfo.homeTree);
    push('```');
    push('Note: dotfiles/dotfolders, node_modules, .git, build artifacts and caches are omitted.');
  } else {
    push('(Could not read home directory structure)');
  }

  blank();
  push('# User — Connected Services');
  const mergedConnectedServices = [...connectedServices];
  if (
    gmailEmail &&
    !mergedConnectedServices.some(
      (item) => item.includes('Google Workspace') || item.includes('Gmail'),
    )
  ) {
    mergedConnectedServices.push(`Gmail (${gmailEmail})`);
  }
  if (mergedConnectedServices.length) {
    push(`- ${[...new Set(mergedConnectedServices)].join('\n- ')}`);
  } else {
    push('- None');
  }

  for (const rawSection of extraContextSections) {
    const section = normalizeSection(rawSection);
    if (section) {
      blank();
      push(`## ${section.title}`);
      push(section.body.trim());
    }
  }

  if (customInstructions?.trim()) {
    blank();
    push('# Custom Instructions');
    push(customInstructions.trim());
  }

  blank();
  const seen = new Set();
  for (const entry of getConfig('finalInstructions', [])) {
    const text = String(entry ?? '').trim();
    if (!text) continue;
    const key = normalizeForComparison(text);
    if (key && !seen.has(key)) {
      seen.add(key);
      push(text);
    }
  }

  return lines.join('\n');
}
