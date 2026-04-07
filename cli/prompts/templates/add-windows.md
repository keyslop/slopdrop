I'm working on SlopDrop (github.com/keyslop/slopdrop).
The CLI setup wizard currently targets macOS. I want to add Windows support.

Repo path: {{repo_path}}

Please read AGENTS.md for full project context, then:

1. Update `cli/wizard/steps/toolchain.ts`:
   - Install uv via PowerShell: `irm https://astral.sh/uv/install.ps1 | iex`
   - Use winget/chocolatey/scoop for system deps
   - Handle Windows SSH (OpenSSH client)

2. Update `cli/bootstrap.ts`:
   - Windows-specific paths for uv
   - PowerShell vs cmd detection

3. Update `cli/infra/platform.ts`:
   - Windows path separators and home directory
   - Handle lack of pbcopy (use clip.exe instead)

4. Update `cli/boot.js`:
   - Windows-compatible path to tsx binary (.cmd extension)

5. Test the full wizard flow on Windows

Then submit an MR to github.com/keyslop/slopdrop!
