import type { Database } from "bun:sqlite";
import { ApiError, type CsvRecord, type ImportEvent, type ImportResult, type ImportState, type ImportSummary, type SourceRecord, type WorkspaceId } from "./domain";

interface QueuedImport { id: string; workspaceId: WorkspaceId }
interface StoredEvent { id: number; type: string; details: string }

export class LabRepository {
  constructor(private readonly db: Database) {}

  private event(workspaceId: WorkspaceId, importId: string, type: string, details: object): void {
    this.db.query("INSERT INTO events(workspace_id, import_id, type, details, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(workspaceId, importId, type, JSON.stringify(details), new Date().toISOString());
  }

  private insertImport(workspaceId: WorkspaceId, id: string, state: ImportState, rows: readonly CsvRecord[]): void {
    const now = new Date().toISOString();
    this.db.query("INSERT INTO imports(id, workspace_id, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, workspaceId, state, now, now);
    const insert = this.db.query("INSERT INTO records(workspace_id, import_id, document_ref, label) VALUES (?, ?, ?, ?)");
    for (const row of rows) insert.run(workspaceId, id, row.documentRef, row.label);
    this.event(workspaceId, id, "import_created", { total: rows.length, state });
  }

  initializeDemo(customer: readonly CsvRecord[], control: readonly CsvRecord[]): void {
    this.db.transaction(() => {
      const seeded = this.db.query<{ value: string }, []>("SELECT value FROM lab_metadata WHERE key = 'seeded'").get();
      if (seeded) return;
      const count = this.db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM imports").get();
      if (count?.count !== 0) throw new Error("Uninitialized lab database is not empty; refusing to seed over existing data");
      this.insertImport("cedar-demo", "case-002", "queued", customer);
      this.insertImport("maple-demo", "control-002", "paused", control);
      this.db.query("INSERT INTO lab_metadata(key, value) VALUES ('seeded', ?)").run(new Date().toISOString());
    }).immediate();
  }

  createImport(workspaceId: WorkspaceId, rows: readonly CsvRecord[]): { id: string; workspaceId: WorkspaceId; state: "queued"; total: number } {
    const id = crypto.randomUUID();
    this.db.transaction(() => this.insertImport(workspaceId, id, "queued", rows)).immediate();
    return { id, workspaceId, state: "queued", total: rows.length };
  }

  getImport(workspaceId: WorkspaceId, id: string): ImportSummary {
    const summary = this.db.query<ImportSummary, [string, string]>(`
      SELECT i.id, i.workspace_id AS workspaceId, i.state,
        COUNT(r.id) AS total,
        COALESCE(SUM(r.state = 'processed'), 0) AS processed,
        COALESCE(SUM(r.state = 'pending'), 0) AS pending
      FROM imports i LEFT JOIN records r ON r.workspace_id = i.workspace_id AND r.import_id = i.id
      WHERE i.workspace_id = ? AND i.id = ? GROUP BY i.id
    `).get(workspaceId, id);
    if (!summary) throw new ApiError(404, "not_found", "Import not found in this workspace");
    return summary;
  }

  getRecords(workspaceId: WorkspaceId, id: string): SourceRecord[] {
    this.getImport(workspaceId, id);
    return this.db.query<SourceRecord, [string, string]>(`
      SELECT id, document_ref AS documentRef, label, state FROM records
      WHERE workspace_id = ? AND import_id = ? ORDER BY id
    `).all(workspaceId, id);
  }

  getResults(workspaceId: WorkspaceId, id: string): ImportResult[] {
    this.getImport(workspaceId, id);
    return this.db.query<ImportResult, [string, string]>(`
      SELECT s.record_id AS recordId, r.document_ref AS documentRef, s.normalized_label AS normalizedLabel
      FROM results s JOIN records r ON r.workspace_id = s.workspace_id AND r.import_id = s.import_id AND r.id = s.record_id
      WHERE s.workspace_id = ? AND s.import_id = ? ORDER BY s.record_id
    `).all(workspaceId, id);
  }

  getEvents(workspaceId: WorkspaceId, id: string): ImportEvent[] {
    this.getImport(workspaceId, id);
    const events = this.db.query<StoredEvent, [string, string]>(`
      SELECT id, type, details FROM events WHERE workspace_id = ? AND import_id = ? ORDER BY id
    `).all(workspaceId, id);
    return events.map((event) => {
      const details: unknown = JSON.parse(event.details);
      if (typeof details !== "object" || details === null || Array.isArray(details)) throw new Error("Invalid stored event details");
      return { id: event.id, type: event.type, details };
    });
  }

  nextQueued(): QueuedImport | null {
    return this.db.query<QueuedImport, []>(`
      SELECT id, workspace_id AS workspaceId FROM imports WHERE state = 'queued' ORDER BY created_at, id LIMIT 1
    `).get();
  }

  claimImport(workspaceId: WorkspaceId, id: string): boolean {
    return this.db.transaction(() => {
      const updated = this.db.query("UPDATE imports SET state = 'running', updated_at = ? WHERE workspace_id = ? AND id = ? AND state = 'queued'")
        .run(new Date().toISOString(), workspaceId, id);
      if (updated.changes === 0) return false;
      this.event(workspaceId, id, "processing_started", {});
      return true;
    }).immediate();
  }

  pendingBatch(workspaceId: WorkspaceId, id: string, limit: number, offset: number): SourceRecord[] {
    return this.db.query<SourceRecord, [string, string, number, number]>(`
      SELECT id, document_ref AS documentRef, label, state FROM records
      WHERE workspace_id = ? AND import_id = ? AND state = 'pending' ORDER BY id LIMIT ? OFFSET ?
    `).all(workspaceId, id, limit, offset);
  }

  commitBatch(workspaceId: WorkspaceId, id: string, rows: readonly SourceRecord[]): void {
    this.db.transaction(() => {
      const job = this.getImport(workspaceId, id);
      if (job.state !== "running") throw new Error("Only a running import can commit a batch");
      const insert = this.db.query("INSERT INTO results(record_id, workspace_id, import_id, normalized_label, created_at) VALUES (?, ?, ?, ?, ?)");
      const update = this.db.query("UPDATE records SET state = 'processed' WHERE workspace_id = ? AND import_id = ? AND id = ? AND state = 'pending'");
      for (const row of rows) {
        const changed = update.run(workspaceId, id, row.id);
        if (changed.changes !== 1) throw new Error("Source record is not pending in the selected import");
        insert.run(row.id, workspaceId, id, row.label.trim().toUpperCase(), new Date().toISOString());
      }
      this.event(workspaceId, id, "batch_processed", { recordIds: rows.map((row) => row.id), count: rows.length });
    }).immediate();
  }

  finishImport(workspaceId: WorkspaceId, id: string): void {
    this.db.transaction(() => {
      const changed = this.db.query("UPDATE imports SET state = 'completed', updated_at = ? WHERE workspace_id = ? AND id = ? AND state = 'running'")
        .run(new Date().toISOString(), workspaceId, id);
      if (changed.changes !== 1) throw new Error("Import is not running");
      this.event(workspaceId, id, "processing_completed", {});
    }).immediate();
  }

  failImport(workspaceId: WorkspaceId, id: string, message: string): void {
    this.db.transaction(() => {
      this.db.query("UPDATE imports SET state = 'failed', updated_at = ? WHERE workspace_id = ? AND id = ? AND state = 'running'")
        .run(new Date().toISOString(), workspaceId, id);
      this.event(workspaceId, id, "processing_failed", { message });
    }).immediate();
  }

  resumeCustomerCase(): { id: string; workspaceId: WorkspaceId; state: "queued"; pending: number } {
    return this.db.transaction((): { id: string; workspaceId: WorkspaceId; state: "queued"; pending: number } => {
      const job = this.getImport("cedar-demo", "case-002");
      if (job.state !== "completed" || job.pending === 0) {
        throw new ApiError(409, "invalid_state", "The supplied case must be completed with pending records before it can be resumed");
      }
      this.db.query("UPDATE imports SET state = 'queued', updated_at = ? WHERE workspace_id = 'cedar-demo' AND id = 'case-002'")
        .run(new Date().toISOString());
      this.event("cedar-demo", "case-002", "resume_requested", { pending: job.pending });
      return { id: "case-002", workspaceId: "cedar-demo", state: "queued", pending: job.pending };
    }).immediate();
  }

  reset(): void {
    this.db.transaction(() => {
      this.db.exec("DELETE FROM events; DELETE FROM results; DELETE FROM records; DELETE FROM imports; DELETE FROM lab_metadata;");
      this.db.exec("DELETE FROM sqlite_sequence WHERE name IN ('records', 'events');");
    }).immediate();
  }
}
