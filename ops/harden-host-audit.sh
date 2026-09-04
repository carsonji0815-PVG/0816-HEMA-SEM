#!/usr/bin/env bash
set -Eeuo pipefail

sysctl_source=${1:-/tmp/99-lilly-platform-hardening.conf}
audit_source=${2:-/tmp/99-lilly-platform.rules}
stamp=$(date +%Y%m%d-%H%M%S)
backup_dir=/var/backups/lilly-platform/security/host-audit-${stamp}

if [[ $EUID -ne 0 ]]; then echo 'Run as root.' >&2; exit 1; fi
[[ -f $sysctl_source && -f $audit_source ]] || { echo 'Hardening source files are missing.' >&2; exit 1; }

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
cp -a /etc/sysctl.conf /etc/audit "$backup_dir"/ 2>/dev/null || true

DEBIAN_FRONTEND=noninteractive apt-get install -y auditd audispd-plugins
install -m 644 "$sysctl_source" /etc/sysctl.d/99-lilly-platform-hardening.conf
install -m 640 "$audit_source" /etc/audit/rules.d/99-lilly-platform.rules

# Alibaba images set rp_filter=0 again from /etc/sysctl.conf, which is loaded
# after sysctl.d. Preserve the setting in place so the hardened value wins.
sed -i -E 's/^[[:space:]]*net\.ipv4\.conf\.all\.rp_filter[[:space:]]*=.*/net.ipv4.conf.all.rp_filter = 2/' /etc/sysctl.conf
sed -i -E 's/^[[:space:]]*net\.ipv4\.conf\.default\.rp_filter[[:space:]]*=.*/net.ipv4.conf.default.rp_filter = 2/' /etc/sysctl.conf

# Retain up to roughly 500 MiB of host audit history before rotation.
sed -i -E 's/^[[:space:]]*max_log_file[[:space:]]*=.*/max_log_file = 50/' /etc/audit/auditd.conf
sed -i -E 's/^[[:space:]]*num_logs[[:space:]]*=.*/num_logs = 10/' /etc/audit/auditd.conf
sed -i -E 's/^[[:space:]]*max_log_file_action[[:space:]]*=.*/max_log_file_action = ROTATE/' /etc/audit/auditd.conf
sed -i -E 's/^[[:space:]]*space_left_action[[:space:]]*=.*/space_left_action = SYSLOG/' /etc/audit/auditd.conf
sed -i -E 's/^[[:space:]]*admin_space_left_action[[:space:]]*=.*/admin_space_left_action = SUSPEND/' /etc/audit/auditd.conf

sysctl --system >/dev/null
augenrules --load >/dev/null
systemctl enable auditd.service >/dev/null
service auditd restart >/dev/null

systemctl is-active --quiet auditd.service
auditctl -s | grep -q 'enabled 1'
auditctl -l | grep -q 'lilly_backup_key'
auditctl -l | grep -q 'lilly_identity_config'
echo "Host audit hardening applied; rollback copy: ${backup_dir}"
