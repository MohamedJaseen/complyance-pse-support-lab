import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { json, object, objects, startLab, waitForCompletion, type RunningLab } from "./harness";

const volumes = [1, 5, 6, 10, 11, 12, 21, 200];
const batchSizes = [3, 5, 7];
const labs = new Map<number, RunningLab>();
const directories: string[] = [];

beforeAll(async () => {
  for (const batchSize of batchSizes) {
    const directory = await mkdtemp(join(tmpdir(), "pse-processing-volume-"));
    directories.push(directory);
    labs.set(batchSize, await startLab(join(directory, "test.sqlite"), batchSize));
  }
});

afterAll(async () => {
  const errors: unknown[] = [];
  for (const lab of labs.values()) {
    try {
      await lab.stop();
    } catch (error) {
      errors.push(error);
    }
  }
  for (const directory of directories) {
    await rm(directory, { recursive: true, force: true });
  }
  if (errors.length > 0) throw new AggregateError(errors, "One or more processing-volume test servers did not stop cleanly");
});

async function assertProcessing(lab: RunningLab, count: number, batchSize: number): Promise<void> {
  const documentRefs = Array.from({ length: count }, (_, index) => `DOC-${String(index + 1).padStart(3, "0")}`);
  const labels = documentRefs.map((_, index) => `  Sample ${String(index + 1).padStart(3, "0")}  `);
  const csv = `document_ref,label\n${documentRefs.map((documentRef, index) => `${documentRef},${labels[index]}`).join("\n")}\n`;
  const response = await fetch(`${lab.url}/imports`, {
    method: "POST",
    headers: { "x-lab-workspace": "cedar-demo", "content-type": "text/csv" },
    body: csv,
  });
  expect(response.status).toBe(202);
  const created = await json(response);
  expect(created).toMatchObject({ workspaceId: "cedar-demo", state: "queued", total: count });
  if (typeof created.id !== "string") throw new Error("Create did not return a string import ID");
  const id = created.id;

  expect(await waitForCompletion(lab.url, id)).toEqual({
    id,
    workspaceId: "cedar-demo",
    state: "completed",
    total: count,
    processed: count,
    pending: 0,
  });

  const [recordsBody, resultsBody, eventsBody] = await Promise.all([
    fetch(`${lab.url}/imports/${id}/records`, { headers: { "x-lab-workspace": "cedar-demo" } }).then(async (result) => {
      expect(result.status).toBe(200);
      return json(result);
    }),
    fetch(`${lab.url}/imports/${id}/results`, { headers: { "x-lab-workspace": "cedar-demo" } }).then(async (result) => {
      expect(result.status).toBe(200);
      return json(result);
    }),
    fetch(`${lab.url}/imports/${id}/events`, { headers: { "x-lab-workspace": "cedar-demo" } }).then(async (result) => {
      expect(result.status).toBe(200);
      return json(result);
    }),
  ]);
  const records = objects(recordsBody.records);
  const results = objects(resultsBody.results);
  expect(records.map((record) => record.documentRef)).toEqual(documentRefs);
  expect(records.map((record) => record.state)).toEqual(documentRefs.map(() => "processed"));
  expect(results).toEqual(records.map((record, index) => ({
    recordId: record.id,
    documentRef: documentRefs[index],
    normalizedLabel: labels[index]?.trim().toUpperCase(),
  })));
  expect(new Set(results.map((result) => result.documentRef)).size).toBe(count);
  expect(new Set(results.map((result) => result.recordId)).size).toBe(count);

  const batches = objects(eventsBody.events).filter((event) => event.type === "batch_processed");
  const processedIds: unknown[] = [];
  for (const batch of batches) {
    const details = object(batch.details);
    if (!Array.isArray(details.recordIds)) throw new Error("Batch record IDs must be an array");
    expect(details.count).toBe(details.recordIds.length);
    expect(details.count).toBeGreaterThan(0);
    expect(details.count).toBeLessThanOrEqual(batchSize);
    processedIds.push(...details.recordIds);
  }
  expect(new Set(processedIds).size).toBe(count);
  expect(processedIds.sort((left, right) => Number(left) - Number(right))).toEqual(records.map((record) => record.id));
}

describe("processing volume invariants", () => {
  test("processes the supplied 12-row volume with the default batch size of 5", async () => {
    const lab = labs.get(5);
    if (!lab) throw new Error("Batch-size-5 test server was not started");
    await assertProcessing(lab, 12, 5);
  });

  test.each(volumes)("processes %i rows exactly once with batch size 5", async (count) => {
    const lab = labs.get(5);
    if (!lab) throw new Error("Batch-size-5 test server was not started");
    await assertProcessing(lab, count, 5);
  });

  test.each([3, 7])("processes 12 rows with configured batch size %i", async (batchSize) => {
    const lab = labs.get(batchSize);
    if (!lab) throw new Error(`Batch-size-${batchSize} test server was not started`);
    const health = await fetch(`${lab.url}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ batchSize });
    await assertProcessing(lab, 12, batchSize);
  });
});
