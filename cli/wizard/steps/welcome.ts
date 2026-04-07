import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { detectPlatform, platformLabel, osVersion } from '../../infra/platform.js';
import { icons, warn, info, dim, promptBox } from '../ui.js';

export async function stepWelcome(p: WizardPrompter, _state: WizardState): Promise<boolean> {
  const platform = detectPlatform();

  console.log(`  ${icons.server} Platform: ${platformLabel(platform)} (${osVersion()})`);
  console.log();

  if (platform === 'windows') {
    console.log(warn('Windows is not yet supported.'));
    console.log();
    console.log(info('But you can help! Here\'s a prompt for your AI agent:'));
    console.log();
    console.log(promptBox(
      '📋 Prompt for your agent',
      [
        'I\'m working on SlopDrop (github.com/keyslop/slopdrop).',
        'The CLI currently only supports macOS.',
        'Please read AGENTS.md and add Windows support.',
        '',
        'Key areas to modify:',
        '- cli/wizard/steps/toolchain.ts (uv/pyinfra install for Windows)',
        '- cli/infra/platform.ts (Windows-specific paths)',
        '- cli/bootstrap.ts (Windows package managers)',
        '',
        'Then submit an MR! The community will love you for it.',
      ].join('\n')
    ));
    console.log();
    console.log(dim('  Submit an MR and make SlopDrop work on Windows!'));
    p.outro('Come back on macOS, or help us add Windows support!');
    return false;
  }

  if (platform === 'linux') {
    console.log(warn('Linux support is work-in-progress.'));
    console.log();
    console.log(info('Here\'s a prompt to get your AI agent to add it:'));
    console.log();
    console.log(promptBox(
      '📋 Prompt for your agent',
      [
        'I\'m working on SlopDrop (github.com/keyslop/slopdrop).',
        'The CLI currently targets macOS.',
        'Please read AGENTS.md and add Linux support.',
        '',
        'Key areas to modify:',
        '- cli/wizard/steps/toolchain.ts (apt/dnf instead of brew)',
        '- cli/infra/platform.ts (Linux-specific paths)',
        '- cli/bootstrap.ts (Linux package managers)',
        '',
        'Most of the pyinfra/server code should work as-is.',
        'Then submit an MR!',
      ].join('\n')
    ));
    console.log();
    console.log(dim('  Want to make it work? Submit an MR!'));

    const proceed = await p.confirm({
      message: 'Try to continue anyway? (some things may not work)',
      initialValue: true,
    });
    if (!proceed) {
      p.outro('Come back soon — or submit that MR!');
      return false;
    }
  }

  return true;
}
