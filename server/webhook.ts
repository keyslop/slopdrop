import fs from 'fs';
import path from 'path';
import type { RecordingMeta } from './storage.js';

export function fireWebhooks(dataDir: string, event: string, data: RecordingMeta): void {
  const configPath = path.join(dataDir, 'config.json');
  if (!fs.existsSync(configPath)) return;

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const webhooks: Array<{ url: string; events: string[] }> = config.webhooks || [];

    for (const wh of webhooks) {
      if (wh.events.includes(event)) {
        // Fire and forget
        fetch(wh.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, data }),
        }).catch(() => {
          // Silently ignore webhook failures
        });
      }
    }
  } catch {
    // Config parse error — skip webhooks
  }
}
