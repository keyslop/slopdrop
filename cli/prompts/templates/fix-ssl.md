I'm setting up SlopDrop (github.com/keyslop/slopdrop) and Let's Encrypt SSL setup failed.

Server: {{server_ip}} ({{ssh_user}})
Domain: {{domain}}
Error: {{error_message}}

Please SSH to the server and:
1. Verify DNS resolves: `dig {{domain}} +short` should return {{server_ip}}
2. Check nginx is running: `systemctl status nginx`
3. Ensure port 80 is open (certbot needs it for HTTP challenge)
4. Try running certbot manually:
   ```
   certbot --nginx -d {{domain}} --non-interactive --agree-tos --email admin@{{domain}}
   ```
5. Check certbot logs: `journalctl -u certbot` or `/var/log/letsencrypt/letsencrypt.log`

Once SSL is set up, I'll re-run `npm start` to continue.
