import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { testSSHConnection } from '../../infra/ssh.js';
import { showPrompt } from '../../prompts/render.js';
import { icons, success, error as errorText, dim } from '../ui.js';
import { detectPlatform, osVersion } from '../../infra/platform.js';

export async function stepSshCheck(p: WizardPrompter, state: WizardState): Promise<boolean> {
  const spinner = p.spinner();
  spinner.start(`Testing SSH connection to ${state.server_ip}...`);

  const result = await testSSHConnection({
    host: state.server_ip!,
    username: state.ssh_user || 'root',
  });

  if (result.ok) {
    spinner.stop(success(`Connected to ${state.server_ip}`));
    return true;
  }

  spinner.stop(errorText(`SSH connection failed`));
  console.log(dim(`    ${result.error}`));
  console.log();

  showPrompt('fix-ssh.md', {
    server_ip: state.server_ip,
    ssh_user: state.ssh_user || 'root',
    error_message: result.error || 'Connection failed',
    platform: detectPlatform(),
    os_version: osVersion(),
  });

  const retry = await p.confirm({
    message: 'Fixed it? Try again?',
    initialValue: true,
  });

  if (retry) {
    return stepSshCheck(p, state);
  }

  return false;
}
