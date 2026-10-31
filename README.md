# Complyance PSE Assignment 2 — Support Lifecycle Lab

This repository contains the fictional P2 case investigation, a narrow local fix, regression tests, and evidence for PSE-A2-002. It is a synthetic local training app; this work does not represent a production release or customer confirmation.

## Prerequisites

- Bun 1.3 or newer
- Node.js 22 or newer (for Vitest)
- Windows PowerShell examples use `curl.exe`, not PowerShell's `curl` alias

The recorded environment was Bun 1.4.4 and Node.js v26.8.1 on Windows.

## Setup and run

From `starter/`:

```powershell
bun install --frozen-lockfile
bun run start
```

By default, the server binds to `127.0.0.1:4328`, uses batch size 5, and stores local data in `starter/.data/lab.sqlite`. The worker starts with the API. Stop the server with Ctrl-C. The observed Windows SIGTERM shutdown behavior is documented below.

Check the health endpoint from another PowerShell terminal:

```powershell
curl.exe -sS -i http://127.0.0.1:4328/health
```

## Tests and type-check

From `starter/`:

```powershell
bun run test
bun run check-types
```

**Actual recorded results:**

- `bun run check-types`: passed, exit code 0.
- Full `bun run test`: 35 passed, 1 failed, exit code 1.
- All 11 new processing-volume regression assertions passed with the fix, covering row counts 1, 5, 6, 10, 11, 12, 21, and 200 at batch size 5 and 12 rows at batch sizes 3 and 7.
- The existing clean-restart test fails because the Bun child does not stop with the expected clean SIGTERM exit. The same test failed with the original worker, so this failure predates the fix in this environment.
- The new test file also reports an `afterAll` `AggregateError` when its test servers do not stop cleanly. The full suite is not green; this test was not skipped or weakened.
- The recovery server process stopped and port 4328 was free, but its `bun run start` wrapper recorded exit code 1 after SIGTERM.
- WSL exposed only the `docker-desktop` distribution, without Bun or Node; Linux results are unavailable.

See [dependency installation output](./evidence/05-final-tests/install-final.txt), [final test output](./evidence/05-final-tests/tests-final.txt), [type-check output](./evidence/05-final-tests/typecheck-final.txt), and [baseline SIGTERM test output](./evidence/03-fix/tests-before.txt).

## Recovery of the supplied lab case

`bun run resume-case` is a lab-only command. It requeues the existing `cedar-demo / case-002` when completed with pending rows; it does not process them itself. Start the server with the patched code first, then run this command from `starter/` in another terminal against the same original local database:

```powershell
bun run resume-case
```

Do not reset or re-upload a partially processed import. Every accepted POST creates a new import without a deduplication guarantee. The supplied local recovery completed with 12 processed rows and no pending rows; Maple remained paused and unchanged. See [pre-recovery snapshot](./evidence/04-recovery/before/database-snapshot.txt), [resume acknowledgment](./evidence/04-recovery/resume-case-output.txt), and [recovery verification](./evidence/04-recovery/after/verification.txt). A local-only SQLite backup was deliberately excluded from this repository.

## Fix summary

The worker previously incremented an offset while committed rows were being removed from the pending set. This skipped pending rows after the first batch. `starter/src/worker.ts` now always queries the first pending batch (offset 0). CSV handling, API behavior, fixtures, workspace checks, and default batch size are unchanged.

## Evidence index

- [Baseline API captures](./evidence/01-baseline/)
- [Isolated reproduction and original-worker regression failure](./evidence/02-reproduction/)
- [Fix verification and diff](./evidence/03-fix/)
- [Original-case recovery evidence](./evidence/04-recovery/)
- [Final test and type-check outputs](./evidence/05-final-tests/)

Timestamps in evidence are real execution times. Incident communications in [CASE_REPORT.md](./CASE_REPORT.md) use the separate simulated policy clock.

Evidence text files were normalized to UTF-8, ANSI color sequences were removed, and absolute local user paths were redacted to placeholders. HTTP status lines, response bodies, execution timestamps, and test outcomes were retained.

## AI assistance and limitations

An AI coding assistant was used for code investigation, the worker change, regression tests, command-output review, and documentation drafts. The results were independently checked against the worker/repository code, real HTTP responses, SQLite state, and executed tests. No AI service integration, production access, customer contact, release, or customer verification was used.

Known limitation: the Windows full test suite is nonzero due to test-server shutdown behavior, including the existing restart test that also fails with the original worker. The volume assertions themselves pass. Independent engineering review/release and customer verification remain pending.
