# SlopDrop — Technical Specification

## Overview

Three components: **CLI** (setup + management), **Server** (receives + stores audio), **iOS App** (records + uploads).

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   iOS App    │────→│     Server       │←────│  Your Agents │
│  (SwiftUI)   │     │  (Express/Node)  │     │  (anything)  │
│              │     │                  │     │              │
│  ● Record    │     │  POST /upload    │     │  GET /recs   │
│  ● Upload    │     │  GET /recordings │     │  GET /audio  │
│  ● QR Pair   │     │  Webhook notify  │     │  POST /done  │
└──────────────┘     └──────────────────┘     └──────────────┘
                            │
                     ┌──────┴──────┐
                     │    CLI      │
                     │ (npm start) │
                     │             │
                     │ Setup wizard│
                     │ VPS deploy  │
                     │ QR display  │
                     │ Health check│
                     └─────────────┘
```

---

## 1. CLI (`cli/`)

### Entry Point

`npm start` → runs `cli/index.ts`

### First Run (No Config)

Detects `~/.slopdrop/config.json` missing → launches setup wizard.

```typescript
// cli/index.ts
import { existsSync } from 'fs';
import { setup } from './setup';
import { manage } from './manage';

const CONFIG_PATH = path.join(os.homedir(), '.slopdrop', 'config.json');

if (!existsSync(CONFIG_PATH)) {
  await setup();
} else {
  await manage();
}
```

### Setup Wizard (`cli/setup.ts`)

Interactive prompts (use `inquirer` or `@clack/prompts`):

```
1. Where to run?
   → local    → start Express server on localhost:3847
   → remote   → SSH to VPS, deploy Docker container
   → existing → just generate QR for pairing

2. (if remote) VPS details:
   → IP address
   → SSH user (default: root)
   → Domain (optional, for HTTPS)

3. (if remote) Check what's installed:
   → Docker? If not → install
   → Nginx? If not → install
   → Certbot? If domain provided → setup SSL

4. Deploy:
   → Copy docker-compose.yml to server
   → docker compose up -d
   → Configure Nginx reverse proxy
   → Generate auth token (crypto.randomBytes)

5. Display QR:
   → QR contains: { "endpoint": "https://...", "token": "sd_..." }
   → Also display manual entry values
   → Save config to ~/.slopdrop/config.json
```

### Management Mode (`cli/manage.ts`)

When config exists, `npm start` shows status + options:

```
Options:
  1. Show QR code (pair new device)
  2. Server status (health check)
  3. List recent recordings
  4. Reconfigure
  q. Quit
```

### Dependencies (CLI)

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7",
    "node-ssh": "^13",
    "qrcode-terminal": "^0.12"
  }
}
```

Minimal. No framework.

---

## 2. Server (`server/`)

### Express App (~150 lines)

```typescript
// server/index.ts
import express from 'express';
import multer from 'multer';
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

const app = express();
const DATA_DIR = process.env.SLOPDROP_DATA || path.join(os.homedir(), '.slopdrop');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.jsonl');
const TOKEN = process.env.SLOPDROP_TOKEN;

// Ensure dirs exist
mkdirSync(RECORDINGS_DIR, { recursive: true });
```

### Endpoints

#### `POST /api/upload`
```typescript
// Auth check
// Accept multipart audio file
// Save to RECORDINGS_DIR with timestamp filename
// Append metadata to JSONL
// Return { id, filename, synced_at }
// If webhooks registered → fire async POST
```

#### `GET /api/recordings`
```typescript
// Auth check
// Read metadata.jsonl, parse lines
// Filter by query params: ?since=ISO&processed=true|false
// Return JSON array
```

#### `POST /api/recordings/:id/processed`
```typescript
// Auth check
// Find line in metadata.jsonl, update processed=true
// Return 204
```

#### `GET /api/recordings/:id/audio`
```typescript
// Auth check
// Stream file from RECORDINGS_DIR
// Content-Type: audio/mp4 (m4a)
```

#### `GET /api/health`
```typescript
// No auth (public health check)
// Return { ok, count, disk_free_gb, last_recording_at }
```

#### `POST /api/webhook`
```typescript
// Auth check
// Save webhook URL to config
// Return 201
```

### Storage Format

**Recordings:** `~/.slopdrop/recordings/{timestamp}.m4a`

Filename format: `YYYY-MM-DD_HH-mm-ss.m4a` (UTC)

**Metadata:** `~/.slopdrop/metadata.jsonl`

One JSON line per recording:
```json
{"id":"sd_abc123","filename":"2026-04-07_09-23-15.m4a","duration_sec":154,"size_bytes":245760,"created_at":"2026-04-07T09:23:15Z","synced_at":"2026-04-07T09:23:48Z","processed":false}
```

