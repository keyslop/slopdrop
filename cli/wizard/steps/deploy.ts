import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { writeInventory, runPyinfra } from '../../infra/pyinfra.js';
import { showPrompt } from '../../prompts/render.js';
import { success, error as errorText, dim } from '../ui.js';
import { detectPlatform, osVersion } from '../../infra/platform.js';

export async function stepDeploy(p: WizardPrompter, state: WizardState): Promise<boolean> {
  // Ensure inventory is up to date with token
  writeInventory({
    host: state.server_ip!,
    ssh_user: state.ssh_user || 'root',
    domain: state.domain,
    token: state.token,
  });

  const spinner = p.spinner();
  spinner.start('Deploying SlopDrop to server...');

  const result = await runPyinfra('deploy.py', (line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') || trimmed.includes('Success')) {
      spinner.message(trimmed.slice(0, 60));
    }
  });

  if (result.success) {
    spinner.stop(success('SlopDrop deployed'));

    // Set endpoint
    if (state.domain) {
      state.endpoint = `https://${state.domain}`;
    } else {
      state.endpoint = `http://${state.server_ip}:3847`;
    }

    return true;
  }

  spinner.stop(errorText('Deployment failed'));
  console.log();
  const lines = result.output.split('\n').filter(Boolean);
  lines.slice(-20).forEach(l => console.log(dim(`    ${l}`)));
  console.log();

  showPrompt('fix-deploy.md', {
    server_ip: state.server_ip,
    ssh_user: state.ssh_user || 'root',
    domain: state.domain || '(none)',
    error_message: lines.slice(-5).join('\n'),
    platform: detectPlatform(),
    os_version: osVersion(),
  });

  const retry = await p.confirm({
    message: 'Fixed it? Try deploying again?',
    initialValue: true,
  });

  if (retry) {
    return stepDeploy(p, state);
  }

  return false;
}
