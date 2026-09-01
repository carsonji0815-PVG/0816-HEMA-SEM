import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
if (process.platform !== 'linux' || process.getuid() !== 0) throw new Error('Migration server only.');
const code = gunzipSync(Buffer.from(process.env.MIGRATION_BACKUP_SOURCE || '', 'base64'));
if (!code.toString().includes('lilly-platform-backup-v1')) throw new Error('Unexpected backup source.');
const dir = '/opt/lilly-migration/ops';
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(`${dir}/backup-selfhost.mjs`, code, { mode: 0o600 });
const service = `[Unit]
Description=Lilly platform encrypted database and file backup
After=docker.service network-online.target
[Service]
Type=oneshot
User=root
UMask=0077
EnvironmentFile=/etc/lilly-meetings/oss-backup.env
ExecStart=/usr/bin/flock -n /run/lilly-platform-backup.lock /snap/node/current/bin/node /opt/lilly-migration/ops/backup-selfhost.mjs
TimeoutStartSec=600
`;
const timer = `[Unit]
Description=Daily Lilly platform encrypted backup
[Timer]
OnCalendar=*-*-* 03:45:00 Asia/Shanghai
Persistent=true
RandomizedDelaySec=180
[Install]
WantedBy=timers.target
`;
for (const [name, value] of [['service', service], ['timer', timer]]) {
  const file = `/etc/systemd/system/lilly-platform-backup.${name}`;
  if (existsSync(file) && readFileSync(file, 'utf8') !== value) throw new Error('Existing backup unit differs; not overwritten.');
  writeFileSync(file, value, { mode: 0o644 });
}
execFileSync('systemctl', ['daemon-reload']);
execFileSync('systemctl', ['enable', '--now', 'lilly-platform-backup.timer']);
console.log(execFileSync('systemctl', ['list-timers', 'lilly-platform-backup.timer', '--no-pager'], { encoding: 'utf8' }));
