import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { icons, success, error as errorMsg, info, dim } from './wizard/ui.js';
import type { WizardPrompter } from './wizard/prompter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INFRA_DIR = path.join(__dirname, '..', 'infra');

export function isUvInstalled(): boolean {
  try {
    execSync('uv --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function ensureUv(p: WizardPrompter): Promise<boolean> {
  if (isUvInstalled()) {
    console.log(`  ${success('uv is installed')}`);
    return true;
  }

  console.log(`  ${info('uv is not installed. Installing...')}`);
  console.log(dim('    curl -LsSf https://astral.sh/uv/install.sh | sh'));
  console.log();

  const proceed = await p.confirm({
    message: 'Install uv? (Python package manager, needed for pyinfra)',
    initialValue: true,
  });

  if (!proceed) {
    console.log(errorMsg('uv is required for server provisioning.'));
    return false;
  }

  const spinner = p.spinner();
  spinner.start('Installing uv...');

  try {
    execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', {
      stdio: 'pipe',
      env: { ...process.env, UV_INSTALL_DIR: path.join(process.env.HOME || '~', '.local', 'bin') },
    });

    // Refresh PATH to include uv
    const uvPath = path.join(process.env.HOME || '~', '.local', 'bin');
    process.env.PATH = `${uvPath}:${process.env.PATH}`;

    spinner.stop(success('uv installed'));
    return true;
  } catch (e) {
    spinner.stop(errorMsg('Failed to install uv'));
    console.log(dim(`    ${(e as Error).message}`));
    return false;
  }
}

export async function ensurePyinfra(p: WizardPrompter): Promise<boolean> {
  const spinner = p.spinner();
  spinner.start('Syncing pyinfra dependencies...');

  try {
    execSync('uv sync', { cwd: INFRA_DIR, stdio: 'pipe' });
    spinner.stop(success('pyinfra ready'));
    return true;
  } catch (e) {
    spinner.stop(errorMsg('Failed to sync pyinfra'));
    console.log(dim(`    ${(e as Error).message}`));
    return false;
  }
}

export function infraDir(): string {
  return INFRA_DIR;
}
