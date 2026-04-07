import type { SlopDropConfig } from '../config.js';
import { icons, success, error as errorText, warn, makeTable, dim } from '../wizard/ui.js';

export async function showStatus(config: SlopDropConfig): Promise<void> {
  console.log();
  console.log(`  ${icons.server} Checking server health...`);
  console.log();

  if (config.mode === 'local') {
    // Check localhost
    try {
      const res = await fetch(`${config.endpoint}/api/health`);
      const data = await res.json() as Record<string, unknown>;

      console.log(makeTable(
        ['Check', 'Status'],
        [
          ['API', success('healthy')],
          ['Recordings', String(data.count || 0)],
          ['Disk Free', data.disk_free_gb ? `${data.disk_free_gb} GB` : 'N/A'],
          ['Last Recording', (data.last_recording_at as string) || 'none'],
        ]
      ));
    } catch {
      console.log(`  ${errorText('Server not reachable at ' + config.endpoint)}`);
      console.log(dim('  Start the server with: npm run server'));
    }
    return;
  }

  // Remote server
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${config.endpoint}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json() as Record<string, unknown>;

    console.log(makeTable(
      ['Check', 'Status'],
      [
        ['API', success('healthy')],
        ['Endpoint', config.endpoint],
        ['Recordings', String(data.count || 0)],
        ['Disk Free', data.disk_free_gb ? `${data.disk_free_gb} GB` : 'N/A'],
        ['Last Recording', (data.last_recording_at as string) || 'none'],
      ]
    ));
  } catch (e) {
    console.log(`  ${errorText('Server not reachable')}`);
    console.log(dim(`  Endpoint: ${config.endpoint}`));
    console.log(dim(`  Error: ${(e as Error).message}`));
    console.log();
    console.log(dim('  Use "Full diagnostics" for detailed troubleshooting.'));
  }

  console.log();
}
