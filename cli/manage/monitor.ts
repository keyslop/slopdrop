import type { SlopDropConfig } from '../config.js';
import { execRemote } from '../infra/ssh.js';
import { icons, success, error as errorText, warn, makeTable, dim, bold } from '../wizard/ui.js';
import { showPrompt } from '../prompts/render.js';
import { detectPlatform, osVersion } from '../infra/platform.js';

interface DiagResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}

async function runDiag(
  host: string,
  user: string,
  name: string,
  command: string,
  check: (stdout: string) => DiagResult
): Promise<DiagResult> {
  try {
    const result = await execRemote({ host, username: user }, command);
    return check(result.stdout);
  } catch (e) {
    return { name, status: 'error', detail: (e as Error).message };
  }
}

export async function runDiagnostics(config: SlopDropConfig): Promise<void> {
  if (!config.server_ip) {
    console.log(dim('\n  Diagnostics are only available for remote servers.\n'));
    return;
  }

  console.log(`\n  ${icons.info} ${bold('Full diagnostics for ' + config.server_ip)}\n`);

  const host = config.server_ip;
  const user = 'root';

  const diags: DiagResult[] = [];

  // Run diagnostics
  diags.push(await runDiag(host, user, 'Docker', 'docker ps --filter name=slopdrop --format "{{.Status}}"',
    (out) => {
      if (out.includes('Up')) return { name: 'Docker', status: 'ok', detail: out.trim() };
      return { name: 'Docker', status: 'error', detail: out.trim() || 'Container not running' };
    }
  ));

  diags.push(await runDiag(host, user, 'Nginx', 'systemctl is-active nginx',
    (out) => {
      if (out.trim() === 'active') return { name: 'Nginx', status: 'ok', detail: 'running' };
      return { name: 'Nginx', status: 'error', detail: out.trim() };
    }
  ));

  diags.push(await runDiag(host, user, 'API Health', 'curl -sf http://localhost:3847/api/health',
    (out) => {
      try {
        const data = JSON.parse(out);
        if (data.ok) return { name: 'API Health', status: 'ok', detail: `${data.count} recordings` };
      } catch {}
      return { name: 'API Health', status: 'error', detail: 'unreachable' };
    }
  ));

  diags.push(await runDiag(host, user, 'Disk', 'df -h / | tail -1',
    (out) => {
      const parts = out.trim().split(/\s+/);
      const usePercent = parseInt(parts[4], 10);
      if (usePercent > 90) return { name: 'Disk', status: 'error', detail: `${parts[4]} used (${parts[3]} free)` };
      if (usePercent > 75) return { name: 'Disk', status: 'warn', detail: `${parts[4]} used (${parts[3]} free)` };
      return { name: 'Disk', status: 'ok', detail: `${parts[4]} used (${parts[3]} free)` };
    }
  ));

  diags.push(await runDiag(host, user, 'Ports', 'ss -tlnp | grep -E "3847|:80|:443"',
    (out) => {
      const lines = out.trim().split('\n').filter(Boolean);
      if (lines.length >= 2) return { name: 'Ports', status: 'ok', detail: `${lines.length} listeners` };
      return { name: 'Ports', status: 'warn', detail: `${lines.length} listeners` };
    }
  ));

  // Display results
  const statusIcon = (s: DiagResult['status']) => {
    switch (s) {
      case 'ok': return success('OK');
      case 'warn': return warn('WARN');
      case 'error': return errorText('FAIL');
    }
  };

  console.log(makeTable(
    ['Check', 'Status', 'Details'],
    diags.map(d => [d.name, statusIcon(d.status), d.detail])
  ));

  const hasErrors = diags.some(d => d.status === 'error');

  if (hasErrors) {
    console.log();
    showPrompt('debug-server.md', {
      server_ip: config.server_ip,
      ssh_user: user,
      endpoint: config.endpoint,
      domain: config.domain || '(none)',
      error_message: diags.filter(d => d.status === 'error').map(d => `${d.name}: ${d.detail}`).join('; '),
      platform: detectPlatform(),
      os_version: osVersion(),
    });
  }

  console.log();
}
