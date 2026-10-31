import { loadConfig } from "../src/config";
import { openDatabase } from "../src/database";
import { ApiError } from "../src/domain";
import { LabRepository } from "../src/repository";

try {
  if (process.argv.length > 2) throw new Error("resume-case accepts no arguments and only targets the supplied cedar-demo case-002");
  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  try {
    const acknowledgment = new LabRepository(database).resumeCustomerCase();
    console.log(JSON.stringify(acknowledgment));
  } finally {
    database.close();
  }
} catch (error) {
  console.error(JSON.stringify({
    code: error instanceof ApiError ? error.code : "resume_failed",
    message: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
}
