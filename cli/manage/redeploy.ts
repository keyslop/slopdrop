import type { SlopDropConfig } from '../config.js';
import { updateConfig } from '../config.js';
import type { WizardPrompter } from '../wizard/prompter.js';
import { icons, success, error as errorText, dim, bold } from '../wizard/ui.js';
import { writeInventory, runPyinfra } from '../infra/pyinfra.js';

export async function runRedeploy(config: SlopDropConfig, p: WizardPrompter): Promise<void> {
  if (!config.server_ip) {
    console.log(dim('\n  Redeploy is only for remote servers.\n'));
    return;
  }

  console.log();
  console.log(`  ${icons.rocket} ${bold('Redeploy to ' + config.server_ip)}`);
  if (config.deployed_at) {
    console.log(dim(`  Last deploy: ${config.deployed_at.slice(0, 19).replace('T', ' ')}`));
  }
  console.log();

  const proceed = await p.confirm({
    message: 'Deploy latest code + config to server?',
    initialValue: true,
  });
  if (!proceed) return;

  writeInventory({
    host: config.server_ip,
    ssh_user: config.ssh_user || 'root',
    domain: config.domain,
    token: config.token,
  });

  const spinner = p.spinner();
  spinner.start('Deploying to server...');

  const result = await runPyinfra('deploy.py', (line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') || trimmed.includes('Success')) {
      spinner.message(trimmed.slice(0, 60));
    }
  });

  if (result.success) {
    const now = new Date().toISOString();
    updateConfig({ deployed_at: now });
    spinner.stop(success('Deployed'));
    console.log(dim(`  ${now.slice(0, 19).replace('T', ' ')}`));
  } else {
    spinner.stop(errorText('Deploy failed'));
    console.log();
    const lines = result.output.split('\n').filter(Boolean);
    lines.slice(-15).forEach(l => console.log(dim(`    ${l}`)));

    const { showPrompt } = await import('../prompts/render.js');
    const { detectPlatform, osVersion } = await import('../infra/platform.js');
    showPrompt('fix-deploy.md', {
      server_ip: config.server_ip,
      ssh_user: config.ssh_user || 'root',
      domain: config.domain || '(none)',
      error_message: lines.slice(-5).join('\n'),
      platform: detectPlatform(),
      os_version: osVersion(),
    });
  }

  console.log();
}
