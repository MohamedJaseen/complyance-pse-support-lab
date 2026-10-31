import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const APPLICATION_ID = 1347634508;

export function openDatabase(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  try {
    const marker = db.query<{ application_id: number }, []>("PRAGMA application_id").get();
    const tables = db.query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    ).get();
    if (marker?.application_id !== APPLICATION_ID && (marker?.application_id !== 0 || tables?.count !== 0)) {
      throw new Error("Refusing to open a database not owned by the support training lab");
    }
    db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    db.exec(`
      PRAGMA application_id = ${APPLICATION_ID};
      CREATE TABLE IF NOT EXISTS lab_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL CHECK(workspace_id IN ('cedar-demo', 'maple-demo')),
        state TEXT NOT NULL CHECK(state IN ('queued', 'running', 'completed', 'failed', 'paused')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, id)
      );
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        import_id TEXT NOT NULL,
        document_ref TEXT NOT NULL,
        label TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'processed')),
        UNIQUE(workspace_id, import_id, document_ref),
        UNIQUE(workspace_id, import_id, id),
        FOREIGN KEY(workspace_id, import_id) REFERENCES imports(workspace_id, id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS results (
        record_id INTEGER PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        import_id TEXT NOT NULL,
        normalized_label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(workspace_id, import_id, record_id) REFERENCES records(workspace_id, import_id, id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        import_id TEXT NOT NULL,
        type TEXT NOT NULL,
        details TEXT NOT NULL CHECK(json_valid(details)),
        created_at TEXT NOT NULL,
        FOREIGN KEY(workspace_id, import_id) REFERENCES imports(workspace_id, id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS imports_work_queue ON imports(state, created_at, id);
      CREATE INDEX IF NOT EXISTS records_scope_state ON records(workspace_id, import_id, state, id);
      CREATE INDEX IF NOT EXISTS results_scope ON results(workspace_id, import_id, record_id);
      CREATE INDEX IF NOT EXISTS events_scope ON events(workspace_id, import_id, id);
    `);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
