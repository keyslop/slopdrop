import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { promptBox, icons, dim } from '../wizard/ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, 'templates');

export interface PromptContext {
  server_ip?: string;
  ssh_user?: string;
  domain?: string;
  error_message?: string;
  platform?: string;
  os_version?: string;
  repo_path?: string;
  endpoint?: string;
  [key: string]: string | undefined;
}

export function renderPrompt(templateName: string, ctx: PromptContext): string {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  let content = fs.readFileSync(templatePath, 'utf-8');

  // Add repo path if not provided
  if (!ctx.repo_path) {
    ctx.repo_path = process.cwd();
  }

  // Replace {{placeholders}}
  content = content.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return ctx[key] ?? `(unknown ${key})`;
  });

  return content;
}

export function showPrompt(templateName: string, ctx: PromptContext): void {
  const rendered = renderPrompt(templateName, ctx);

  console.log();
  console.log(promptBox('📋 Prompt for your AI agent', rendered));
  console.log();

  // Try to copy to clipboard on macOS
  try {
    execSync('pbcopy', { input: rendered, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`  ${icons.clipboard} Copied to clipboard!`);
  } catch {
    // Not macOS or pbcopy not available
  }

  console.log(dim('  Paste this to Claude, ChatGPT, Cursor, or your favorite AI agent.'));
  console.log(dim('  Fix the issue, then come back and press Enter to retry.'));
  console.log();
}
