---
name: slopdrop-debug
description: Debug SlopDrop server problems — check Docker, nginx, logs, disk, connectivity
---

# SlopDrop Server Debugging

Use this skill to diagnose and fix issues with a running SlopDrop server.

## Diagnostic Checklist

SSH to the server and run:

```bash
# 1. Container status
docker ps -a --filter name=slopdrop

# 2. Container logs
docker logs slopdrop --tail 100

# 3. Nginx status
systemctl status nginx
nginx -t

# 4. Nginx error log
tail -50 /var/log/nginx/error.log

# 5. Port check
ss -tlnp | grep -E '3847|:80|:443'

# 6. API health (from server itself)
curl -s http://localhost:3847/api/health

# 7. Disk usage
df -h /
du -sh /var/lib/slopdrop

# 8. SSL cert check (if domain configured)
openssl s_client -connect <domain>:443 -servername <domain> </dev/null 2>/dev/null | openssl x509 -noout -dates

# 9. Memory
free -h

# 10. Docker logs with timestamps
docker logs slopdrop --tail 50 --timestamps
```

## Common Issues

### Container keeps restarting
- Check logs: `docker logs slopdrop --tail 50`
- Usually missing SLOPDROP_TOKEN env var — check `.env` file in `/opt/slopdrop/`
- Or missing server files — check `/opt/slopdrop/server/` exists

### 502 Bad Gateway from nginx
- Container isn't running or not listening on 3847
- Check: `docker ps` and `ss -tlnp | grep 3847`
- Restart: `cd /opt/slopdrop && docker compose up -d`

### Uploads failing
- Check `client_max_body_size` in nginx config (should be 50M)
- Check disk space: `df -h /`
- Check token matches: compare client token with `SLOPDROP_TOKEN` in `.env`

### SSL certificate expired
- Renew: `certbot renew`
- Force renew: `certbot renew --force-renewal`
- Check auto-renewal timer: `systemctl status certbot.timer`

## Key Paths on Server
- App dir: `/opt/slopdrop/`
- Data dir: `/var/lib/slopdrop/`
- Recordings: `/var/lib/slopdrop/recordings/`
- Metadata: `/var/lib/slopdrop/metadata.jsonl`
- Nginx config: `/etc/nginx/sites-available/slopdrop`
- Docker compose: `/opt/slopdrop/docker-compose.yml`
- Token: `/opt/slopdrop/.env`
