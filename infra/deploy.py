"""
Deploy SlopDrop server to a provisioned VPS.

Renders docker-compose and nginx configs from templates,
deploys them, and starts the services.
"""

import os
import tempfile
import atexit

from jinja2 import Environment, FileSystemLoader
from pyinfra import host
from pyinfra.operations import files, server, systemd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

_jinja_env = Environment(loader=FileSystemLoader(os.path.join(SCRIPT_DIR, "config")))
_temp_files: list[str] = []


def _cleanup():
    for f in _temp_files:
        try:
            os.unlink(f)
        except OSError:
            pass


atexit.register(_cleanup)


def render_template(template_rel_path: str, **extra_vars) -> str:
    """Render a Jinja2 template, return path to temp file."""
    template = _jinja_env.get_template(template_rel_path)
    ctx = {
        "domain": host.data.get("domain", ""),
        "token": host.data.get("token", ""),
        "app_dir": host.data.get("app_dir", "/opt/slopdrop"),
        "data_dir": host.data.get("data_dir", "/var/lib/slopdrop"),
        **extra_vars,
    }
    rendered = template.render(**ctx)
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".conf", delete=False)
    tmp.write(rendered)
    tmp.close()
    _temp_files.append(tmp.name)
    return tmp.name


# --- Docker Compose ---

compose_src = render_template("docker/docker-compose.yml.j2")
app_dir = host.data.get("app_dir", "/opt/slopdrop")

files.put(
    name="Deploy docker-compose.yml",
    src=compose_src,
    dest=f"{app_dir}/docker-compose.yml",
)

# Create .env file with token
server.shell(
    name="Write .env with token",
    commands=[
        f'echo "SLOPDROP_TOKEN={host.data.get("token", "")}" > {app_dir}/.env',
    ],
)


# --- Nginx config ---

domain = host.data.get("domain", "")

if domain:
    # Check if SSL cert exists (certbot may have been run already)
    # If not, deploy HTTP-only config first for certbot challenge
    nginx_template = "nginx/slopdrop.conf.j2"
else:
    # No domain — just proxy on IP (no SSL)
    nginx_template = "nginx/slopdrop.conf.j2"

nginx_src = render_template(nginx_template)

files.put(
    name="Deploy nginx config",
    src=nginx_src,
    dest="/etc/nginx/sites-available/slopdrop",
)

server.shell(
    name="Enable nginx site",
    commands=[
        "ln -sf /etc/nginx/sites-available/slopdrop /etc/nginx/sites-enabled/slopdrop",
        "rm -f /etc/nginx/sites-enabled/default",
    ],
)

server.shell(
    name="Test nginx config",
    commands=["nginx -t"],
)

systemd.service(
    name="Reload nginx",
    service="nginx",
    reloaded=True,
)


# --- Build and start SlopDrop ---

server.shell(
    name="Pull SlopDrop Docker image and start",
    commands=[
        f"cd {app_dir} && docker compose up -d --build 2>&1 || "
        # If no Dockerfile on server, use the pre-built image approach
        f"cd {app_dir} && docker compose pull && docker compose up -d",
    ],
)


# --- SSL (if domain configured) ---

if domain:
    server.shell(
        name="Request SSL certificate",
        commands=[
            f"certbot --nginx -d {domain} --non-interactive --agree-tos "
            f"--email admin@{domain} --redirect "
            "|| echo 'Certbot failed — may need manual setup'",
        ],
    )

    systemd.service(
        name="Reload nginx after SSL",
        service="nginx",
        reloaded=True,
    )
