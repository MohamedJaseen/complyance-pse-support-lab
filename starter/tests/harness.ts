import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export const starterDirectory = fileURLToPath(new URL("../", import.meta.url));

export interface RunningLab {
  url: string;
  stop(): Promise<void>;
}

export async function startLab(databasePath: string, batchSize = 5): Promise<RunningLab> {
  const child = spawn("bun", ["src/server.ts"], {
    cwd: starterDirectory,
    env: { ...process.env, SUPPORT_LAB_DB: databasePath, SUPPORT_LAB_PORT: "0", SUPPORT_LAB_BATCH_SIZE: String(batchSize) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const startup = Promise.withResolvers<string>();
  const exited = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>();
  let output = "";
  let errors = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
    const match = /Support lab listening (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
    if (match?.[1]) startup.resolve(match[1]);
  });
  child.stderr.on("data", (chunk: string) => { errors += chunk; });
  child.once("error", (error) => {
    startup.reject(error);
    exited.resolve({ code: null, signal: null });
  });
  child.once("close", (code, signal) => {
    exited.resolve({ code, signal });
    startup.reject(new Error(`Bun server exited before startup (${code ?? signal}): ${errors}`));
  });
  const timer = setTimeout(() => startup.reject(new Error(`Bun server startup timed out: ${output}\n${errors}`)), 10_000);
  let stopped = false;
  try {
    const url = await startup.promise;
    return {
      url,
      async stop() {
        if (stopped) return;
        stopped = true;
        child.kill("SIGTERM");
        const forced = setTimeout(() => child.kill("SIGKILL"), 5_000);
        const result = await exited.promise;
        clearTimeout(forced);
        if (result.code !== 0) throw new Error(`Bun server did not stop cleanly (${result.code ?? result.signal}): ${errors}`);
      },
    };
  } catch (error) {
    child.kill("SIGKILL");
    await exited.promise;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error("Expected JSON object");
  return value;
}

function unknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function objects(value: unknown): Record<string, unknown>[] {
  if (!unknownArray(value)) throw new Error("Expected JSON array");
  return value.map(object);
}

export async function json(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  return object(body);
}

export async function waitForCompletion(url: string, id: string, workspace = "cedar-demo"): Promise<Record<string, unknown>> {
  // This observes a separate Bun process and SQLite worker; Node fake time cannot drive it.
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${url}/imports/${id}`, { headers: { "x-lab-workspace": workspace } });
    if (response.status !== 200) throw new Error(`Import read returned HTTP ${response.status}`);
    const body = await json(response);
    if (body.state === "completed") return body;
    if (body.state === "failed") throw new Error(`Import ${id} failed`);
    await delay(20);
  }
  throw new Error(`Import ${id} did not complete before the test deadline`);
}