**Why JSONL, not SQLite:**
- `grep` and `jq` work directly on it
- No driver dependencies
- Append-only is natural for recordings
- At 100 recordings/day, JSONL is fine for years
- If someone wants SQLite, they can build an agent that reads JSONL

**Config:** `~/.slopdrop/config.json`
```json
{
  "mode": "remote",
  "endpoint": "https://voice.kabardin.com",
  "token": "sd_a7f3...",
  "server_ip": "135.181.38.99",
  "domain": "voice.kabardin.com",
  "webhooks": [
    {"url": "https://my-agent.com/hook", "events": ["new_recording"]}
  ]
}
```

### Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY server/ ./server/
EXPOSE 3847
CMD ["node", "server/index.js"]
```

```yaml
# docker-compose.yml
services:
  slopdrop:
    build: .
    ports:
      - "127.0.0.1:3847:3847"
    volumes:
      - slopdrop_data:/data
    environment:
      - SLOPDROP_DATA=/data
      - SLOPDROP_TOKEN=${SLOPDROP_TOKEN}
    restart: unless-stopped

volumes:
  slopdrop_data:
```

### Auth

Simple bearer token. Generated during setup (32 bytes, hex encoded, prefixed `sd_`).

```
Authorization: Bearer sd_a7f3e2b1c4d5...
```

No users, no sessions, no OAuth. One token per server. Rotate by re-running setup.

---

## 3. iOS App (`app/`)

### Project Structure

```
app/
├── SlopDrop.xcodeproj
├── SlopDrop/
│   ├── SlopDropApp.swift         # @main, app lifecycle
│   ├── ContentView.swift         # One screen: button + list
│   ├── PairingView.swift         # QR scanner (first launch only)
│   ├── RecordButton.swift        # The big button component
│   ├── RecordingRow.swift        # List item: duration + sync status
│   ├── AudioRecorder.swift       # AVAudioRecorder wrapper
│   ├── Uploader.swift            # URLSession background upload
│   ├── RecordingStore.swift      # Local persistence (UserDefaults or SwiftData)
│   ├── Config.swift              # Server endpoint + token (Keychain)
│   └── Assets.xcassets           # App icon, colors
├── SlopDropWidget/               # Lock screen / home screen widget
│   ├── SlopDropWidget.swift
│   └── RecordIntent.swift        # App Intent for widget button
└── Info.plist                    # Microphone permission, background modes
```

### App Flow

```
Launch
  │
  ├── Config exists? → ContentView (record button + list)
  │
  └── No config? → PairingView (QR scanner)
                      │
                      └── Scan QR → save endpoint + token → ContentView
```

### ContentView

```swift
struct ContentView: View {
    @StateObject var recorder = AudioRecorder()
    @StateObject var store = RecordingStore()

    var body: some View {
        VStack {
            Spacer()

            RecordButton(isRecording: recorder.isRecording) {
                if recorder.isRecording {
                    recorder.stop()
                    // Upload starts automatically
                } else {
                    recorder.start()
                }
            }

            Spacer()

            // Recent recordings list
            List(store.recent) { recording in
                RecordingRow(recording: recording)
            }
        }
    }
}
```

### AudioRecorder

```swift
class AudioRecorder: ObservableObject {
    @Published var isRecording = false
    private var recorder: AVAudioRecorder?

    func start() {
        // Request mic permission if needed
        // Configure AVAudioSession for recording
        // Settings: m4a, AAC, 44100 Hz, mono
        // Start recording to temp file
        // Haptic feedback (impact, medium)
        isRecording = true
    }

    func stop() {
        // Stop recording
        // Haptic feedback (impact, light)
        // Move file to local storage
        // Trigger upload via Uploader
        isRecording = false
    }
}
```

### Uploader

```swift
class Uploader {
    // Uses URLSession background upload task
    // Survives app being closed
    // Retry logic: exponential backoff (3 attempts)
    // Updates RecordingStore sync status on completion

