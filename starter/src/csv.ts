import { parse } from "csv-parse/sync";
import { ApiError, type CsvRecord } from "./domain";

export const MAX_CSV_BYTES = 256 * 1024;

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function parseCsv(input: string): CsvRecord[] {
  let parsed: unknown;
  try {
    parsed = parse(input, { bom: true, max_record_size: MAX_CSV_BYTES });
  } catch {
    throw new ApiError(400, "invalid_argument", "CSV is malformed or contains inconsistent columns");
  }
  if (!isArray(parsed)) throw new ApiError(400, "invalid_argument", "CSV must contain a header and records");
  const header = parsed[0];
  if (!isArray(header) || header.length !== 2 || header[0] !== "document_ref" || header[1] !== "label") {
    throw new ApiError(400, "invalid_argument", "CSV header must be exactly document_ref,label");
  }
  const rows = parsed.slice(1);
  if (rows.length < 1 || rows.length > 200) throw new ApiError(400, "invalid_argument", "CSV must contain 1 to 200 records");
  const seen = new Set<string>();
  return rows.map((row, index) => {
    if (!isArray(row) || row.length !== 2) throw new ApiError(400, "invalid_argument", `Row ${index + 2} must have two columns`);
    const [documentRef, label] = row;
    if (typeof documentRef !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(documentRef)) {
      throw new ApiError(400, "invalid_argument", `Row ${index + 2} document_ref must use 1 to 64 ASCII letters, digits, underscores or hyphens`);
    }
    if (typeof label !== "string" || label.trim().length === 0 || label.length > 200) {
      throw new ApiError(400, "invalid_argument", `Row ${index + 2} label must be nonempty and at most 200 characters`);
    }
    if (seen.has(documentRef)) throw new ApiError(400, "invalid_argument", `Row ${index + 2} repeats document_ref ${documentRef}`);
    seen.add(documentRef);
    return { documentRef, label };
  });
}
