import fs from 'fs';
import path from 'path';

export interface RecordingMeta {
  id: string;
  filename: string;
  duration_sec: number;
  size_bytes: number;
  created_at: string;
  synced_at: string;
  processed: boolean;
}

function metadataPath(dataDir: string): string {
  return path.join(dataDir, 'metadata.jsonl');
}

export function readMetadata(dataDir: string): RecordingMeta[] {
  const p = metadataPath(dataDir);
  if (!fs.existsSync(p)) return [];

  return fs.readFileSync(p, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

export function appendMetadata(dataDir: string, entry: RecordingMeta): void {
  const p = metadataPath(dataDir);
  fs.appendFileSync(p, JSON.stringify(entry) + '\n');
}

export function markProcessed(dataDir: string, id: string): boolean {
  const p = metadataPath(dataDir);
  if (!fs.existsSync(p)) return false;

  const lines = fs.readFileSync(p, 'utf-8').split('\n').filter(l => l.trim());
  let found = false;

  const updated = lines.map(line => {
    const entry: RecordingMeta = JSON.parse(line);
    if (entry.id === id) {
      entry.processed = true;
      found = true;
    }
    return JSON.stringify(entry);
  });

  if (found) {
    fs.writeFileSync(p, updated.join('\n') + '\n');
  }
  return found;
}
