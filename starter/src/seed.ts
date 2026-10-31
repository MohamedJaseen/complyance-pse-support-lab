import { parseCsv } from "./csv";
import type { LabRepository } from "./repository";

export async function seedDemo(repository: LabRepository): Promise<void> {
  const customer = parseCsv(await Bun.file(new URL("../fixtures/case-002.csv", import.meta.url)).text());
  const control = parseCsv(await Bun.file(new URL("../fixtures/control-002.csv", import.meta.url)).text());
  repository.initializeDemo(customer, control);
}
