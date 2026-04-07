import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';

export async function stepVps(p: WizardPrompter, state: WizardState): Promise<void> {
  const mode = await p.select({
    message: 'Where do you want to run SlopDrop?',
    options: [
      { value: 'remote' as const, label: 'On a VPS', hint: 'recommended — your own server, accessible everywhere' },
      { value: 'local' as const, label: 'Locally', hint: 'localhost:3847, good for testing' },
      { value: 'existing' as const, label: 'I already have a server running', hint: 'just pair with QR' },
    ],
  });

  state.mode = mode;

  if (mode === 'remote') {
    const hasVps = await p.confirm({
      message: 'Do you already have a VPS?',
      initialValue: true,
    });

    if (hasVps) {
      state.server_ip = await p.text({
        message: 'Server IP address',
        placeholder: '135.181.38.99',
        validate: (v) => {
          if (!v.trim()) return 'IP address is required';
          // Basic IP or hostname validation
          if (!/^[\d.]+$/.test(v) && !/^[a-zA-Z0-9.-]+$/.test(v)) {
            return 'Enter a valid IP address or hostname';
          }
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
    // If no VPS, state.server_ip stays undefined → triggers hosting step
  }

  if (mode === 'local') {
    state.endpoint = 'http://localhost:3847';
  }

  if (mode === 'existing') {
    state.endpoint = await p.text({
      message: 'Server URL',
      placeholder: 'https://voice.example.com',
      validate: (v) => {
        if (!v.trim()) return 'URL is required';
        if (!v.startsWith('http://') && !v.startsWith('https://')) {
          return 'URL must start with http:// or https://';
        }
        return undefined;
      },
    });
  }
}
