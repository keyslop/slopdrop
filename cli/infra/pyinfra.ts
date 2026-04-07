import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { infraDir } from '../bootstrap.js';

interface PyinfraResult {
  success: boolean;
  output: string;
  exitCode: number;
}

interface InventoryData {
  host: string;
  ssh_user: string;
  domain?: string;
  token?: string;
}

const INVENTORY_PATH = path.join(os.homedir(), '.slopdrop', 'infra-inventory.json');

export function writeInventory(data: InventoryData): void {
  const dir = path.dirname(INVENTORY_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(data, null, 2) + '\n');
}

export function runPyinfra(
  script: string,
  onOutput?: (line: string) => void,
): Promise<PyinfraResult> {
  return new Promise((resolve) => {
    const cwd = infraDir();
    const proc = spawn('uv', ['run', 'pyinfra', '-y', 'inventories.py', script], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let output = '';

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      if (onOutput) {
        text.split('\n').filter(Boolean).forEach(onOutput);
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      if (onOutput) {
        text.split('\n').filter(Boolean).forEach(onOutput);
      }
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output,
        exitCode: code ?? 1,
      });
    });
  });
}
