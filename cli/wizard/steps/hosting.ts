import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { icons, makeTable, promptBox, info, dim } from '../ui.js';
import { execSync } from 'child_process';

export async function stepHosting(p: WizardPrompter, state: WizardState): Promise<void> {
  console.log();
  console.log(`  ${icons.globe} ${info('You need a VPS. Here are some good options:')}`);
  console.log();

  const table = makeTable(
    ['Provider', 'Cheapest', 'Notes'],
    [
      ['Hetzner', '~€4/mo', 'Best value. EU & US datacenters.'],
      ['DigitalOcean', '$6/mo', 'Simple. Great docs.'],
      ['Vultr', '$6/mo', 'Many locations worldwide.'],
      ['Linode (Akamai)', '$5/mo', 'Solid. Good network.'],
    ]
  );
  console.log(table);
  console.log();
  console.log(dim('  We recommend Ubuntu 24.04 LTS, minimum 1GB RAM.'));
  console.log(dim('  The cheapest plan is more than enough for SlopDrop.'));
  console.log();

  const prompt = [
    'I want to set up a VPS to run SlopDrop (a self-hosted voice memo server).',
    '',
    'Requirements:',
    '- Ubuntu 24.04 LTS',
    '- 1GB RAM minimum (cheapest plan is fine)',
    '- Any provider (Hetzner, DigitalOcean, Vultr, etc.)',
    '',
    'Please help me:',
    '1. Choose a provider and create a VPS',
    '2. Set up SSH key access',
    '3. Note the IP address',
    '',
    'I\'ll use the IP to continue SlopDrop setup.',
  ].join('\n');

  console.log(promptBox('📋 Prompt for your agent', prompt));
  console.log();

  // Try to copy to clipboard on macOS
  try {
    execSync('pbcopy', { input: prompt, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`  ${icons.clipboard} Prompt copied to clipboard!`);
  } catch {
    // Not macOS or pbcopy not available
  }

  console.log();

  // Now ask for the IP
  p.note('Set up your VPS, then enter the IP below.', '⏳ Waiting for you');

  state.server_ip = await p.text({
    message: 'Server IP address (when ready)',
    placeholder: '135.181.38.99',
    validate: (v) => {
      if (!v.trim()) return 'IP address is required';
      return undefined;
    },
  });

  state.ssh_user = await p.text({
    message: 'SSH user',
    placeholder: 'root',
    defaultValue: 'root',
  });

  state.domain = await p.text({
    message: 'Domain name (optional, for HTTPS)',
    placeholder: 'voice.example.com',
  });
  if (!state.domain?.trim()) state.domain = undefined;
}
