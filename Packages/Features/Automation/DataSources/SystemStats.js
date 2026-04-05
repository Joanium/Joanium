import os from 'os';

export const type = 'system_stats';
export const meta = { label: 'System Stats', group: 'System' };
export async function collect() {
  const cpus = os.cpus(),
    total = os.totalmem(),
    free = os.freemem(),
    up = os.uptime();
  return [
    `System Stats (${new Date().toLocaleString()}):`,
    `Platform: ${process.platform} ${os.release()}`,
    `CPU: ${cpus[0]?.model?.trim()} (${cpus.length} cores)`,
    `Memory: ${(total / 1e9).toFixed(1)} GB total | ${(free / 1e9).toFixed(1)} GB free`,
    `Uptime: ${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`,
  ].join('\n');
}
