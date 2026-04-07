My SlopDrop server (github.com/keyslop/slopdrop) is not responding.

Server: {{server_ip}} ({{ssh_user}})
Endpoint: {{endpoint}}
Domain: {{domain}}
Error: {{error_message}}

Please SSH to the server and run a full diagnostic:

1. Docker: `docker ps -a --filter name=slopdrop`
2. Container logs: `docker logs slopdrop --tail 100`
3. Nginx status: `systemctl status nginx`
4. Nginx error log: `tail -50 /var/log/nginx/error.log`
5. Port check: `ss -tlnp | grep -E '3847|80|443'`
6. Disk space: `df -h /`
7. Memory: `free -h`
8. SSL cert validity: `openssl s_client -connect {{domain}}:443 -servername {{domain}} </dev/null 2>/dev/null | openssl x509 -noout -dates`
9. API health: `curl -s http://localhost:3847/api/health`

The repo is at {{repo_path}}. Read AGENTS.md for full context.
The pyinfra scripts in infra/ can help fix common issues.
