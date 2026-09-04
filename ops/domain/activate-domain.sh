#!/usr/bin/env bash
set -euo pipefail

domain=${1:-lilly-meeting.xiaohuatec.com}
expected_ip=${EXPECTED_IP:-139.196.97.236}
nginx_source=${NGINX_SOURCE:-/tmp/lilly-meetings-domain.conf}
nginx_live=/etc/nginx/sites-available/lilly-meetings
compose=/opt/lilly-migration/staging/compose.functions.json
timestamp=$(date +%Y%m%d-%H%M%S)
backup_dir=/var/backups/lilly-platform/domain-cutover-${timestamp}

if [[ ${EUID} -ne 0 ]]; then
  echo 'Run as root.' >&2
  exit 1
fi
if [[ ! ${domain} =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]]; then
  echo "Invalid domain: ${domain}" >&2
  exit 1
fi
if [[ ! -f ${nginx_source} ]]; then
  echo "Missing nginx template: ${nginx_source}" >&2
  exit 1
fi

mapfile -t resolved_ips < <(getent ahostsv4 "${domain}" | awk '{print $1}' | sort -u)
if [[ ${#resolved_ips[@]} -ne 1 || ${resolved_ips[0]} != "${expected_ip}" ]]; then
  echo "DNS is not ready. ${domain} must resolve only to ${expected_ip}." >&2
  printf 'Current A records: %s\n' "${resolved_ips[*]:-none}" >&2
  exit 2
fi

mkdir -p "${backup_dir}"
chmod 700 "${backup_dir}"
cp -a "${nginx_live}" "${backup_dir}/nginx.conf"
cp -a "${compose}" "${backup_dir}/compose.functions.json"
if [[ -f /etc/systemd/system/lilly-meetings.service.d/95-domain-origin.conf ]]; then
  cp -a /etc/systemd/system/lilly-meetings.service.d/95-domain-origin.conf "${backup_dir}/95-domain-origin.conf"
fi

mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot -d "${domain}" \
  --cert-name "${domain}" --non-interactive --agree-tos --keep-until-expiring

candidate=$(mktemp)
trap 'rm -f "${candidate}"' EXIT
sed "s/__DOMAIN__/${domain}/g" "${nginx_source}" > "${candidate}"
cp "${candidate}" "${nginx_live}"
nginx -t

DOMAIN_NAME="${domain}" COMPOSE_FILE="${compose}" /snap/bin/node <<'NODE'
const fs = require('fs');
const file = process.env.COMPOSE_FILE;
const domain = process.env.DOMAIN_NAME;
const origin = `https://${domain}`;
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const auth = config.services.auth.environment;
auth.API_EXTERNAL_URL = `${origin}/supabase`;
auth.GOTRUE_SITE_URL = `${origin}/meeting/`;
auth.GOTRUE_URI_ALLOW_LIST = `${origin}/meeting/**,https://139.196.97.236/meeting/**`;
auth.GOTRUE_JWT_ISSUER = `${origin}/supabase/auth/v1`;
config.services.storage.environment.STORAGE_PUBLIC_URL = `${origin}/supabase`;
config.services.functions.environment.SUPABASE_PUBLIC_URL = `${origin}/supabase`;
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
NODE

mkdir -p /etc/systemd/system/lilly-meetings.service.d
cat > /etc/systemd/system/lilly-meetings.service.d/95-domain-origin.conf <<EOF
[Service]
Environment=ALLOWED_ORIGINS=https://${domain},https://139.196.97.236
EOF

systemctl daemon-reload
systemctl restart lilly-platform.service
systemctl restart lilly-meetings.service
systemctl reload nginx

curl --fail --silent --show-error --max-time 20 "https://${domain}/meeting/" >/dev/null
curl --fail --silent --show-error --max-time 20 "https://${domain}/supabase/auth/v1/health" >/dev/null
openssl s_client -connect "${domain}:443" -servername "${domain}" </dev/null 2>/dev/null \
  | openssl x509 -noout -checkend 2592000 >/dev/null

install -d -m 700 /etc/lilly-meetings
printf '%s\n' "${domain}" > /etc/lilly-meetings/canonical-domain
chmod 600 /etc/lilly-meetings/canonical-domain

echo "Domain cutover completed: https://${domain}/meeting/"
echo "Rollback files: ${backup_dir}"
