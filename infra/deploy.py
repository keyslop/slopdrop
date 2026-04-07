"""
Deploy SlopDrop server to a provisioned VPS.

Syncs server code, renders docker-compose and nginx configs from templates,
installs deps inside the container, and starts the services.
"""

import os
import tempfile
import atexit

from jinja2 import Environment, FileSystemLoader
from pyinfra import host
from pyinfra.operations import files, server, systemd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(SCRIPT_DIR)  # parent of infra/

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


app_dir = host.data.get("app_dir", "/opt/slopdrop")


# --- Sync server code to VPS ---

files.rsync(
    name="Sync server code to VPS",
    src=f"{REPO_DIR}/server/",
    dest=f"{app_dir}/server/",
    flags=["-az", "--delete"],
)

files.put(
    name="Deploy package.json",
    src=f"{REPO_DIR}/package.json",
    dest=f"{app_dir}/package.json",
)

files.put(
    name="Deploy package-lock.json",
    src=f"{REPO_DIR}/package-lock.json",
    dest=f"{app_dir}/package-lock.json",
)

files.put(
    name="Deploy tsconfig.json",
    src=f"{REPO_DIR}/tsconfig.json",
    dest=f"{app_dir}/tsconfig.json",
)


# --- Docker Compose ---

compose_src = render_template("docker/docker-compose.yml.j2")

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


# --- Install deps inside container working dir ---

server.shell(
    name="Install node dependencies on server (via Docker)",
    commands=[
        f"docker run --rm -v {app_dir}:/app -w /app node:22-slim npm ci --omit=dev 2>&1 "
        f"|| docker run --rm -v {app_dir}:/app -w /app node:22-slim npm install --omit=dev 2>&1",
    ],
)


# --- Nginx config ---

domain = host.data.get("domain", "")
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


# --- Restart SlopDrop container ---

server.shell(
    name="Restart SlopDrop container",
    commands=[
        f"cd {app_dir} && docker compose down 2>&1 || true",
        f"cd {app_dir} && docker compose up -d",
    ],
)

# Wait and verify
server.shell(
    name="Verify container is running",
    commands=[
        "sleep 3",
        "docker ps --filter name=slopdrop --format '{{.Status}}'",
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
