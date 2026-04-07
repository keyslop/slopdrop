import { loadConfig, updateConfig } from '../config.js';
import { createPrompter } from '../wizard/prompter.js';
import { BANNER, TAGLINE, icons, makeTable, dim, success } from '../wizard/ui.js';
import { runDiagnostics } from './diagnostics.js';
import { runUpgrade } from './upgrade.js';
import { runRedeploy } from './redeploy.js';

export async function runManage(): Promise<void> {
  const p = createPrompter();
  const config = loadConfig();

  console.log(BANNER);
  console.log(TAGLINE);

  // Status overview
  const rows: string[][] = [
    ['Mode', config.mode],
    ['Endpoint', config.endpoint],
  ];
  if (config.server_ip) rows.push(['Server IP', config.server_ip]);
  if (config.domain) rows.push(['Domain', config.domain]);
  if (config.deployed_at) rows.push(['Last deploy', config.deployed_at.slice(0, 19).replace('T', ' ')]);

  console.log(makeTable(['Setting', 'Value'], rows));
  console.log();

  // Build options based on mode
  const options: Array<{ value: string; label: string; hint?: string }> = [
    { value: 'diagnostics', label: `${icons.check} Diagnostics`, hint: 'check everything: API, Docker, nginx, disk, logs' },
    { value: 'qr', label: `${icons.mic} Show QR code`, hint: 'pair a new device' },
  ];

  if (config.mode === 'remote' && config.server_ip) {
    options.push(
      { value: 'redeploy', label: `${icons.rocket} Redeploy`, hint: 'push latest code to server' },
    );
  }

  options.push(
    { value: 'upgrade', label: `${icons.sparkles} Upgrade`, hint: 'git pull + npm install + redeploy' },
    { value: 'reconfigure', label: `${icons.arrow} Reconfigure`, hint: 'change server, domain, or token' },
    { value: 'quit', label: `  Quit` },
  );

  const action = await p.select({ message: 'What do you want to do?', options });

  switch (action) {
    case 'diagnostics':
      await runDiagnostics(config);
      break;
    case 'qr': {
      const { stepQr } = await import('../wizard/steps/qr.js');
      await stepQr(p, { mode: config.mode, token: config.token, endpoint: config.endpoint });
      break;
    }
    case 'redeploy':
      await runRedeploy(config, p);
      break;
    case 'upgrade':
      await runUpgrade(config, p);
      break;
    case 'reconfigure':
      await runReconfigure(config, p);
      break;
    case 'quit':
      break;
  }
}

async function runReconfigure(
  config: ReturnType<typeof loadConfig>,
  p: ReturnType<typeof createPrompter>,
): Promise<void> {
  console.log();
  console.log(dim('  Current config is preserved. Change only what you need.'));
  console.log();

  const what = await p.select({
    message: 'What do you want to change?',
    options: [
      { value: 'server', label: 'Server IP / SSH user' },
      { value: 'domain', label: 'Domain name' },
      { value: 'token', label: 'Regenerate auth token' },
      { value: 'full', label: 'Start fresh (full wizard)' },
      { value: 'back', label: 'Back' },
    ],
  });

  if (what === 'back') return;

  if (what === 'full') {
    const { runWizard } = await import('../wizard/index.js');
    await runWizard();
    return;
  }

  if (what === 'server') {
    const ip = await p.text({
      message: 'Server IP address',
      defaultValue: config.server_ip,
      placeholder: config.server_ip || '135.181.38.99',
    });
    const user = await p.text({
      message: 'SSH user',
      defaultValue: config.ssh_user || 'root',
      placeholder: config.ssh_user || 'root',
    });
    updateConfig({ server_ip: ip, ssh_user: user });
    console.log(`  ${success('Server updated: ' + ip)}`);
  }

  if (what === 'domain') {
    const domain = await p.text({
      message: 'Domain name',
      defaultValue: config.domain,
      placeholder: config.domain || 'voice.example.com',
    });
    const endpoint = domain.trim() ? `https://${domain}` : `http://${config.server_ip}`;
    updateConfig({ domain: domain.trim() || undefined, endpoint });
    console.log(`  ${success('Endpoint: ' + endpoint)}`);
  }

  if (what === 'token') {
    const crypto = await import('crypto');
    const token = 'sd_' + crypto.randomBytes(32).toString('hex');
    updateConfig({ token });
    console.log(`  ${success('New token: ' + token.slice(0, 12) + '...')}`);
    console.log(dim('  Re-scan QR on phone + Redeploy to update server.'));
  }

  console.log();
}
