I'm setting up SlopDrop (github.com/keyslop/slopdrop) and the deployment to my server failed.

Server: {{server_ip}} ({{ssh_user}})
Domain: {{domain}}
Error: {{error_message}}

Please SSH to the server and:
1. Check Docker containers: `docker ps -a`
2. Check container logs: `docker logs slopdrop`
3. Verify the docker-compose file: `cat /opt/slopdrop/docker-compose.yml`
4. Try restarting: `cd /opt/slopdrop && docker compose up -d`
5. Check if the port is listening: `ss -tlnp | grep 3847`
6. Check nginx config: `nginx -t`

The repo is at {{repo_path}}. Read AGENTS.md and infra/deploy.py for deployment details.
Once the server is running, I'll re-run `npm start` to continue.
