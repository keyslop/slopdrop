# SlopDrop — Agent Instructions

Self-hosted voice memo server. Phone records audio → uploads to your VPS → your agents process it.

## Quick Start

```bash
git clone https://github.com/keyslop/slopdrop
cd slopdrop
npm start
```

`npm start` self-bootstraps: installs deps if needed, then launches the interactive setup wizard.

## Repository Structure

```
slopdrop/
├── cli/                        # Node.js/TypeScript interactive CLI
│   ├── boot.js                 # Plain JS bootstrapper (zero deps, makes npm start work from fresh clone)
│   ├── index.ts                # Entry: config exists → manage, else → wizard
│   ├── bootstrap.ts            # Installs uv + syncs pyinfra
│   ├── config.ts               # ~/.slopdrop/config.json read/write
│   ├── wizard/                 # Setup wizard
│   │   ├── index.ts            # Step sequencer
│   │   ├── prompter.ts         # WizardPrompter abstraction over @clack/prompts
│   │   ├── ui.ts               # chalk formatting, ASCII banner, tables, icons
│   │   └── steps/              # Each step is a module: welcome, vps, hosting, toolchain,
│   │                           # ssh-check, provision, domain, ssl, deploy, auth, qr, complete
│   ├── manage/                 # Management mode (status, QR, logs, monitoring)
│   ├── infra/                  # Platform detection, SSH wrapper, pyinfra bridge
│   └── prompts/                # "Generate a prompt for your AI agent" system
│       ├── render.ts           # Template renderer with {{mustache}} substitution
│       └── templates/          # Markdown prompt templates for failure scenarios
│
├── infra/                      # pyinfra deployment (Python, managed by uv)
│   ├── pyproject.toml          # pyinfra>=3.0, jinja2
│   ├── inventories.py          # Reads ~/.slopdrop/infra-inventory.json
│   ├── provision.py            # First-time: Docker, nginx, certbot, UFW
│   ├── deploy.py               # Deploy: docker-compose, nginx config, SSL
│   ├── health.py               # Diagnostic checks
│   └── config/                 # Jinja2 templates for nginx, docker-compose
│
├── server/                     # Express.js server (~150 lines, deployed via Docker)
│   ├── index.ts                # API: upload, recordings, health, webhook
│   ├── auth.ts                 # Bearer token middleware
│   ├── storage.ts              # JSONL metadata read/write
│   └── webhook.ts              # Fire-and-forget webhook dispatch
│
├── Dockerfile                  # Server Docker image
├── docker-compose.yml          # Local dev compose
└── .agents/skills/             # AI agent skill definitions
```

## Architecture Boundaries

- **CLI** (`cli/`): Node.js/TypeScript. Interactive prompts via @clack/prompts. Spawns pyinfra as subprocess.
- **Infra** (`infra/`): Python. pyinfra scripts for server provisioning. Invoked via `uv run pyinfra`.
- **Server** (`server/`): Node.js/TypeScript. Express.js. Runs in Docker on the VPS.
- **Bridge**: CLI writes `~/.slopdrop/infra-inventory.json` → pyinfra's `inventories.py` reads it.

## Key Patterns

### Wizard Steps
Each step in `cli/wizard/steps/` is a function: `(prompter, state) → Promise<boolean>`. Steps can:
- Ask questions via the prompter
- Run pyinfra via `cli/infra/pyinfra.ts`
- Test SSH via `cli/infra/ssh.ts`
- On failure: call `showPrompt('template.md', context)` to generate an AI agent prompt

### Prompt Generation
When the CLI hits a problem it can't auto-fix, it renders a Markdown template from `cli/prompts/templates/` with context variables (server IP, error message, etc.) and displays it as a ready-made prompt for the user's AI agent.

To add a new prompt template:
1. Create `cli/prompts/templates/your-template.md` with `{{placeholder}}` variables
2. Call `showPrompt('your-template.md', { ...context })` from your step's error path

### PyInfra Scripts
Follow patterns from the existing scripts:
- `inventories.py` provides host data via `host.data.get("key")`
- Templates in `infra/config/` use Jinja2 with variables from host data
- `render_template()` in deploy.py renders to temp file → `files.put()` to server

## Deployment Fix Policy

**Every server fix must be a pyinfra fix.** If you SSH to a server to fix something (install a package, edit a config, restart a service), that fix must also go into `infra/provision.py` or `infra/deploy.py`. Manual fixes on a server are temporary — the next redeploy will overwrite them.

- Fix it on the server first (to unblock), then immediately update the pyinfra script
- If you're an agent helping a user debug: propose the pyinfra change, not just the SSH command
- If a contributor's setup diverges significantly from the defaults (custom nginx, different OS, non-Docker), suggest they fork the repo and maintain their own infra/ scripts
- The pyinfra scripts are the source of truth for server state — treat them like code, not notes

## Development Commands

```bash
npm start                       # Full wizard (or management if configured)
npx tsx server/index.ts         # Run server locally (needs SLOPDROP_TOKEN env var)
cd infra && uv run pyinfra inventories.py provision.py   # Manual provision
cd infra && uv run pyinfra inventories.py deploy.py      # Manual deploy
cd infra && uv run pyinfra inventories.py health.py      # Manual health check
```

## Adding Features

### New wizard step
1. Create `cli/wizard/steps/your-step.ts` exporting `stepYourStep(p, state)`
2. Add import and call in `cli/wizard/index.ts`
3. Add a failure prompt template if the step can fail

### New pyinfra operation
1. Add operations to `infra/provision.py` or `infra/deploy.py`
2. Add Jinja2 templates to `infra/config/` if needed
3. Update `inventories.py` if new host data fields are needed

### New platform support
1. Update `cli/infra/platform.ts` with detection
2. Update `cli/wizard/steps/toolchain.ts` with install commands
3. Update `cli/bootstrap.ts` with platform-specific paths
4. Add/update prompt template in `cli/prompts/templates/`

## Data & Config

- **Config**: `~/.slopdrop/config.json` — mode, endpoint, token, server_ip, domain
- **Inventory**: `~/.slopdrop/infra-inventory.json` — pyinfra reads this
- **Recordings**: `~/.slopdrop/recordings/*.m4a` (server-side: `/var/lib/slopdrop/recordings/`)
- **Metadata**: `~/.slopdrop/metadata.jsonl` — one JSON line per recording

## Philosophy

SlopDrop is a pipe. It doesn't judge, it doesn't transcribe, it doesn't process. It drops your voice slop on your server. What happens next is your problem (and your agents' job).

When the CLI is stuck, it generates a prompt for your AI agent. When a platform isn't supported, it asks for an MR. The repo is designed to be understood and extended by both humans and AI agents.
