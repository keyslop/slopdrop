import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { saveConfig, type SlopDropConfig } from '../../config.js';
import { icons, dim, bold, makeTable } from '../ui.js';

export async function stepComplete(p: WizardPrompter, state: WizardState): Promise<void> {
  // Save config
  const now = new Date().toISOString();
  const config: SlopDropConfig = {
    mode: state.mode,
    endpoint: state.endpoint!,
    token: state.token!,
    server_ip: state.server_ip,
    ssh_user: state.ssh_user,
    domain: state.domain,
    provisioned_at: state.mode === 'remote' ? now : undefined,
    deployed_at: state.mode === 'remote' ? now : undefined,
  };
  saveConfig(config);

  console.log(`  ${icons.check} Config saved to ~/.slopdrop/config.json`);
  console.log();

  // Summary
  const summaryRows: string[][] = [
    ['Mode', state.mode],
    ['Endpoint', state.endpoint!],
  ];
  if (state.server_ip) summaryRows.push(['Server IP', state.server_ip]);
  if (state.domain) summaryRows.push(['Domain', state.domain]);

  console.log(makeTable(['Setting', 'Value'], summaryRows));
  console.log();

  // Next steps
  if (state.mode === 'local') {
    console.log(dim('  Next steps:'));
    console.log(dim(`  1. Start the server:  ${bold('npm run server')}`));
    console.log(dim(`  2. Scan the QR code with the iOS app`));
    console.log(dim(`  3. Record some slop!`));
  } else if (state.mode === 'remote') {
    console.log(dim('  Next steps:'));
    console.log(dim(`  1. Scan the QR code with the iOS app`));
    console.log(dim(`  2. Record some slop!`));
    console.log(dim(`  3. Set up your agents to process recordings`));
  }

  console.log();
  console.log(`  ${icons.sparkles} ${bold('Want to contribute?')}`);
  console.log(dim('  SlopDrop is open source. Ideas, bug fixes, new features — all welcome.'));
  console.log(dim('  → github.com/keyslop/slopdrop'));
  console.log();
  console.log(dim('  Run `npm start` again to manage your server.'));

  p.outro('Your slop pipeline is ready! 🎙️');
}
