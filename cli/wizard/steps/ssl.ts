import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { writeInventory, runPyinfra } from '../../infra/pyinfra.js';
import { showPrompt } from '../../prompts/render.js';
import { success, error as errorText, dim } from '../ui.js';

export async function stepSsl(p: WizardPrompter, state: WizardState): Promise<boolean> {
  if (!state.domain) return true; // No domain, no SSL

  // SSL is handled in deploy.py when domain is set
  // This step just informs the user
  console.log();
  console.log(dim(`  SSL will be set up automatically via Let's Encrypt during deployment.`));
  console.log();

  return true;
}
