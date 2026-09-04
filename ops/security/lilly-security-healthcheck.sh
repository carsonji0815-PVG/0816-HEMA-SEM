#!/usr/bin/env bash
set -Eeuo pipefail

failures=()
pass() { printf 'PASS %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; failures+=("$1"); }

for service in nginx docker lilly-meetings fail2ban lilly-platform-backup.timer; do
  if systemctl is-active --quiet "$service"; then pass "service:$service"; else fail "service:$service"; fi
done

canonical_host=139.196.97.236
if [[ -s /etc/lilly-meetings/canonical-domain ]]; then
  canonical_host=$(tr -d '[:space:]' </etc/lilly-meetings/canonical-domain)
fi

if curl --fail --silent --show-error --insecure --max-time 15 \
  --resolve "${canonical_host}:443:127.0.0.1" "https://${canonical_host}/meeting/" >/dev/null; then
  pass 'https:portal'
else
  fail 'https:portal'
fi

certificate=/etc/letsencrypt/live/${canonical_host}/fullchain.pem
if [[ -r "$certificate" ]] && openssl x509 -checkend 129600 -noout -in "$certificate" >/dev/null; then
  pass 'certificate:more-than-36-hours'
else
  fail 'certificate:expires-within-36-hours'
fi

latest_manifest=$(find /var/backups/lilly-platform -mindepth 2 -maxdepth 2 -name manifest.json -type f -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2- || true)
if [[ -n "$latest_manifest" ]] && /snap/node/current/bin/node -e '
  const fs=require("fs"); const manifest=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const age=Date.now()-Date.parse(manifest.createdAt);
  if(manifest.status!=="encrypted-offsite-readback-verified"||manifest.encryptedOffsite!==true||manifest.readbackVerified!==true||!Number.isFinite(age)||age>36*60*60*1000)process.exit(1);
' "$latest_manifest"; then
  pass 'backup:encrypted-offsite-fresh'
else
  fail 'backup:missing-stale-or-unverified'
fi

disk_used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [[ -n "$disk_used" && "$disk_used" -lt 80 ]]; then pass "disk:${disk_used}%"; else fail "disk:${disk_used:-unknown}%"; fi

unexpected_ports=''
while read -r address; do
  if [[ $address =~ ^(0\.0\.0\.0|\*|\[::\]):([0-9]+)$ ]]; then
    port=${BASH_REMATCH[2]}
    [[ $port =~ ^(22|80|443)$ ]] || unexpected_ports+="${unexpected_ports:+,}$port"
  fi
done < <(ss -H -lnt | awk '{print $4}')
if [[ -z "$unexpected_ports" ]]; then pass 'network:no-unexpected-public-tcp-ports'; else fail "network:unexpected-public-ports:${unexpected_ports//$'\n'/,}"; fi

if grep -Eq '^ENABLED=yes$' /etc/ufw/ufw.conf && iptables -S ufw-user-input >/dev/null 2>&1; then pass 'firewall:active'; else fail 'firewall:inactive'; fi

sshd_effective=$(sshd -T 2>/dev/null)
if grep -q '^passwordauthentication no$' <<<"$sshd_effective" && grep -q '^kbdinteractiveauthentication no$' <<<"$sshd_effective" && grep -Eq '^permitrootlogin (prohibit-password|without-password)$' <<<"$sshd_effective"; then
  pass 'ssh:key-only'
else
  fail 'ssh:password-login-not-fully-disabled'
fi

trigger_count=$(docker exec -i lilly-stage-db psql -U postgres -d postgres -X -Atc "select count(*) from pg_trigger where not tgisinternal and tgname in ('operation_audit_logs_append_only','operation_audit_logs_no_truncate','luggage_audit_logs_append_only','luggage_audit_logs_no_truncate');")
if [[ "$trigger_count" == '4' ]]; then pass 'database:audit-append-only-triggers'; else fail "database:audit-trigger-count:$trigger_count"; fi

dangerous_grants=$(docker exec -i lilly-stage-db psql -U postgres -d postgres -X -Atc "select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in ('operation_audit_logs','luggage_audit_logs') and grantee in ('anon','authenticated','service_role') and privilege_type in ('DELETE','UPDATE','TRUNCATE');")
if [[ "$dangerous_grants" == '0' ]]; then pass 'database:audit-mutation-grants-removed'; else fail "database:audit-dangerous-grants:$dangerous_grants"; fi

if [[ -z $(find /opt/lilly-meetings/data/files -type f -perm /077 -print -quit) ]]; then pass 'files:private-permissions'; else fail 'files:group-or-world-accessible'; fi

if [[ $(systemctl show lilly-meetings -p User --value) == 'lilly' ]] && [[ $(systemctl show lilly-meetings -p NoNewPrivileges --value) == 'yes' ]] && [[ $(systemctl show lilly-meetings -p ProtectSystem --value) == 'strict' ]]; then
  pass 'process:least-privilege-sandbox'
else
  fail 'process:sandbox-regressed'
fi

if ((${#failures[@]})); then
  message="Lilly security healthcheck failed: ${failures[*]}"
  logger -p authpriv.err -t lilly-security-healthcheck -- "$message"
  printf '%s\n' "$message" >&2
  exit 1
fi

printf 'Security healthcheck passed at %s\n' "$(date --iso-8601=seconds)"
