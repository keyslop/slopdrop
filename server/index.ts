import express from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { authMiddleware } from './auth.js';
import { appendMetadata, readMetadata, markProcessed } from './storage.js';
import { fireWebhooks } from './webhook.js';

const app = express();
app.use(express.json());

const DATA_DIR = process.env.SLOPDROP_DATA || path.join(os.homedir(), '.slopdrop');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

// Multer for audio uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: RECORDINGS_DIR,
    filename: (_req, _file, cb) => {
      const now = new Date();
      const ts = now.toISOString().replace(/[T:]/g, (m) => m === 'T' ? '_' : '-').slice(0, 19);
      cb(null, `${ts}.m4a`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Health check — no auth
app.get('/api/health', (_req, res) => {
  const metadata = readMetadata(DATA_DIR);
  const diskFree = getDiskFreeGb();
  const lastRecording = metadata.length > 0 ? metadata[metadata.length - 1].created_at : null;

  res.json({
    ok: true,
    count: metadata.length,
    disk_free_gb: diskFree,
    last_recording_at: lastRecording,
  });
});

// Upload audio
app.post('/api/upload', authMiddleware, upload.single('audio'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  const id = 'sd_' + randomUUID().replace(/-/g, '').slice(0, 12);
  const stat = fs.statSync(req.file.path);
  const now = new Date().toISOString();

  const entry = {
    id,
    filename: req.file.filename,
    duration_sec: parseFloat(req.body?.duration_sec || '0'),
    size_bytes: stat.size,
    created_at: now,
    synced_at: now,
    processed: false,
  };

  appendMetadata(DATA_DIR, entry);
  fireWebhooks(DATA_DIR, 'new_recording', entry);

  res.status(201).json({ id, filename: req.file.filename, synced_at: now });
});

// List recordings
app.get('/api/recordings', authMiddleware, (req, res) => {
  let metadata = readMetadata(DATA_DIR);

  const sinceParam = typeof req.query.since === 'string' ? req.query.since : undefined;
  if (sinceParam) {
    const since = new Date(sinceParam);
    metadata = metadata.filter(m => new Date(m.created_at) >= since);
  }
  if (req.query.processed !== undefined) {
    const processed = req.query.processed === 'true';
    metadata = metadata.filter(m => m.processed === processed);
  }

  res.json(metadata);
});

// Mark as processed
app.post('/api/recordings/:id/processed', authMiddleware, (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const updated = markProcessed(DATA_DIR, id);
  if (!updated) {
    res.status(404).json({ error: 'Recording not found' });
    return;
  }
  res.status(204).end();
});

// Stream audio
app.get('/api/recordings/:id/audio', authMiddleware, (req, res) => {
  const metadata = readMetadata(DATA_DIR);
  const audioId = typeof req.params.id === 'string' ? req.params.id : '';
  const entry = metadata.find(m => m.id === audioId);
  if (!entry) {
    res.status(404).json({ error: 'Recording not found' });
    return;
  }

  const filePath = path.join(RECORDINGS_DIR, entry.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Audio file not found' });
    return;
  }

  res.setHeader('Content-Type', 'audio/mp4');
  fs.createReadStream(filePath).pipe(res);
});

// Register webhook
app.post('/api/webhook', authMiddleware, (req, res) => {
  const { url, events } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL required' });
    return;
  }

  const configPath = path.join(DATA_DIR, 'config.json');
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  const webhooks = (config.webhooks as Array<{ url: string; events: string[] }>) || [];
  webhooks.push({ url, events: events || ['new_recording'] });
  config.webhooks = webhooks;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  res.status(201).json({ ok: true });
});

function getDiskFreeGb(): number | null {
  try {
    const { execSync } = require('child_process');
    const output = execSync('df -BG / | tail -1', { encoding: 'utf-8' });
    const parts = output.trim().split(/\s+/);
    return parseInt(parts[3], 10) || null;
  } catch {
    return null;
  }
}

const PORT = parseInt(process.env.SLOPDROP_PORT || '3847', 10);
app.listen(PORT, () => {
  console.log(`SlopDrop server listening on port ${PORT}`);
});
