#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

NGINX_SOURCE=${1:-/tmp/lilly-meetings.conf}
FAIL2BAN_SOURCE=${2:-/tmp/lilly-sshd.local}
test -f "$NGINX_SOURCE"
test -f "$FAIL2BAN_SOURCE"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 700 /var/backups/lilly-platform/security
cp -a /etc/nginx/sites-available/lilly-meetings "/var/backups/lilly-platform/security/lilly-meetings.${stamp}"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban ufw

install -d -m 755 /etc/fail2ban/jail.d
install -m 644 "$FAIL2BAN_SOURCE" /etc/fail2ban/jail.d/lilly-sshd.local

systemctl enable --now fail2ban
fail2ban-client reload

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH management'
ufw allow 80/tcp comment 'HTTP redirect and ACME'
ufw allow 443/tcp comment 'HTTPS application'
ufw --force enable

install -m 644 "$NGINX_SOURCE" /etc/nginx/sites-available/lilly-meetings
nginx -t
systemctl reload nginx

if growpart -N /dev/vda 3 2>&1 | grep -q '^CHANGE:'; then
  growpart /dev/vda 3
  resize2fs /dev/vda3
fi

echo "== firewall =="
ufw status verbose
echo "== fail2ban =="
fail2ban-client status sshd
echo "== filesystem =="
df -hT /
