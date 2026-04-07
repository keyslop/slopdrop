import { createPrompter } from './prompter.js';
import { BANNER, TAGLINE } from './ui.js';
import { stepWelcome } from './steps/welcome.js';
import { stepVps } from './steps/vps.js';
import { stepHosting } from './steps/hosting.js';
import { stepToolchain } from './steps/toolchain.js';
import { stepSshCheck } from './steps/ssh-check.js';
import { stepProvision } from './steps/provision.js';
import { stepDomain } from './steps/domain.js';
import { stepSsl } from './steps/ssl.js';
import { stepDeploy } from './steps/deploy.js';
import { stepAuth } from './steps/auth.js';
import { stepQr } from './steps/qr.js';
import { stepComplete } from './steps/complete.js';

export interface WizardState {
  mode: 'local' | 'remote' | 'existing';
  server_ip?: string;
  ssh_user?: string;
  domain?: string;
  token?: string;
  endpoint?: string;
}

export async function runWizard(): Promise<void> {
  const p = createPrompter();

  console.log(BANNER);
  console.log(TAGLINE);

  p.intro('Let\'s set up your SlopDrop server');

  const state: WizardState = { mode: 'local' };

  // Step 1: Welcome + platform check
  const shouldContinue = await stepWelcome(p, state);
  if (!shouldContinue) return;

  // Step 2: Where to run?
  await stepVps(p, state);

  // Step 3: Hosting suggestions (if user needs a VPS)
  if (state.mode === 'remote' && !state.server_ip) {
    await stepHosting(p, state);
  }

  // Steps 4-9: Remote provisioning flow
  if (state.mode === 'remote') {
    // Step 4: Check/install uv + pyinfra
    const toolchainOk = await stepToolchain(p, state);
    if (!toolchainOk) return;

    // Step 5: Test SSH connection
    const sshOk = await stepSshCheck(p, state);
    if (!sshOk) return;

    // Step 6: Provision server (Docker, nginx, firewall)
    const provisionOk = await stepProvision(p, state);
    if (!provisionOk) return;

    // Step 7: DNS setup
    await stepDomain(p, state);

    // Step 8: SSL info
    await stepSsl(p, state);
  }

  // Step 9: Generate auth token
  await stepAuth(p, state);

  // Step 10: Deploy (remote only, after token is generated)
  if (state.mode === 'remote') {
    const deployOk = await stepDeploy(p, state);
    if (!deployOk) return;
  }

  // Step 11: QR code
  await stepQr(p, state);

  // Step 12: Complete
  await stepComplete(p, state);
}
