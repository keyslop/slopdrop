---
name: slopdrop-contribute
description: How to add features, platform support, and contribute to SlopDrop
---

# Contributing to SlopDrop

## Adding a New Wizard Step

1. Create `cli/wizard/steps/your-step.ts`:
```typescript
import type { WizardPrompter } from '../prompter.js';
import type { WizardState } from '../index.js';

export async function stepYourStep(p: WizardPrompter, state: WizardState): Promise<boolean> {
  // Use p.select(), p.text(), p.confirm() for interaction
  // Use p.spinner() for long operations
  // Return false to abort wizard, true to continue
  return true;
}
```

2. Import and call it in `cli/wizard/index.ts` at the right point in the flow.

3. If the step can fail, create a prompt template at `cli/prompts/templates/fix-your-thing.md` and call `showPrompt()` in the error path.

## Adding a New Prompt Template

Create `cli/prompts/templates/your-template.md` with `{{placeholder}}` variables:
```markdown
I'm setting up SlopDrop and [thing] failed.

Server: {{server_ip}}
Error: {{error_message}}

Please help me fix [thing].
```

The `renderPrompt()` function replaces `{{key}}` with values from the context object.

## Adding Platform Support

See `cli/prompts/templates/add-linux.md` and `add-windows.md` for the full checklist. Key files:
- `cli/infra/platform.ts` — detection
- `cli/wizard/steps/toolchain.ts` — install commands
- `cli/bootstrap.ts` — paths

## Adding PyInfra Operations

Add operations to `infra/provision.py` or `infra/deploy.py`. If you need new config templates, put them in `infra/config/` as `.j2` files. Access host data via `host.data.get("key")`.

## Ideas for Contributions

- **Android app** — Kotlin/Compose equivalent of the iOS app
- **Web recorder** — Simple HTML page with MediaRecorder API
- **Webhook templates** — Pre-built webhook handlers for common use cases
- **Monitoring dashboard** — Simple web UI showing recording stats
- **Auto-transcription agent** — Example agent that processes recordings with Whisper
- **Multi-user support** — Multiple tokens, per-user storage
- **S3 backend** — Store recordings in S3/R2 instead of local disk
- **Push notifications** — Notify when recording is processed

Pick one and submit an MR!
