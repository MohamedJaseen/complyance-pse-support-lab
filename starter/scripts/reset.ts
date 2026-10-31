import { loadConfig } from "../src/config";
import { openDatabase } from "../src/database";
import { LabRepository } from "../src/repository";
import { seedDemo } from "../src/seed";

try {
  if (process.argv.length > 2) throw new Error("reset accepts no arguments; use SUPPORT_LAB_DB to select your local lab database");
  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  try {
    const repository = new LabRepository(database);
    repository.reset();
    await seedDemo(repository);
    console.log(JSON.stringify({ status: "reset", mode: "training", databasePath: config.databasePath }));
  } finally {
    database.close();
  }
} catch (error) {
  console.error(JSON.stringify({ code: "reset_failed", message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}
