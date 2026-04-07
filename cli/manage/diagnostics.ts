import type { SlopDropConfig } from '../config.js';
import { execRemote } from '../infra/ssh.js';
import { icons, success, error as errorText, warn, makeTable, dim, bold } from '../wizard/ui.js';
import { showPrompt } from '../prompts/render.js';
import { detectPlatform, osVersion } from '../infra/platform.js';

interface Check {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
  raw?: string;
}

export async function runDiagnostics(config: SlopDropConfig): Promise<void> {
  console.log();

  // --- Local checks (always run) ---
  const checks: Check[] = [];

  // 1. API reachability from local machine
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${config.endpoint}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      checks.push({
        name: 'API',
        status: 'ok',
        detail: `${data.count} recordings, ${data.active_streams || 0} streams`,
      });
    } else {
      checks.push({ name: 'API', status: 'error', detail: `HTTP ${res.status}` });
    }
  } catch (e) {
    checks.push({
      name: 'API',
      status: 'error',
      detail: `unreachable at ${config.endpoint}`,
      raw: (e as Error).message,
    });
  }

  // --- Remote checks (if we have SSH access) ---
  if (config.mode === 'remote' && config.server_ip) {
    const host = config.server_ip;
    const user = config.ssh_user || 'root';

    console.log(`  ${icons.server} ${bold('Diagnostics for ' + host)}`);
    console.log();

    // 2. SSH connectivity
    try {
      const sshTest = await execRemote({ host, username: user }, 'echo ok');
      if (sshTest.stdout.trim() === 'ok') {
        checks.push({ name: 'SSH', status: 'ok', detail: `${user}@${host}` });
      } else {
        checks.push({ name: 'SSH', status: 'error', detail: 'unexpected response' });
      }
    } catch (e) {
      checks.push({ name: 'SSH', status: 'error', detail: (e as Error).message });
      // Can't do remote checks without SSH
      printResults(checks, config);
      return;
    }

    // 3. Docker container
    try {
      const docker = await execRemote({ host, username: user },
        "docker ps --filter name=slopdrop --format '{{.Names}} {{.Status}}'"
      );
      const out = docker.stdout.trim();
      if (out.includes('Up')) {
        checks.push({ name: 'Docker', status: 'ok', detail: out });
      } else if (out) {
        checks.push({ name: 'Docker', status: 'error', detail: out });
      } else {
        checks.push({ name: 'Docker', status: 'error', detail: 'no container found' });
      }
    } catch (e) {
      checks.push({ name: 'Docker', status: 'error', detail: (e as Error).message });
    }

    // 4. Container health (internal API check)
    try {
      const health = await execRemote({ host, username: user },
        'curl -sf http://localhost:3847/api/health 2>&1'
      );
      if (health.stdout.includes('"ok":true')) {
        checks.push({ name: 'Internal API', status: 'ok', detail: 'localhost:3847 healthy' });
      } else {
        checks.push({ name: 'Internal API', status: 'error', detail: health.stdout.trim() || 'unreachable' });
      }
    } catch {
      checks.push({ name: 'Internal API', status: 'error', detail: 'unreachable' });
    }

    // 5. Nginx
    try {
      const nginx = await execRemote({ host, username: user }, 'systemctl is-active nginx');
      checks.push({
        name: 'Nginx',
        status: nginx.stdout.trim() === 'active' ? 'ok' : 'error',
        detail: nginx.stdout.trim(),
      });
    } catch {
      checks.push({ name: 'Nginx', status: 'error', detail: 'not running' });
    }

    // 6. Disk
    try {
      const disk = await execRemote({ host, username: user }, 'df -h / | tail -1');
      const parts = disk.stdout.trim().split(/\s+/);
      const usePct = parseInt(parts[4], 10);
      checks.push({
        name: 'Disk',
        status: usePct > 90 ? 'error' : usePct > 75 ? 'warn' : 'ok',
        detail: `${parts[4]} used (${parts[3]} free of ${parts[1]})`,
      });
    } catch {}

    // 7. Memory
    try {
      const mem = await execRemote({ host, username: user }, "free -h | awk '/Mem:/{print $3\"/\"$2}'");
      checks.push({ name: 'Memory', status: 'ok', detail: mem.stdout.trim() });
    } catch {}

    // 8. Recent container logs (last 5 lines — show errors if any)
    try {
      const logs = await execRemote({ host, username: user },
        'docker logs slopdrop-slopdrop-1 --tail 5 2>&1'
      );
      const logLines = logs.stdout.trim();
      const hasError = /error|Error|ERR|FATAL|panic/i.test(logLines);
      if (hasError) {
        checks.push({ name: 'Logs', status: 'warn', detail: 'errors in recent logs', raw: logLines });
      } else if (logLines) {
        checks.push({ name: 'Logs', status: 'ok', detail: 'no errors in recent logs' });
      }
    } catch {}

    // 9. SSL cert (if domain)
    if (config.domain) {
      try {
        const ssl = await execRemote({ host, username: user },
          `echo | openssl s_client -connect ${config.domain}:443 -servername ${config.domain} 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null`
        );
        const match = ssl.stdout.match(/notAfter=(.+)/);
        if (match) {
          const expiry = new Date(match[1]);
          const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86400000);
          checks.push({
            name: 'SSL',
            status: daysLeft < 7 ? 'error' : daysLeft < 30 ? 'warn' : 'ok',
            detail: `expires in ${daysLeft} days (${match[1].trim()})`,
          });
        } else {
          checks.push({ name: 'SSL', status: 'error', detail: 'no certificate found' });
        }
      } catch {
        checks.push({ name: 'SSL', status: 'error', detail: 'check failed' });
      }
    }
  } else {
    // Local mode — simpler checks
    console.log(`  ${icons.server} ${bold('Diagnostics')}`);
    console.log();
  }

  printResults(checks, config);
}

function printResults(checks: Check[], config: SlopDropConfig): void {
  const statusIcon = (s: Check['status']) => {
    switch (s) {
      case 'ok': return success('OK');
      case 'warn': return warn('WARN');
      case 'error': return errorText('FAIL');
    }
  };

  console.log(makeTable(
    ['Check', 'Status', 'Details'],
    checks.map(c => [c.name, statusIcon(c.status), c.detail])
  ));

  // Show raw output for warnings/errors
  const problems = checks.filter(c => c.raw && c.status !== 'ok');
  if (problems.length > 0) {
    console.log();
    for (const p of problems) {
      console.log(dim(`  [${p.name}]`));
      p.raw!.split('\n').forEach(l => console.log(dim(`    ${l}`)));
    }
  }

  const hasErrors = checks.some(c => c.status === 'error');
  if (hasErrors && config.mode === 'remote' && config.server_ip) {
    console.log();
    showPrompt('debug-server.md', {
      server_ip: config.server_ip,
      ssh_user: config.ssh_user || 'root',
      endpoint: config.endpoint,
      domain: config.domain || '(none)',
      error_message: checks.filter(c => c.status === 'error').map(c => `${c.name}: ${c.detail}`).join('; '),
      platform: detectPlatform(),
      os_version: osVersion(),
    });
  }

  console.log();
}
