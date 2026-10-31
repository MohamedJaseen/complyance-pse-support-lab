import { resolve } from "node:path";

export interface Config {
  databasePath: string;
  port: number;
  batchSize: number;
}

function integer(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

export function loadConfig(): Config {
  const [major = 0, minor = 0] = Bun.version.split(".").map(Number);
  if (major < 1 || (major === 1 && minor < 3)) throw new Error("Bun >=1.3 is required");
  const configuredPath = process.env.SUPPORT_LAB_DB;
  if (configuredPath !== undefined && (configuredPath.trim() === "" || configuredPath === ":memory:")) {
    throw new Error("SUPPORT_LAB_DB must be a file path for the local lab database");
  }
  return {
    databasePath: resolve(configuredPath ?? ".data/lab.sqlite"),
    port: integer("SUPPORT_LAB_PORT", 4328, 0, 65535),
    batchSize: integer("SUPPORT_LAB_BATCH_SIZE", 5, 1, 20),
  };
}
