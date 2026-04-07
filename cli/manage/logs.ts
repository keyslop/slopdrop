import type { SlopDropConfig } from '../config.js';
import { execRemote } from '../infra/ssh.js';
import { icons, dim, error as errorText } from '../wizard/ui.js';
import { showPrompt } from '../prompts/render.js';
import { detectPlatform, osVersion } from '../infra/platform.js';

export async function viewLogs(config: SlopDropConfig): Promise<void> {
  if (!config.server_ip) {
    console.log(dim('\n  Logs are only available for remote servers.\n'));
    return;
  }

  console.log(`\n  ${icons.server} Recent logs from ${config.server_ip}:\n`);

  try {
    const result = await execRemote(
      { host: config.server_ip, username: config.domain ? 'root' : 'root' },
      'docker logs slopdrop --tail 50 2>&1'
    );

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        console.log(dim(`    ${line}`));
      });
    }
    if (result.stderr) {
      result.stderr.split('\n').forEach(line => {
        console.log(dim(`    ${line}`));
      });
    }
  } catch (e) {
    console.log(`  ${errorText('Failed to fetch logs')}`);
    console.log(dim(`    ${(e as Error).message}`));
    console.log();

    showPrompt('debug-server.md', {
      server_ip: config.server_ip,
      ssh_user: 'root',
      endpoint: config.endpoint,
      domain: config.domain || '(none)',
      error_message: (e as Error).message,
      platform: detectPlatform(),
      os_version: osVersion(),
    });
  }

  console.log();
}
