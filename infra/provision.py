"""
First-time server provisioning for SlopDrop.

Installs Docker, nginx, certbot, configures firewall.
Idempotent — safe to run multiple times.
"""

from pyinfra import host
from pyinfra.operations import apt, files, server, systemd


# --- Wait for apt lock (common on fresh Ubuntu) ---

server.shell(
    name="Wait for apt lock",
    commands=[
        "while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 2; done",
    ],
)


# --- System packages ---

apt.update(
    name="Update apt cache",
    cache_time=3600,
)

apt.packages(
    name="Install base packages",
    packages=[
        "curl",
        "gnupg",
        "ca-certificates",
        "lsb-release",
        "ufw",
        "fail2ban",
    ],
)


# --- Docker ---

server.shell(
    name="Add Docker GPG key",
    commands=[
        "install -m 0755 -d /etc/apt/keyrings",
        "curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc",
        "chmod a+r /etc/apt/keyrings/docker.asc",
    ],
)

server.shell(
    name="Add Docker APT repository",
    commands=[
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] '
        'https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" '
        "| tee /etc/apt/sources.list.d/docker.list > /dev/null",
    ],
)

apt.update(
    name="Update apt cache (with Docker repo)",
)

apt.packages(
    name="Install Docker",
    packages=[
        "docker-ce",
        "docker-ce-cli",
        "containerd.io",
        "docker-buildx-plugin",
        "docker-compose-plugin",
    ],
)

systemd.service(
    name="Enable and start Docker",
    service="docker",
    running=True,
    enabled=True,
)


# --- Nginx ---

apt.packages(
    name="Install nginx",
    packages=["nginx"],
)

systemd.service(
    name="Enable and start nginx",
    service="nginx",
    running=True,
    enabled=True,
)


# --- Certbot ---

apt.packages(
    name="Install certbot",
    packages=[
        "certbot",
        "python3-certbot-nginx",
    ],
)


# --- Firewall ---

server.shell(
    name="Configure UFW firewall",
    commands=[
        "ufw default deny incoming",
        "ufw default allow outgoing",
        "ufw allow 22/tcp",
        "ufw allow 80/tcp",
        "ufw allow 443/tcp",
        "echo 'y' | ufw enable",
    ],
)


# --- SlopDrop directories ---

app_dir = host.data.get("app_dir", "/opt/slopdrop")
data_dir = host.data.get("data_dir", "/var/lib/slopdrop")

files.directory(
    name="Create app directory",
    path=app_dir,
    present=True,
)

files.directory(
    name="Create data directory",
    path=data_dir,
    present=True,
)

files.directory(
    name="Create recordings directory",
    path=f"{data_dir}/recordings",
    present=True,
)
