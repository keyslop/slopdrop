import { execSync } from 'child_process';
import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';
import { showPrompt } from '../../prompts/render.js';
import { icons, success, error as errorText, warn, dim, bold } from '../ui.js';

function checkDns(domain: string): string | null {
  try {
    const result = execSync(`dig +short ${domain} A`, { encoding: 'utf-8', timeout: 5000 });
    const ip = result.trim().split('\n')[0];
    return ip || null;
  } catch {
    return null;
  }
}

export async function stepDomain(p: WizardPrompter, state: WizardState): Promise<boolean> {
  if (!state.domain) return true; // No domain, skip

  console.log();
  console.log(`  ${icons.globe} ${bold('DNS Setup')}`);
  console.log();
  console.log(`  Point ${bold(state.domain)} to ${bold(state.server_ip!)} with an A record.`);
  console.log();
  console.log(dim('  In your DNS provider (Cloudflare, Namecheap, etc.):'));
  console.log(dim(`    Type: A    Name: ${state.domain}    Value: ${state.server_ip}`));
  console.log();

  p.note('Set up the DNS record, then we\'ll verify it.', '⏳ DNS Configuration');

  const proceed = await p.confirm({
    message: 'DNS record set up? Let\'s check.',
    initialValue: true,
  });

  if (!proceed) return true; // Skip DNS check

  const spinner = p.spinner();
  spinner.start(`Checking DNS for ${state.domain}...`);

  // Poll DNS for up to 2 minutes
  const maxAttempts = 24;
  for (let i = 0; i < maxAttempts; i++) {
    const resolved = checkDns(state.domain);

    if (resolved === state.server_ip) {
      spinner.stop(success(`${state.domain} → ${state.server_ip}`));
      return true;
    }

    if (resolved) {
      spinner.stop(warn(`${state.domain} resolves to ${resolved}, expected ${state.server_ip}`));
      break;
    }

    spinner.message(`Checking DNS... (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 5000));
  }

  // DNS didn't resolve in time
  spinner.stop(errorText('DNS not resolving yet'));
  console.log();

  showPrompt('fix-dns.md', {
    domain: state.domain,
    server_ip: state.server_ip,
    error_message: 'DNS A record not resolving to expected IP',
  });

  const retry = await p.confirm({
    message: 'Try checking DNS again?',
    initialValue: true,
  });

  if (retry) {
    return stepDomain(p, state);
  }

  // Continue without DNS verified — SSL might still work if it propagates
  return true;
}
