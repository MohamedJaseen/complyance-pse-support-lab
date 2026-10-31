import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { json, object, objects, startLab, waitForCompletion, type RunningLab } from "./harness";

let directory: string;
let databasePath: string;
let lab: RunningLab;
const cedar = { "x-lab-workspace": "cedar-demo" };
const maple = { "x-lab-workspace": "maple-demo" };

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "pse-support-lab-"));
  databasePath = join(directory, "test.sqlite");
  lab = await startLab(databasePath);
});

afterAll(async () => {
  try {
    if (lab) await lab.stop();
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});

async function create(csv: string, workspace = "cedar-demo"): Promise<string> {
  const response = await fetch(`${lab.url}/imports`, {
    method: "POST", headers: { "x-lab-workspace": workspace, "content-type": "text/csv" }, body: csv,
  });
  expect(response.status).toBe(202);
  const body = await json(response);
  expect(body).toMatchObject({ workspaceId: workspace, state: "queued" });
  if (typeof body.id !== "string") throw new Error("Create did not return a string import ID");
  return body.id;
}

async function read(id: string, resource = "", headers = cedar): Promise<Record<string, unknown>> {
  const response = await fetch(`${lab.url}/imports/${id}${resource}`, { headers });
  expect(response.status).toBe(200);
  return json(response);
}

describe("local training API", () => {
  test("health is public and reports actual training configuration", async () => {
    const response = await fetch(`${lab.url}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", mode: "training", batchSize: 5 });
  });

  test("quoted CSV, BOM and CRLF produce genuine normalized results and atomic batch events", async () => {
    const id = await create('\uFEFFdocument_ref,label\r\nSMALL-1,"  mixed Case  "\r\nSMALL-2,"comma, value"\r\nSMALL-3,"say ""yes"""\r\n');
    expect(await waitForCompletion(lab.url, id)).toEqual({ id, workspaceId: "cedar-demo", state: "completed", total: 3, processed: 3, pending: 0 });
    const records = objects((await read(id, "/records")).records);
    expect(records.map((row) => row.documentRef)).toEqual(["SMALL-1", "SMALL-2", "SMALL-3"]);
    expect(records.map((row) => row.state)).toEqual(["processed", "processed", "processed"]);
    const results = objects((await read(id, "/results")).results);
    expect(results).toEqual([
      { recordId: records[0]?.id, documentRef: "SMALL-1", normalizedLabel: "MIXED CASE" },
      { recordId: records[1]?.id, documentRef: "SMALL-2", normalizedLabel: "COMMA, VALUE" },
      { recordId: records[2]?.id, documentRef: "SMALL-3", normalizedLabel: 'SAY "YES"' },
    ]);
    expect(new Set(results.map((row) => row.recordId)).size).toBe(3);
    const events = objects((await read(id, "/events")).events);
    const eventIds = events.map((event) => event.id);
    expect(eventIds).toEqual([...eventIds].sort((a, b) => Number(a) - Number(b)));
    const batches = events.filter((event) => event.type === "batch_processed");
    const processedIds: unknown[] = [];
    for (const batch of batches) {
      const details = object(batch.details);
      if (!Array.isArray(details.recordIds)) throw new Error("Batch record IDs must be an array");
      expect(details.count).toBe(details.recordIds.length);
      expect(details.count).toBeGreaterThan(0);
      expect(details.count).toBeLessThanOrEqual(5);
      processedIds.push(...details.recordIds);
    }
    expect(processedIds.sort((a, b) => Number(a) - Number(b))).toEqual(records.map((record) => record.id));
  });

  test.each([1, 5])("processes %i records with exact IDs and bounded batches", async (count) => {
    const id = await create(`document_ref,label\n${Array.from({ length: count }, (_, index) => `SIZE-${index + 1}, label ${index + 1} `).join("\n")}\n`);
    expect(await waitForCompletion(lab.url, id)).toMatchObject({ total: count, processed: count, pending: 0 });
    const records = objects((await read(id, "/records")).records);
    const results = objects((await read(id, "/results")).results);
    expect(results.map((result) => result.recordId)).toEqual(records.map((record) => record.id));
    expect(results.map((result) => result.normalizedLabel)).toEqual(Array.from({ length: count }, (_, index) => `LABEL ${index + 1}`));
    const batches = objects((await read(id, "/events")).events).filter((event) => event.type === "batch_processed");
    const processedIds: unknown[] = [];
    for (const batch of batches) {
      const details = object(batch.details);
      expect(details.count).toBeGreaterThan(0);
      expect(details.count).toBeLessThanOrEqual(5);
      if (!Array.isArray(details.recordIds)) throw new Error("Batch record IDs must be an array");
      expect(details.count).toBe(details.recordIds.length);
      processedIds.push(...details.recordIds);
    }
    expect(processedIds.sort((a, b) => Number(a) - Number(b))).toEqual(records.map((record) => record.id));
  });

  test("each POST creates a distinct import even for repeated CSV", async () => {
    const csv = "document_ref,label\nREPEAT,same label\n";
    const first = await create(csv);
    const second = await create(csv);
    expect(second).not.toBe(first);
    await waitForCompletion(lab.url, first);
    await waitForCompletion(lab.url, second);
    expect(objects((await read(first, "/results")).results)).toHaveLength(1);
    expect(objects((await read(second, "/results")).results)).toHaveLength(1);
  });

  test.each([
    ["empty file", ""],
    ["header only", "document_ref,label\n"],
    ["wrong header", "documentRef,label\nONE,One\n"],
    ["extra header", "document_ref,label,extra\nONE,One,x\n"],
    ["missing column", "document_ref,label\nONE\n"],
    ["broken quote", 'document_ref,label\nONE,"unfinished\n'],
    ["duplicate references", "document_ref,label\nONE,One\nONE,Two\n"],
    ["empty reference", "document_ref,label\n,One\n"],
    ["non-ASCII reference", "document_ref,label\nDÖC,One\n"],
    ["reference punctuation", "document_ref,label\nDOC.1,One\n"],
    ["long reference", `document_ref,label\n${"D".repeat(65)},One\n`],
    ["blank label", "document_ref,label\nONE,   \n"],
    ["long label", `document_ref,label\nONE,${"L".repeat(201)}\n`],
    ["too many rows", `document_ref,label\n${Array.from({ length: 201 }, (_, index) => `ROW-${index},Label`).join("\n")}\n`],
  ])("rejects %s with a structured client error", async (_description, csv) => {
    const response = await fetch(`${lab.url}/imports`, { method: "POST", headers: { ...cedar, "content-type": "text/csv" }, body: csv });
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: "invalid_argument", message: expect.any(String) });
  });


  test("requires a valid synthetic workspace selector and CSV media type", async () => {
    const invalidHeaders: HeadersInit[] = [{}, { "x-lab-workspace": "unknown" }];
    for (const headers of invalidHeaders) {
      const response = await fetch(`${lab.url}/imports/case-002`, { headers });
      expect(response.status).toBe(400);
      expect(await json(response)).toMatchObject({ code: "invalid_argument" });
    }
    const response = await fetch(`${lab.url}/imports`, { method: "POST", headers: { ...cedar, "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: "invalid_argument" });
  });

  test("unknown and cross-workspace imports are 404 on every resource", async () => {
    const targets: Array<[string, Record<string, string>]> = [["missing-import", cedar], ["case-002", maple], ["control-002", cedar]];
    for (const resource of ["", "/records", "/results", "/events"]) {
      for (const [id, headers] of targets) {
        const response = await fetch(`${lab.url}/imports/${id}${resource}`, { headers });
        expect(response.status).toBe(404);
        expect(await json(response)).toMatchObject({ code: "not_found", message: expect.any(String) });
      }
    }
  });

  test("rejects oversized or invalid UTF-8 bodies with structured errors", async () => {
    const bodies: BodyInit[] = ["x".repeat(256 * 1024 + 1), new Uint8Array([0xc3, 0x28])];
    for (const body of bodies) {
      const response = await fetch(`${lab.url}/imports`, {
        method: "POST", headers: { ...cedar, "content-type": "text/csv" }, body,
      });
      expect(response.status).toBe(400);
      expect(await json(response)).toMatchObject({ code: "invalid_argument", message: expect.any(String) });
    }
  });

  test("keeps newly submitted imports isolated between workspaces", async () => {
    const id = await create("document_ref,label\nWORKSPACE-1,Maple only\n", "maple-demo");
    expect(await waitForCompletion(lab.url, id, "maple-demo")).toMatchObject({ workspaceId: "maple-demo", processed: 1, pending: 0 });
    expect(objects((await read(id, "/results", maple)).results).map((result) => result.normalizedLabel)).toEqual(["MAPLE ONLY"]);
    for (const resource of ["", "/records", "/results", "/events"]) {
      const response = await fetch(`${lab.url}/imports/${id}${resource}`, { headers: cedar });
      expect(response.status).toBe(404);
      expect(await json(response)).toMatchObject({ code: "not_found" });
    }
  });

  test("the paused control workspace is untouched by customer processing", async () => {
    expect(await read("control-002", "", maple)).toEqual({ id: "control-002", workspaceId: "maple-demo", state: "paused", total: 3, processed: 0, pending: 3 });
    expect(objects((await read("control-002", "/records", maple)).records).map((record) => [record.documentRef, record.state]))
      .toEqual([["CTRL-001", "pending"], ["CTRL-002", "pending"], ["CTRL-003", "pending"]]);
    expect(await read("control-002", "/results", maple)).toEqual({ results: [] });
  });

  test("a clean restart preserves completed results, IDs, events and the paused control", async () => {
    const id = await create("document_ref,label\nPERSIST, Keep Me \n");
    await waitForCompletion(lab.url, id);
    const snapshot = await Promise.all([read(id), read(id, "/records"), read(id, "/results"), read(id, "/events"), read("control-002", "", maple)]);
    await lab.stop();
    lab = await startLab(databasePath, 3);
    expect(await (await fetch(`${lab.url}/health`)).json()).toEqual({ status: "ok", mode: "training", batchSize: 3 });
    expect(await Promise.all([read(id), read(id, "/records"), read(id, "/results"), read(id, "/events"), read("control-002", "", maple)])).toEqual(snapshot);
    const newId = await create("document_ref,label\nRESTART,After restart\n");
    expect(await waitForCompletion(lab.url, newId)).toMatchObject({ processed: 1, pending: 0 });
  });
});
