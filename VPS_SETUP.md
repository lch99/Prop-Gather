# VPS setup — day one

Taking a brand-new Ubuntu VPS from "here are your root credentials" to a
hardened machine ready to run PropGather. Run these **in order**; each step ends
with a check you should actually perform before moving on.

This covers **the machine**. Deploying the app onto it — clone, R2, env,
systemd, nginx, TLS, admin, backups — is [DEPLOYMENT.md](DEPLOYMENT.md) Part 2,
which picks up exactly where this leaves off.

Target: **Ubuntu 22.04 or 24.04 LTS**. Sizing guidance (and why 2 GB is the
sweet spot) is in [DEPLOYMENT.md](DEPLOYMENT.md) §2.0.

---

## Before you start

- [ ] VPS IP address and root access (password or SSH key)
- [ ] A domain or subdomain you control — this guide uses `api.propgather.com`
- [ ] Access to that domain's DNS records
- [ ] An SSH key on your own machine. Check with `ls ~/.ssh/id_ed25519.pub`; if
      it's missing, create one **locally** (not on the VPS):
      ```bash
      ssh-keygen -t ed25519 -C "you@example.com"
      ```

⚠️ **Never close your first SSH session until a second one works.** Steps 3 and
7 can lock you out of the machine if something's wrong. Always test in a new
terminal window while the old one is still connected.

---

## 1. First login

```bash
ssh root@YOUR_SERVER_IP
```

Some providers (AWS, GCP, Oracle) give you a non-root sudo user instead —
`ubuntu`, `azureuser`, etc. If so, skip to step 4 and use `sudo` throughout.

---

## 2. Create your own user

Working as root full-time is how small mistakes become unrecoverable ones.

```bash
adduser chee                    # prompts for a password — use a strong one
usermod -aG sudo chee
```

Give it your SSH key. If you logged in as root **with a key**, copy root's:

```bash
mkdir -p /home/chee/.ssh
cp ~/.ssh/authorized_keys /home/chee/.ssh/authorized_keys
chown -R chee:chee /home/chee/.ssh
chmod 700 /home/chee/.ssh
chmod 600 /home/chee/.ssh/authorized_keys
```

If you logged in with a **password**, run this from your **local machine**
instead:

```bash
ssh-copy-id chee@YOUR_SERVER_IP
```

**Check — in a new terminal, leaving the root session open:**

```bash
ssh chee@YOUR_SERVER_IP
sudo whoami        # must print: root
```

Only continue once that works.

---

## 3. Harden SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Set these three (they exist in the file — edit rather than append):

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

⚠️ **The gotcha that catches almost everyone.** Cloud Ubuntu images drop
override files in `/etc/ssh/sshd_config.d/`, and those win over the main file —
so `PasswordAuthentication no` above can silently do nothing. Check:

```bash
sudo grep -r "PasswordAuthentication" /etc/ssh/sshd_config.d/ 2>/dev/null
```

If anything turns up set to `yes`, edit that file too.

Apply, and confirm what the server *actually* ended up with:

```bash
sudo systemctl restart ssh          # Ubuntu 24.04: also `sudo systemctl restart ssh.socket`
sudo sshd -T | grep -E "permitrootlogin|passwordauthentication"
```

Expect `permitrootlogin no` and `passwordauthentication no`. That command reads
the effective merged config, overrides included — it's the only reliable check.

**Check — new terminal again, old session still open:**

```bash
ssh chee@YOUR_SERVER_IP        # must still work
ssh root@YOUR_SERVER_IP        # must now be refused
```

Now you can close the root session.

---

## 4. Update, name, and set the clock

```bash
sudo apt update && sudo apt upgrade -y
sudo hostnamectl set-hostname propgather
sudo timedatectl set-timezone Asia/Kuala_Lumpur
```

Timestamps are stored as UTC ISO strings in the database regardless — the
timezone just makes `journalctl` output and cron schedules readable to you.

