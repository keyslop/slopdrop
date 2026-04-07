import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { writeInventory, runPyinfra } from '../../infra/pyinfra.js';
import { showPrompt } from '../../prompts/render.js';
import { icons, success, error as errorText, dim } from '../ui.js';
import { detectPlatform, osVersion } from '../../infra/platform.js';

export async function stepProvision(p: WizardPrompter, state: WizardState): Promise<boolean> {
  // Write inventory for pyinfra
  writeInventory({
    host: state.server_ip!,
    ssh_user: state.ssh_user || 'root',
    domain: state.domain,
    token: state.token,
  });

  const spinner = p.spinner();
  spinner.start('Provisioning server (Docker, nginx, firewall)...');

  const result = await runPyinfra('provision.py', (line) => {
    // Update spinner with pyinfra progress
    const trimmed = line.trim();
    if (trimmed.startsWith('[') || trimmed.includes('Success')) {
      spinner.message(trimmed.slice(0, 60));
    }
  });

  if (result.success) {
    spinner.stop(success('Server provisioned'));
    return true;
  }

  spinner.stop(errorText('Provisioning failed'));
  console.log();
  console.log(dim('  pyinfra output:'));
  // Show last 20 lines of output
  const lines = result.output.split('\n').filter(Boolean);
  lines.slice(-20).forEach(l => console.log(dim(`    ${l}`)));
  console.log();

  showPrompt('fix-docker.md', {
    server_ip: state.server_ip,
    ssh_user: state.ssh_user || 'root',
    error_message: lines.slice(-5).join('\n'),
    platform: detectPlatform(),
    os_version: osVersion(),
  });

  const retry = await p.confirm({
    message: 'Fixed it? Try provisioning again?',
    initialValue: true,
  });

  if (retry) {
    return stepProvision(p, state);
  }

  return false;
}
