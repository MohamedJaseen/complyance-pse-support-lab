# Local support lifecycle lab

A standalone, synthetic import-processing application for PSE Assignment 2. Each candidate runs an independent copy and local SQLite database. No production systems, credentials, tax submissions, callbacks or customer contact are involved. A defect is present in the supplied application; investigate the observed behavior rather than treating a successful HTTP status as proof that all work is correct. The scenario and reporting requirements are in the candidate packet one directory above.

## Requirements and quickstart

- Bun **1.3 or newer**, on your PATH as `bun`. Install using the [official Bun instructions](https://bun.com/docs/installation) for your operating system.
- Node.js **22 or newer** for the Vitest runner. Install from the [official Node.js downloads](https://nodejs.org/en/download). The application itself runs in Bun.
- A terminal and an HTTP client such as curl, Postman, or Insomnia. No Docker or external database is needed.

The recorded validation used **Bun 1.4.0 on macOS ARM64**. Windows and Linux execution have **not** been verified; the shell examples below are setup guidance, not a platform-validation claim.

Run commands from this `starter` directory, not the parent monorepo. The `bun` and `node` commands work in Bash/zsh and Windows PowerShell; use the shell-specific blocks where shown. On Windows, use `curl.exe`, not PowerShell's `curl` alias.

After installation, reopen your terminal if needed and confirm both runtimes are on PATH:

```sh
bun --version
node --version
```

Install dependencies and start the lab:

```sh
bun install --frozen-lockfile
bun run start
```

The server initializes `.data/lab.sqlite`, starts a serial background worker in the same process, binds only to `127.0.0.1`, and prints:

```text
Support lab listening http://127.0.0.1:4328
```

A port of `0` chooses a free port; the startup line always reports the actual port. Stop with Ctrl-C or SIGTERM. Shutdown stops accepting requests, waits for active requests and the worker, and closes SQLite cleanly.

In another terminal, make a first-run health request and inspect the case. **Bash/zsh:**

```sh
curl -sS -i http://127.0.0.1:4328/health
curl -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002
curl -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/records
curl -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/results
curl -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/events
curl -sS -i -H 'x-lab-workspace: maple-demo' http://127.0.0.1:4328/imports/control-002
```

**Windows PowerShell:**

```powershell
curl.exe -sS -i http://127.0.0.1:4328/health
curl.exe -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002
curl.exe -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/records
curl.exe -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/results
curl.exe -sS -i -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/events
curl.exe -sS -i -H 'x-lab-workspace: maple-demo' http://127.0.0.1:4328/imports/control-002
```

With the default configuration, a successful health response has HTTP status **200 OK** and this JSON body:

```json
{"status":"ok","mode":"training","batchSize":5}
```

This confirms the local service is reachable, not that the import is correct. If you selected another port, use the actual URL printed at startup.

Alternatively, use Postman or Insomnia: send `GET` to the same URLs, leave the health request header-free, and set `x-lab-workspace` to the indicated value for import requests. Save the HTTP status and JSON body as evidence. For `POST /imports`, set `Content-Type: text/csv` and send the CSV file contents as the raw body.

The initial fixture is `cedar-demo / case-002`, with twelve rows `DOC-001` through `DOC-012`, labels `Sample 001` through `Sample 012`, initially queued for the real worker. `maple-demo / control-002` contains three pending rows `CTRL-001` through `CTRL-003` and is paused. The worker must leave that paused import unchanged. Source fixtures are in `fixtures/`; they are not a substitute for inspecting persisted HTTP results. Startup seeds only a new, empty lab database, never resets existing state, and never automatically requeues a completed import after an edit. Timestamps reflect real execution time, not the scenario's simulation clock.

## Configuration

| Variable | Default | Accepted values |
| --- | --- | --- |
| `SUPPORT_LAB_DB` | `.data/lab.sqlite` | Nonempty local SQLite file path; relative paths resolve from the working directory. `:memory:` is not supported. |
| `SUPPORT_LAB_PORT` | `4328` | Integer `0`–`65535`; `0` requests a free port. |
| `SUPPORT_LAB_BATCH_SIZE` | `5` | Integer `1`–`20`. |

Invalid configuration stops startup instead of silently falling back. Use the same `SUPPORT_LAB_DB` value for start, reset and resume when selecting a non-default local database. The database carries a training-application marker; an existing database owned by something else is refused. Do not point these commands at production or unrelated files. Keep the supplied fixture and normal batch size for the original reproduction; changing either is not a repair.

**Bash/zsh:**

```sh
SUPPORT_LAB_DB=.data/isolated.sqlite SUPPORT_LAB_PORT=0 bun run start
```

**Windows PowerShell:**

```powershell
$env:SUPPORT_LAB_DB = ".data/isolated.sqlite"
$env:SUPPORT_LAB_PORT = "0"
bun run start
```

PowerShell environment settings persist in that terminal. Use a fresh terminal for default settings, or remove overrides with `Remove-Item Env:SUPPORT_LAB_DB, Env:SUPPORT_LAB_PORT` before returning to the original database.

## HTTP contract

Responses are JSON. Every route except `GET /health` requires one synthetic selector:

```text
x-lab-workspace: cedar-demo
```

or `maple-demo`. This local training selector is **not production authentication**. A missing/invalid selector returns HTTP 400. Unknown or cross-workspace import IDs return HTTP 404 without exposing the other workspace's records, results or events.

### Health

`GET /health` → HTTP 200:

```json
{"status":"ok","mode":"training","batchSize":5}
```

`batchSize` reflects the active configuration.

### Create an import

`POST /imports`, selector header and `Content-Type: text/csv` → HTTP 202:

```json
{"id":"<generated UUID>","workspaceId":"cedar-demo","state":"queued","total":1}
```

The CSV header must be exactly `document_ref,label`, in that order. Accepts 1–200 data rows, UTF-8 with optional BOM, LF or CRLF, and ordinary CSV quoting/escaped quotes. The body limit is 256 KiB. Within one import:

- `document_ref` must be unique, 1–64 ASCII letters, digits, `_` or `-`.
- `label` must contain a non-whitespace value and be at most 200 UTF-16 code units; original whitespace and case are stored.
- Malformed CSV or invalid rows reject the entire request with HTTP 400. No partial import is persisted.

For a **new**, single-record workflow, **Bash/zsh:**

```sh
printf 'document_ref,label\nNEW-001, New example \n' | curl -sS -i \
  -H 'x-lab-workspace: cedar-demo' -H 'Content-Type: text/csv' \
  --data-binary @- http://127.0.0.1:4328/imports
```

**Windows PowerShell** (writes a small synthetic CSV, then sends it):

```powershell
@("document_ref,label", "NEW-001, New example ") | Set-Content -Encoding ascii new-record.csv
curl.exe -sS -i -H 'x-lab-workspace: cedar-demo' -H 'Content-Type: text/csv' --data-binary "@new-record.csv" http://127.0.0.1:4328/imports
```

Every accepted POST creates a new import. There is no deduplication or safe-retry guarantee across requests; do not reupload the partly processed supplied case. Keep the returned ID and poll its status rather than resubmitting. No network callback or external submission occurs.

### Inspect an import

`GET /imports/:id` → HTTP 200:

```json
{"id":"<id>","workspaceId":"cedar-demo","state":"queued","total":1,"processed":0,"pending":1}
```

Counts are derived from actual source rows, not guessed from the job state. States are `queued`, `running`, `completed`, `failed`, or `paused`. Requests and worker execution are asynchronous: a read may already show a later state than the POST response.

`GET /imports/:id/records` → HTTP 200:

```json
{"records":[{"id":16,"documentRef":"NEW-001","label":" New example ","state":"processed"}]}
```

Records are ordered by numeric source record ID. IDs are database-wide identifiers; do not assume a new import starts at one. Record states are `pending` or `processed`.

`GET /imports/:id/results` → HTTP 200:

```json
{"results":[{"recordId":16,"documentRef":"NEW-001","normalizedLabel":"NEW EXAMPLE"}]}
```

Results are ordered by source record ID. Each result is a persisted processing output joined to its real source row. Normalization is `label.trim().toUpperCase()`.

`GET /imports/:id/events` → HTTP 200:

```json
{"events":[{"id":8,"type":"batch_processed","details":{"recordIds":[16],"count":1}}]}
```

The example shows one event, not the entire event history. Events are ordered by numeric event ID. Each committed batch emits `batch_processed` with the exact source IDs and count, in the same SQLite transaction as result creation and source updates. Other types include `import_created`, `processing_started`, `processing_completed`, `processing_failed`, and `resume_requested`. Event IDs are database-wide and may have gaps within one import.

The required processing invariants are: preserve workspace/import scope; process each accepted source row once; persist exactly one normalized result for each processed row; respect the configured batch limit; and only report a valid completion when no pending rows remain and processed equals total. Use records, results and events together to evaluate those invariants. Do not change counts or fixtures to conceal missing work.

### Errors

Client errors use an actual non-2xx HTTP status and a structured body, for example:

```json
{"code":"invalid_argument","message":"CSV header must be exactly document_ref,label"}
```

Codes include `invalid_argument` (400), `not_found` (404), and `method_not_allowed` (405). Unexpected HTTP failures return `internal_error` (500) and log details locally. Processing exceptions mark the import `failed`, append an error event and log the error rather than reporting a successful result. There is no `200` response with `success:false`.

## Local case reconciliation and reset

After implementing and validating your permanent change, the approved lab-only command requeues the **existing** `cedar-demo / case-002` when it is completed but still has pending records:

```sh
bun run resume-case
```

It accepts **no arguments**, appends `resume_requested`, and prints one JSON acknowledgment containing `id`, `workspaceId`, `state:"queued"`, and `pending`. It does not run a second worker or recreate the import. The running server's worker (or the next normal server start) handles the queued work. Existing source IDs and results are preserved; only pending source rows are eligible. Invalid states produce a JSON error on stderr and a nonzero exit. This is not a generic replay tool or a production repair authorization. Merely invoking resume is not a permanent repair for future imports. Verify existing results were not duplicated and the paused control did not change.

To restore the original local demo, **stop the server first**, then:

```sh
bun run reset
bun run start
```

Reset deletes **all data in the configured lab database**, including your added imports and evidence history, and reseeds the supplied queued customer case and paused control. Save evidence first. It only resets tables in a recognized lab database, does not recursively delete directories or arbitrary user paths, and does not invoke the worker. Reset accepts no arguments and prints a JSON acknowledgment. Select a separate `SUPPORT_LAB_DB` if you need to preserve another experiment.

## Checks

```sh
bun run check-types
bun run test
```

The public suite uses **Vitest**, spawning the real Bun HTTP server with an isolated temporary SQLite file and an operating-system-selected port. Vitest's Node process never imports `bun:sqlite`. It exercises health, small imports and exact normalized results, CSV rejection, selectors and scope, paused control, event batches, and restart persistence. It is intentionally a starter suite, not proof that every volume or case has been covered. Add the regression coverage required by the scenario. No mocks or external services are needed. The test harness stops its child processes and removes only its own temporary directory.

## File map

| Path | Responsibility |
| --- | --- |
| `src/server.ts` | Loopback HTTP routes and process lifecycle. |
| `src/service.ts`, `src/csv.ts` | Request orchestration, bounded UTF-8 body reading and CSV validation. |
| `src/repository.ts`, `src/database.ts` | Scoped persistence, transactions, indexes and lab database ownership. |
| `src/worker.ts` | Serial background processing. |
| `src/config.ts`, `src/domain.ts`, `src/seed.ts` | Configuration, domain/error contracts and initial fixture loading. |
| `scripts/reset.ts`, `scripts/resume-case.ts` | Restricted local lab commands. |
| `fixtures/` | Supplied customer and paused control CSVs. |
| `tests/http.test.ts`, `tests/harness.ts` | Public real-HTTP Vitest suite and Bun subprocess lifecycle. |
| `package.json`, `tsconfig.json`, `vitest.config.ts` | Standalone dependencies, strict type checking and test configuration. |
