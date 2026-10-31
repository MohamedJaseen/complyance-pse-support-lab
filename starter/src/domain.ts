export type WorkspaceId = "cedar-demo" | "maple-demo";
export type ImportState = "queued" | "running" | "completed" | "failed" | "paused";
export type RecordState = "pending" | "processed";

export interface CsvRecord {
  documentRef: string;
  label: string;
}

export interface ImportSummary {
  id: string;
  workspaceId: WorkspaceId;
  state: ImportState;
  total: number;
  processed: number;
  pending: number;
}

export interface SourceRecord extends CsvRecord {
  id: number;
  state: RecordState;
}

export interface ImportResult {
  recordId: number;
  documentRef: string;
  normalizedLabel: string;
}

export interface ImportEvent {
  id: number;
  type: string;
  details: object;
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function workspaceFromHeader(value: string | null): WorkspaceId {
  if (value !== "cedar-demo" && value !== "maple-demo") {
    throw new ApiError(400, "invalid_argument", "x-lab-workspace must be cedar-demo or maple-demo");
  }
  return value;
}
