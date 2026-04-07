import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { ensureUv, ensurePyinfra } from '../../bootstrap.js';
import { icons, dim } from '../ui.js';

export async function stepToolchain(p: WizardPrompter, _state: WizardState): Promise<boolean> {
  console.log();
  console.log(`  ${icons.rocket} Checking toolchain...`);
  console.log();

  // 1. Ensure uv is installed
  const uvOk = await ensureUv(p);
  if (!uvOk) {
    console.log(dim('  Without uv, we can\'t run pyinfra to provision your server.'));
    console.log(dim('  Install it manually: curl -LsSf https://astral.sh/uv/install.sh | sh'));
    return false;
  }

  // 2. Sync pyinfra dependencies
  const pyinfraOk = await ensurePyinfra(p);
  if (!pyinfraOk) {
    console.log(dim('  Failed to set up pyinfra. Check your Python installation.'));
    return false;
  }

  console.log();
  return true;
}
