import qrcode from 'qrcode-terminal';
import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { icons, makeTable, dim } from '../ui.js';

export async function stepQr(p: WizardPrompter, state: WizardState): Promise<void> {
  const pairingData = JSON.stringify({
    endpoint: state.endpoint,
    token: state.token,
  });

  console.log();
  console.log(`  ${icons.mic} Scan this QR code with the SlopDrop iOS app:`);
  console.log();

  // Generate QR code in terminal
  await new Promise<void>((resolve) => {
    qrcode.generate(pairingData, { small: true }, (code) => {
      // Indent each line
      const indented = code.split('\n').map(line => '    ' + line).join('\n');
      console.log(indented);
      resolve();
    });
  });

  console.log();
  console.log(dim('  Or enter these values manually in the app:'));
  console.log();

  const table = makeTable(
    ['Setting', 'Value'],
    [
      ['Endpoint', state.endpoint!],
      ['Token', state.token!],
    ]
  );
  console.log(table);
  console.log();
}
