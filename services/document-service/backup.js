const fs = require('fs');
const path = require('path');
const { db, DATA_DIR } = require('./database');

const FILES_DIR = path.join(DATA_DIR, 'files');
const BACKUP_ROOT = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(DATA_DIR, 'backups');
const RETENTION_DAYS = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 30));

function stamp(date = new Date()) { return date.toISOString().replace(/[:.]/g, '-'); }

async function createBackup(reason = 'manual') {
  const destination = path.join(BACKUP_ROOT, stamp());
  fs.mkdirSync(destination, { recursive: true });
  await db.backup(path.join(destination, 'lilly-meetings.db'));
  if (fs.existsSync(FILES_DIR)) fs.cpSync(FILES_DIR, path.join(destination, 'files'), { recursive: true, force: false, errorOnExist: true });
  fs.writeFileSync(path.join(destination, 'backup-manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), reason, retentionDays: RETENTION_DAYS }, null, 2));
  pruneBackups();
  return destination;
}

function pruneBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(BACKUP_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const target = path.join(BACKUP_ROOT, entry.name);
    if (fs.statSync(target).mtimeMs < cutoff) fs.rmSync(target, { recursive: true, force: true });
  }
}

function scheduleAutomaticBackups() {
  const run = async () => {
    try { const destination = await createBackup('scheduled'); console.log(`自动备份完成：${destination}`); }
    catch (error) { console.error('自动备份失败：', error); }
  };
  const latest = fs.existsSync(BACKUP_ROOT) ? fs.readdirSync(BACKUP_ROOT, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => fs.statSync(path.join(BACKUP_ROOT, item.name)).mtimeMs).sort((a,b) => b-a)[0] : 0;
  if (!latest || Date.now() - latest > 20 * 60 * 60 * 1000) setTimeout(run, 30 * 1000).unref();
  const now = new Date();
  const next = new Date(now); next.setHours(2, 30, 0, 0); if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => { run(); setInterval(run, 24 * 60 * 60 * 1000).unref(); }, next - now).unref();
}

module.exports = { createBackup, scheduleAutomaticBackups, BACKUP_ROOT };
