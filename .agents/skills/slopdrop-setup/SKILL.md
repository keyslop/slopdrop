---
name: slopdrop-setup
description: Debug and fix SlopDrop server setup issues — provisioning, SSH, Docker, nginx, SSL
---

# SlopDrop Setup Troubleshooting

Use this skill when the SlopDrop interactive setup wizard fails at any step.

## Common Failure Points

### SSH Connection Failed
- Check `ssh root@<ip>` works from local machine
- Verify SSH key is in `~/.ssh/authorized_keys` on server
- Ensure port 22 is open: `ufw status` or cloud provider firewall
- Check `sshd` is running: `systemctl status sshd`

### Docker Installation Failed
- Verify Ubuntu version: `lsb_release -a` (need 22.04 or 24.04)
- Check apt isn't locked: `fuser /var/lib/dpkg/lock-frontend`
- Manual install: `curl -fsSL https://get.docker.com | sh`
- Verify: `docker ps`

### Nginx Issues
- Test config: `nginx -t`
- Check sites-enabled: `ls -la /etc/nginx/sites-enabled/`
- View error log: `tail -50 /var/log/nginx/error.log`
- Restart: `systemctl restart nginx`

### SSL/Certbot Failed
- DNS must resolve first: `dig <domain> +short` must return server IP
- Port 80 must be open for HTTP challenge
- Manual certbot: `certbot --nginx -d <domain> --non-interactive --agree-tos --email admin@<domain>`
- Certbot logs: `/var/log/letsencrypt/letsencrypt.log`

### PyInfra Failed
- Ensure uv is installed: `uv --version`
- Sync deps: `cd infra && uv sync`
- Run with verbose: `cd infra && uv run pyinfra -v inventories.py provision.py`
- Check inventory: `cat ~/.slopdrop/infra-inventory.json`

## Files to Read
- `infra/provision.py` — what gets installed on first provision
- `infra/deploy.py` — what gets deployed (docker-compose, nginx)
- `infra/inventories.py` — how host data is loaded
- `infra/config/nginx/slopdrop.conf.j2` — nginx template
- `cli/wizard/steps/provision.ts` — how CLI invokes pyinfra

## Fix Policy
Every server fix must also be a pyinfra fix. If you SSH to debug, update infra/provision.py or infra/deploy.py too. Manual server changes get overwritten on next redeploy. If a user's setup diverges significantly from defaults, suggest they fork the repo.
