I'm setting up SlopDrop (github.com/keyslop/slopdrop) and Docker installation/startup failed on my server.

Server: {{server_ip}} ({{ssh_user}})
Error: {{error_message}}

Please SSH to the server and:
1. Check if Docker is installed: `docker --version`
2. If not, install Docker CE:
   ```
   curl -fsSL https://get.docker.com | sh
   systemctl enable docker
   systemctl start docker
   ```
3. Verify Docker is running: `docker ps`
4. Check for disk space issues: `df -h /`

The repo is at {{repo_path}}. Read AGENTS.md for the full setup context.
Once Docker works, I'll re-run `npm start` to continue.
