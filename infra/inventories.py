"""
Dynamic inventory for SlopDrop pyinfra deployment.

Reads host configuration from ~/.slopdrop/infra-inventory.json,
which is written by the CLI wizard before invoking pyinfra.

Format:
{
    "host": "135.181.38.99",
    "ssh_user": "root",
    "domain": "voice.example.com",
    "token": "sd_abc123..."
}
"""

import json
import os

INVENTORY_PATH = os.path.expanduser("~/.slopdrop/infra-inventory.json")

if not os.path.exists(INVENTORY_PATH):
    raise SystemExit(
        f"No inventory found at {INVENTORY_PATH}.\n"
        "Run `npm start` to configure SlopDrop first."
    )

with open(INVENTORY_PATH) as f:
    inv = json.load(f)

host = inv["host"]
ssh_user = inv.get("ssh_user", "root")
domain = inv.get("domain", "")
token = inv.get("token", "")

# PyInfra 3.x inventory format
slopdrop = (
    [host],
    {
        "ssh_user": ssh_user,
        # Host data accessible via host.data in deploy scripts
        "domain": domain,
        "token": token,
        "app_dir": "/opt/slopdrop",
        "data_dir": "/var/lib/slopdrop",
    },
)
