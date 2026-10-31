import { MAX_CSV_BYTES, parseCsv } from "./csv";
import { ApiError, type WorkspaceId } from "./domain";
import { LabRepository } from "./repository";

export class ImportService {
  constructor(private readonly repository: LabRepository) {}

  async create(workspaceId: WorkspaceId, request: Request) {
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "text/csv") {
      throw new ApiError(400, "invalid_argument", "Content-Type must be text/csv");
    }
    const text = await readCsvBody(request);
    const rows = parseCsv(text);
    return this.repository.createImport(workspaceId, rows);
  }

  get(workspaceId: WorkspaceId, id: string) {
    return this.repository.getImport(workspaceId, id);
  }

  records(workspaceId: WorkspaceId, id: string) {
    return { records: this.repository.getRecords(workspaceId, id) };
  }

  results(workspaceId: WorkspaceId, id: string) {
    return { results: this.repository.getResults(workspaceId, id) };
  }

  events(workspaceId: WorkspaceId, id: string) {
    return { events: this.repository.getEvents(workspaceId, id) };
  }
}

async function readCsvBody(request: Request): Promise<string> {
  if (!request.body) throw new ApiError(400, "invalid_argument", "CSV body is required");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_CSV_BYTES) {
        await reader.cancel();
        throw new ApiError(400, "invalid_argument", "CSV body exceeds 256 KiB");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_argument", "CSV body must contain valid UTF-8 text");
  } finally {
    reader.releaseLock();
  }
}
