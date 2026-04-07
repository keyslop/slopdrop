import { loadConfig } from '../config.js';
import { createPrompter } from '../wizard/prompter.js';
import { BANNER, TAGLINE, icons, makeTable } from '../wizard/ui.js';
import { showStatus } from './status.js';
import { viewLogs } from './logs.js';
import { runDiagnostics } from './monitor.js';

export async function runManage(): Promise<void> {
  const p = createPrompter();
  const config = loadConfig();

  console.log(BANNER);
  console.log(TAGLINE);

  // Status overview
  console.log(makeTable(
    ['Setting', 'Value'],
    [
      ['Mode', config.mode],
      ['Endpoint', config.endpoint],
      ...(config.server_ip ? [['Server IP', config.server_ip]] : []),
      ...(config.domain ? [['Domain', config.domain]] : []),
    ]
  ));
  console.log();

  const action = await p.select({
    message: 'What do you want to do?',
    options: [
      { value: 'status', label: `${icons.check} Server status`, hint: 'health check' },
      { value: 'qr', label: `${icons.mic} Show QR code`, hint: 'pair a new device' },
      { value: 'logs', label: `${icons.server} View logs`, hint: 'tail server logs' },
      { value: 'monitor', label: `${icons.info} Full diagnostics`, hint: 'Docker, nginx, disk, ports' },
      { value: 'reconfigure', label: `${icons.arrow} Reconfigure`, hint: 're-run setup wizard' },
      { value: 'quit', label: `  Quit` },
    ],
  });

  switch (action) {
    case 'status':
      await showStatus(config);
      break;
    case 'qr': {
      const { stepQr } = await import('../wizard/steps/qr.js');
      await stepQr(p, { mode: config.mode, token: config.token, endpoint: config.endpoint });
      break;
    }
    case 'logs':
      await viewLogs(config);
      break;
    case 'monitor':
      await runDiagnostics(config);
      break;
    case 'reconfigure': {
      const fs = await import('fs');
      const { configPath } = await import('../config.js');
      fs.unlinkSync(configPath());
      const { runWizard } = await import('../wizard/index.js');
      await runWizard();
      break;
    }
    case 'quit':
      break;
  }
}