    func upload(fileURL: URL) {
        var request = URLRequest(url: config.endpoint.appendingPathComponent("api/upload"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(config.token)", forHTTPHeaderField: "Authorization")

        let task = backgroundSession.uploadTask(with: request, fromFile: fileURL)
        task.resume()
    }
}
```

### QR Pairing

QR code contains JSON:
```json
{"endpoint": "https://voice.kabardin.com", "token": "sd_a7f3..."}
```

App scans → parses → saves to Keychain → navigates to ContentView.

### RecordingStore

Local persistence of recordings list:

```swift
struct Recording: Identifiable, Codable {
    let id: String          // UUID
    let filename: String    // local filename
    let duration: TimeInterval
    let createdAt: Date
    var syncStatus: SyncStatus  // .pending, .uploading, .synced, .failed
}

enum SyncStatus: String, Codable {
    case pending, uploading, synced, failed
}
```

Storage: UserDefaults (simple) or SwiftData (if list grows large). Start with UserDefaults.

### Widget

```swift
// SlopDropWidget.swift
// Interactive widget with a record button
// Uses App Intents framework (iOS 17+)
// Tap → opens app with recording already started
// Or: Live Activity showing recording duration
```

Widget is a stretch goal for MVP. Core app first.

### Permissions

```xml
<!-- Info.plist -->
<key>NSMicrophoneUsageDescription</key>
<string>SlopDrop records audio to sync to your server.</string>
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>        <!-- Recording in background -->
    <string>fetch</string>        <!-- Background upload -->
</array>
<key>NSCameraUsageDescription</key>
<string>SlopDrop uses the camera to scan QR codes for server pairing.</string>
```

---

## 4. Project Structure

```
slopdrop/
├── package.json              # npm start entry, dependencies
├── tsconfig.json
├── cli/
│   ├── index.ts              # Entry: detect config → setup or manage
│   ├── setup.ts              # Interactive setup wizard
│   ├── manage.ts             # Status + management menu
│   ├── deploy.ts             # SSH deploy to remote VPS
│   └── qr.ts                 # QR code generation + display
├── server/
│   ├── index.ts              # Express app
│   ├── auth.ts               # Token validation middleware
│   ├── storage.ts            # JSONL read/write helpers
│   └── webhook.ts            # Webhook dispatch
├── docker-compose.yml
├── Dockerfile
├── nginx/
│   └── slopdrop.conf         # Nginx template (used by CLI deploy)
├── app/                      # iOS Xcode project
│   ├── SlopDrop.xcodeproj/
│   ├── SlopDrop/
│   │   ├── SlopDropApp.swift
│   │   ├── ContentView.swift
│   │   ├── PairingView.swift
│   │   ├── RecordButton.swift
│   │   ├── RecordingRow.swift
│   │   ├── AudioRecorder.swift
│   │   ├── Uploader.swift
│   │   ├── RecordingStore.swift
│   │   └── Config.swift
│   └── SlopDropWidget/
├── README.md
├── SPEC.md                   # This file
├── LICENSE                   # MIT
└── .github/
    └── CONTRIBUTING.md
```

---

## 5. MVP Milestones

### Day 1: Server
- [ ] Express app with `/api/upload`, `/api/recordings`, `/api/health`
- [ ] JSONL storage
- [ ] Token auth middleware
- [ ] Docker + docker-compose.yml

### Day 2-3: CLI
- [ ] `npm start` entry point
- [ ] First-run detection
- [ ] Local setup (start server on localhost)
- [ ] QR code display in terminal
- [ ] Remote VPS setup via SSH
- [ ] Management mode (status, QR, health)

### Day 4-6: iOS App
- [ ] SwiftUI project scaffold
- [ ] QR scanner (PairingView)
- [ ] Audio recording (AVAudioRecorder)
- [ ] Background upload (URLSession)
- [ ] Recording list with sync status
- [ ] Haptic feedback

### Day 7: Polish
- [ ] README finalized
- [ ] Error handling (network failures, auth errors)
- [ ] TestFlight build
- [ ] First GitHub release

### Post-MVP
- [ ] Webhook support
- [ ] Lock screen widget
- [ ] `POST /api/recordings/:id/processed` endpoint
- [ ] Nginx config template for CLI deploy
- [ ] Let's Encrypt automation in CLI

---

## 6. Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| One repo for everything | CLI + server + app in one repo | Simple to clone, simple to contribute |
| JSONL not SQLite | Filesystem storage | Zero deps, greppable, append-only fits use case |
| No playback in app | Server has the audio | Keeps app minimal, avoids audio player complexity |
| No transcription | Your agents' job | SlopDrop is a pipe, not a brain |
| Bearer token auth | Single shared token | No user management needed for personal tool |
| m4a/AAC format | iOS native, good compression | ~1MB per minute, compatible everywhere |
| Background URLSession | iOS native background upload | Survives app close, OS manages retries |
| `npm start` not `npx` | Clone-first model (OpenClaw) | User has full source, can modify anything |

---

## 7. Security Notes

- Token stored in iOS Keychain (not UserDefaults)
- HTTPS enforced for remote servers (Let's Encrypt)
- No authentication on `/api/health` (intentional — monitoring tools need it)
- Audio files served only with valid token
- Token is single-use per server (no user accounts, no sharing)
- For localhost mode: token still required (prevents LAN neighbors from uploading)
