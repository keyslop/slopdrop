"""
Health check operations for SlopDrop server.
Run via: uv run pyinfra inventories.py health.py
"""

from pyinfra.operations import server


server.shell(
    name="Docker container status",
    commands=["docker ps -a --filter name=slopdrop --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"],
)

server.shell(
    name="Nginx status",
    commands=["systemctl is-active nginx && echo 'nginx: running' || echo 'nginx: stopped'"],
)

server.shell(
    name="API health check",
    commands=["curl -sf http://localhost:3847/api/health || echo 'API: unreachable'"],
)

server.shell(
    name="Disk usage",
    commands=["df -h / | tail -1"],
)

server.shell(
    name="SlopDrop data size",
    commands=["du -sh /var/lib/slopdrop 2>/dev/null || echo 'No data directory'"],
)

server.shell(
    name="Port check",
    commands=["ss -tlnp | grep -E '3847|:80|:443' || echo 'No matching ports'"],
)

server.shell(
    name="Recent container logs",
    commands=["docker logs slopdrop --tail 20 2>&1 || echo 'No container logs'"],
)