If the upgrade touched the kernel, reboot now: `sudo reboot`.

---

## 5. Swap

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Nothing compiles from source, so this is prudence rather than a prerequisite —
but still worth having: MySQL and Node share this box, and swap is what turns a
memory spike into a slow moment rather than an OOM kill of `mysqld`.

**Check:** `free -h` shows a 2.0Gi swap line.

---

## 6. Install packages

```bash
sudo apt install -y git curl nginx mysql-server ufw fail2ban unattended-upgrades
```

Why each: **mysql-server** is the database (configured in
[DEPLOYMENT.md](DEPLOYMENT.md) §2.4 — user, grants, buffer pool); **nginx**
terminates TLS in front of Node; the rest is security housekeeping.

No compiler toolchain is needed — `mysql2` is pure JavaScript, so there is
nothing to build from source on the first `npm ci`.

**Check:** `systemctl is-active mysql` prints `active`.

### Node 22 LTS

Ubuntu's own `nodejs` package is too old. Use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

**Check:**

```bash
node -v      # v22.x — the project is developed on v22.20.0
npm -v
```

---

## 7. Firewall

⚠️ Allow SSH **before** enabling, or you will lock yourself out.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

Expect `OpenSSH` and `Nginx Full` allowed, default deny incoming, and
**no rule for 4000**. That matters: the app binds all interfaces
([index.js](backend/src/index.js) is a plain `app.listen(PORT)` with no host
argument), so without the firewall port 4000 would be publicly reachable and
bypass TLS entirely. ufw is what closes it.

**Check — from your local machine:** `curl -m 5 http://YOUR_SERVER_IP:4000`
must time out or refuse.

---

## 8. fail2ban

The app's own login throttle is per-account and in-memory; this is what protects
SSH from brute force.

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
backend = systemd
```

`backend = systemd` matters on Ubuntu 24.04, which no longer writes
`/var/log/auth.log` — with the default file backend the jail silently never
fires.

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

**Check:** the status output lists the jail without error.

---

## 9. Automatic security updates

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades      # choose Yes
```

**Check:** `systemctl status unattended-upgrades` is active.

---

## 10. Cap the logs

journald is uncapped by default, and logs are the realistic way this disk fills.

```bash
sudo nano /etc/systemd/journald.conf
```

Set (uncommenting the line):

```
SystemMaxUse=500M
```

```bash
sudo systemctl restart systemd-journald
```

---

## 11. DNS

Point your API hostname at the server **now** — certbot can't issue a
certificate until this resolves, and propagation isn't instant.

At your DNS provider, add:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `api` | `YOUR_SERVER_IP` | 300 |

If the domain sits behind Cloudflare's proxy, set this record to **DNS only**
(grey cloud) until certbot has issued the certificate.

**Check — from your local machine:**

```bash
dig +short api.propgather.com      # must return YOUR_SERVER_IP
```

Wait for it to return the right address before going further.

---

## 12. Reboot and confirm it all survives

```bash
sudo reboot
```

Reconnect after a minute:

```bash
ssh chee@YOUR_SERVER_IP
free -h                  # swap still present
sudo ufw status          # still active
node -v                  # still v22.x
systemctl is-active fail2ban nginx mysql
```

---

## Done — what you have

- [ ] A non-root sudo user with key-only SSH; root login refused
- [ ] Ubuntu patched, hostname set, clock on Malaysia time
- [ ] 2 GB swap so the native build can't OOM
- [ ] Node 22 and MySQL 8 both installed and running
- [ ] Firewall allowing only SSH and HTTP/HTTPS
- [ ] fail2ban, unattended security upgrades, capped logs
- [ ] DNS resolving to this box

**Next:** [DEPLOYMENT.md](DEPLOYMENT.md) **Part 2.2** — service user and
directories, then clone, R2, env file, systemd, nginx + TLS, your first admin,
and backups. Part 0 of that document is a prerequisite: the deploy pulls from
git, so everything has to be committed first.
