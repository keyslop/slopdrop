import crypto from 'crypto';
import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { icons } from '../ui.js';

export async function stepAuth(p: WizardPrompter, state: WizardState): Promise<void> {
  const token = 'sd_' + crypto.randomBytes(32).toString('hex');
  state.token = token;

  // Build endpoint if not set yet
  if (!state.endpoint) {
    if (state.domain) {
      state.endpoint = `https://${state.domain}`;
    } else if (state.server_ip) {
      state.endpoint = `http://${state.server_ip}:3847`;
    } else {
      state.endpoint = 'http://localhost:3847';
    }
  }

  console.log();
  console.log(`  ${icons.key} Auth token generated`);
  console.log();
}
