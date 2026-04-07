I'm working on SlopDrop (github.com/keyslop/slopdrop).
The CLI setup wizard currently targets macOS. I want to add Linux support.

Repo path: {{repo_path}}

Please read AGENTS.md for full project context, then:

1. Update `cli/wizard/steps/toolchain.ts`:
   - Detect Linux distro (Ubuntu/Debian vs Fedora/RHEL vs Arch)
   - Install uv via the same curl script (works on Linux)
   - Use apt/dnf/pacman instead of brew where needed

2. Update `cli/bootstrap.ts`:
   - Linux-specific paths for uv (~/.local/bin/uv)
   - Package manager detection and commands

3. Update `cli/infra/platform.ts`:
   - Any Linux-specific path handling

4. Test that the full wizard flow works on Linux

Most of the pyinfra and server code should work as-is since it targets Ubuntu servers.

Then submit an MR to github.com/keyslop/slopdrop!
