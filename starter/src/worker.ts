import type { WorkspaceId } from "./domain";
import type { LabRepository } from "./repository";

export function processImport(repository: LabRepository, workspaceId: WorkspaceId, importId: string, batchSize: number): void {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) throw new Error("Batch size must be from 1 to 20");
  if (!repository.claimImport(workspaceId, importId)) return;
  try {
    let offset = 0;
    while (true) {
      const batch = repository.pendingBatch(workspaceId, importId, batchSize, offset);
      if (batch.length === 0) break;
      repository.commitBatch(workspaceId, importId, batch);
      offset += batch.length;
    }
    repository.finishImport(workspaceId, importId);
  } catch (error) {
    repository.failImport(workspaceId, importId, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export interface WorkerHandle {
  stop(): Promise<void>;
}

export function startWorker(repository: LabRepository, batchSize: number): WorkerHandle {
  let stopping = false;
  let wake: (() => void) | undefined;
  const done = (async () => {
    while (!stopping) {
      try {
        const next = repository.nextQueued();
        if (next) processImport(repository, next.workspaceId, next.id, batchSize);
      } catch (error) {
        console.error("Support lab worker error", error);
      }
      if (!stopping) {
        const { promise, resolve } = Promise.withResolvers<void>();
        const timer = setTimeout(() => { wake = undefined; resolve(); }, 50);
        wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
        await promise;
      }
    }
  })();
  return {
    async stop() {
      stopping = true;
      wake?.();
      await done;
    },
  };
}
