#!/usr/bin/env node

// Plain JS bootstrapper — zero dependencies.
// Makes `npm start` work from a fresh `git clone` with no prior `npm install`.

import { existsSync } from 'fs';
import { execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

const nodeModules = join(root, 'node_modules');

if (!existsSync(nodeModules)) {
  console.log('\n\x1b[36m📦 First run — installing dependencies...\x1b[0m\n');
  try {
    execSync('npm install', { cwd: root, stdio: 'inherit' });
    console.log('\n\x1b[32m✓ Dependencies installed.\x1b[0m\n');
  } catch {
    console.error('\n\x1b[31m✗ npm install failed. Check your Node.js installation.\x1b[0m\n');
    process.exit(1);
  }
}

// Hand off to the TypeScript entry point via tsx
try {
  execFileSync(
    join(root, 'node_modules', '.bin', 'tsx'),
    [join(__dirname, 'index.ts'), ...process.argv.slice(2)],
    { cwd: root, stdio: 'inherit' }
  );
} catch (e) {
  // tsx exits with the child's exit code — don't double-print
  process.exit(e.status ?? 1);
}
