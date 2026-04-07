import fs from 'fs';
import path from 'path';
import os from 'os';

export interface SlopDropConfig {
  mode: 'local' | 'remote' | 'existing';
  endpoint: string;
  token: string;
  server_ip?: string;
  ssh_user?: string;
  domain?: string;
  webhooks?: Array<{ url: string; events: string[] }>;
}

const SLOPDROP_DIR = path.join(os.homedir(), '.slopdrop');
const CONFIG_PATH = path.join(SLOPDROP_DIR, 'config.json');

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

export function loadConfig(): SlopDropConfig {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

export function saveConfig(config: SlopDropConfig): void {
  fs.mkdirSync(SLOPDROP_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function configDir(): string {
  return SLOPDROP_DIR;
}

export function configPath(): string {
  return CONFIG_PATH;
}
