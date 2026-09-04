const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'lilly-meetings.db');
const LEGACY_INDEX = path.join(DATA_DIR, 'index.json');
const LEGACY_USERS = path.join(DATA_DIR, 'users.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_FILE);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    name TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('admin','member')),
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    member TEXT NOT NULL REFERENCES users(name),
    meeting_type TEXT NOT NULL CHECK(meeting_type IN ('external','internal')),
    identifier TEXT NOT NULL,
    activity_name TEXT NOT NULL DEFAULT '',
    compliance_scenario TEXT NOT NULL DEFAULT 'unclassified',
    owner TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(name),
    created_at TEXT NOT NULL,
    external_project_id TEXT,
    UNIQUE(member, name)
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('quotation','confirmation','po','po_email','other')),
    type_label TEXT NOT NULL,
    document_status TEXT CHECK(document_status IN ('signed','pending') OR document_status IS NULL),
    size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES users(name),
    uploaded_at TEXT NOT NULL,
    storage_name TEXT NOT NULL,
    status_updated_by TEXT REFERENCES users(name),
    status_updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS travel_api_cache (
    cache_key TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    request_json TEXT NOT NULL,
    response_json TEXT NOT NULL,
    status TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_folders_member ON folders(member, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id, uploaded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_travel_cache_expiry ON travel_api_cache(expires_at);
`);

function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

function migrateSchema() {
  const folderColumns = new Set(db.prepare('PRAGMA table_info(folders)').all().map((column) => column.name));
  if (!folderColumns.has('activity_name')) db.exec("ALTER TABLE folders ADD COLUMN activity_name TEXT NOT NULL DEFAULT ''");
  if (!folderColumns.has('compliance_scenario')) db.exec("ALTER TABLE folders ADD COLUMN compliance_scenario TEXT NOT NULL DEFAULT 'unclassified'");
  if (!folderColumns.has('external_project_id')) db.exec('ALTER TABLE folders ADD COLUMN external_project_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_external_project ON folders(external_project_id) WHERE external_project_id IS NOT NULL');
  db.exec("UPDATE folders SET activity_name=identifier WHERE TRIM(activity_name)='' OR activity_name IS NULL");
  db.exec("UPDATE folders SET compliance_scenario='unclassified' WHERE compliance_scenario NOT IN ('unclassified','po_email','signed_confirmation') OR compliance_scenario IS NULL");

  const filesSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='files'").get()?.sql || '';
  if (!filesSql.includes("'po_email'")) {
    db.pragma('foreign_keys = OFF');
    try {
      db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE files_v2 (
          id TEXT PRIMARY KEY,
          folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('quotation','confirmation','po','po_email','other')),
          type_label TEXT NOT NULL,
          document_status TEXT CHECK(document_status IN ('signed','pending') OR document_status IS NULL),
          size INTEGER NOT NULL,
          uploaded_by TEXT NOT NULL REFERENCES users(name),
          uploaded_at TEXT NOT NULL,
          storage_name TEXT NOT NULL,
          status_updated_by TEXT REFERENCES users(name),
          status_updated_at TEXT
        );
        INSERT INTO files_v2 SELECT * FROM files;
        DROP TABLE files;
        ALTER TABLE files_v2 RENAME TO files;
        CREATE INDEX idx_files_folder ON files(folder_id, uploaded_at DESC);
        COMMIT;
      `);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }
}

function migrateLegacyData() {
  const migrated = db.prepare("SELECT value FROM app_meta WHERE key='legacy_migration_completed'").get();
  if (migrated) return;
  transaction(() => {
    if (fs.existsSync(LEGACY_USERS)) {
      const users = JSON.parse(fs.readFileSync(LEGACY_USERS, 'utf8'));
      const insert = db.prepare(`INSERT OR IGNORE INTO users
        (name, role, salt, password_hash, must_change_password, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);
      users.forEach((user, index) => insert.run(user.name, user.role, user.salt, user.passwordHash, user.mustChangePassword ? 1 : 0, index, new Date().toISOString()));
    }
    if (fs.existsSync(LEGACY_INDEX)) {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_INDEX, 'utf8'));
      const insertFolder = db.prepare(`INSERT OR IGNORE INTO folders
        (id, member, meeting_type, identifier, owner, meeting_date, name, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const insertFile = db.prepare(`INSERT OR IGNORE INTO files
        (id, folder_id, name, type, type_label, document_status, size, uploaded_by, uploaded_at, storage_name, status_updated_by, status_updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const folder of legacy.folders || []) insertFolder.run(folder.id, folder.member, folder.meetingType, folder.identifier, folder.owner, folder.date, folder.name, folder.createdBy, folder.createdAt);
      for (const file of legacy.files || []) insertFile.run(file.id, file.folderId, file.name, file.type, file.typeLabel, file.documentStatus || (file.type === 'confirmation' ? 'pending' : null), file.size, file.uploadedBy, file.uploadedAt, file.storageName, file.statusUpdatedBy || null, file.statusUpdatedAt || null);
    }
    db.prepare("INSERT INTO app_meta(key,value) VALUES('legacy_migration_completed',?)").run(new Date().toISOString());
  });
}

function audit(actor, action, targetType, targetId, details = {}) {
  db.prepare('INSERT INTO audit_logs(actor,action,target_type,target_id,details,created_at) VALUES(?,?,?,?,?,?)')
    .run(actor, action, targetType, targetId || null, JSON.stringify(details), new Date().toISOString());
}

migrateSchema();
migrateLegacyData();

module.exports = { db, DB_FILE, DATA_DIR, transaction, audit };
