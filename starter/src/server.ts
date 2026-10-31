import { loadConfig } from "./config";
import { openDatabase } from "./database";
import { ApiError, workspaceFromHeader } from "./domain";
import { LabRepository } from "./repository";
import { seedDemo } from "./seed";
import { ImportService } from "./service";
import { startWorker } from "./worker";

const config = loadConfig();
const database = openDatabase(config.databasePath);

try {
  const repository = new LabRepository(database);
  await seedDemo(repository);
  const service = new ImportService(repository);
  let shuttingDown = false;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: config.port,
    async fetch(request) {
      try {
        if (shuttingDown) throw new ApiError(503, "unavailable", "Training app is shutting down");
        const url = new URL(request.url);
        if (url.pathname === "/health" && request.method === "GET") {
          return Response.json({ status: "ok", mode: "training", batchSize: config.batchSize });
        }
        const workspaceId = workspaceFromHeader(request.headers.get("x-lab-workspace"));
        if (url.pathname === "/imports") {
          if (request.method !== "POST") throw new ApiError(405, "method_not_allowed", "Use POST for /imports");
          return Response.json(await service.create(workspaceId, request), { status: 202 });
        }
        const match = /^\/imports\/([^/]+)(?:\/(records|results|events))?$/.exec(url.pathname);
        if (match) {
          if (request.method !== "GET") throw new ApiError(405, "method_not_allowed", "Use GET for import resources");
          let id: string;
          try {
            id = decodeURIComponent(match[1] ?? "");
          } catch {
            throw new ApiError(400, "invalid_argument", "Import ID has invalid URL encoding");
          }
          switch (match[2]) {
            case "records": return Response.json(service.records(workspaceId, id));
            case "results": return Response.json(service.results(workspaceId, id));
            case "events": return Response.json(service.events(workspaceId, id));
            default: return Response.json(service.get(workspaceId, id));
          }
        }
        throw new ApiError(404, "not_found", "Route not found");
      } catch (error) {
        if (error instanceof ApiError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
        console.error("Support lab request error", error);
        return Response.json({ code: "internal_error", message: "Unexpected training app error" }, { status: 500 });
      }
    },
  });
  const worker = startWorker(repository, config.batchSize);
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await server.stop(false);
      await worker.stop();
      database.close();
    } catch (error) {
      console.error("Support lab shutdown error", error);
      process.exitCode = 1;
    }
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  console.log(`Support lab listening http://127.0.0.1:${server.port}`);
} catch (error) {
  database.close();
  throw error;
}
