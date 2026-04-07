import { execSync } from 'child_process';
import type { SlopDropConfig } from '../config.js';
import { createPrompter, type WizardPrompter } from '../wizard/prompter.js';
import { icons, success, error as errorText, warn, dim, bold, makeTable } from '../wizard/ui.js';
import { writeInventory, runPyinfra } from '../infra/pyinfra.js';

export async function runUpgrade(config: SlopDropConfig, p: WizardPrompter): Promise<void> {
  console.log();
  console.log(`  ${icons.rocket} ${bold('Upgrade SlopDrop')}`);
  console.log();

  // Step 1: Check for updates (git pull)
  const spinner = p.spinner();
  spinner.start('Checking for updates...');

  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: process.cwd() });
    if (status.trim()) {
      spinner.stop(warn('You have local changes'));
      console.log(dim('  Stash or commit them before upgrading.'));
      console.log(dim('  git stash && git pull && git stash pop'));
      console.log();
      return;
    }

    const currentRef = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    execSync('git fetch origin', { cwd: process.cwd(), stdio: 'pipe' });
    const behind = execSync('git rev-list HEAD..origin/main --count', { encoding: 'utf-8' }).trim();

    if (behind === '0') {
      spinner.stop(success('Already up to date'));
      console.log(dim(`  commit: ${currentRef}`));
      console.log();
      return;
    }

    spinner.stop(`${icons.info} ${behind} new commit(s) available`);
    console.log();

    // Show what changed
    try {
      const log = execSync('git log HEAD..origin/main --oneline', { encoding: 'utf-8', cwd: process.cwd() });
      log.trim().split('\n').forEach(line => {
        console.log(dim(`    ${line}`));
      });
      console.log();
    } catch {}

    const proceed = await p.confirm({
      message: 'Pull updates and redeploy?',
      initialValue: true,
    });
    if (!proceed) return;

    // Step 2: git pull
    const pullSpinner = p.spinner();
    pullSpinner.start('Pulling updates...');
    try {
      execSync('git pull origin main', { cwd: process.cwd(), stdio: 'pipe' });
      pullSpinner.stop(success('Code updated'));
    } catch (e) {
      pullSpinner.stop(errorText('git pull failed'));
      console.log(dim(`    ${(e as Error).message}`));
      return;
    }

    // Step 3: npm install (in case deps changed)
    const depsSpinner = p.spinner();
    depsSpinner.start('Updating dependencies...');
    try {
      execSync('npm install', { cwd: process.cwd(), stdio: 'pipe' });
      depsSpinner.stop(success('Dependencies updated'));
    } catch (e) {
      depsSpinner.stop(errorText('npm install failed'));
      console.log(dim(`    ${(e as Error).message}`));
    }

    // Step 4: Redeploy to server (if remote mode)
    if (config.mode === 'remote' && config.server_ip) {
      const deploy = await p.confirm({
        message: 'Redeploy to server?',
        initialValue: true,
      });

      if (deploy) {
        writeInventory({
          host: config.server_ip,
          ssh_user: 'root',
          domain: config.domain,
          token: config.token,
        });

        const deploySpinner = p.spinner();
        deploySpinner.start('Deploying to server...');

        const result = await runPyinfra('deploy.py', (line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('[') || trimmed.includes('Success')) {
            deploySpinner.message(trimmed.slice(0, 60));
          }
        });

        if (result.success) {
          deploySpinner.stop(success('Server updated'));
        } else {
          deploySpinner.stop(errorText('Deploy failed'));
          const lines = result.output.split('\n').filter(Boolean);
          lines.slice(-10).forEach(l => console.log(dim(`    ${l}`)));
        }
      }
    }

    console.log();
    const newRef = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    console.log(`  ${success(`Upgraded: ${currentRef} → ${newRef}`)}`);

  } catch (e) {
    spinner.stop(errorText('Update check failed'));
    console.log(dim(`    ${(e as Error).message}`));
    console.log(dim('    Are you in a git repo? Try: git pull && npm start'));
  }

  console.log();
}
