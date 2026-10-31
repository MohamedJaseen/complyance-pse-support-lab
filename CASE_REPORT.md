# Case report — PSE-A2-002: Incomplete import

## 1. Summary and impact

- **Priority / rationale:** P2. The reported issue is partial degradation of one customer's import workflow. The supplied scenario contains no evidence of a wider outage, a security incident, or a legal/tax deadline.
- **Current status:** Local fix verified; awaiting independent review/release; awaiting customer verification. This is not a production restoration claim.
- **Reported observation:** Cedar Demo Malaysia reported that 12 records were accepted, only seven results were visible, and the import appeared complete. That report was not treated as verified evidence before inspecting the lab.
- **Verified baseline:** On 30 October 2026, real execution timestamps, the supplied local API returned `case-002` as completed with 12 total, 7 processed, and 5 pending. Existing results were DOC-001–DOC-005 and DOC-011–DOC-012, with record IDs 1–5, 11, and 12. The batch events recorded IDs 1–5 and 11–12. Maple `control-002` was paused with records 13–15 pending and no results. See [Cedar detail](./evidence/01-baseline/cedar-case-detail.txt), [Cedar records](./evidence/01-baseline/cedar-case-records.txt), [Cedar results](./evidence/01-baseline/cedar-case-results.txt), [Cedar events](./evidence/01-baseline/cedar-case-events.txt), and the [Maple baseline](./evidence/01-baseline/maple-control-detail.txt).
- **Workaround / safety:** Use the existing single-record import flow only for genuinely new records. Do not re-upload the partially processed file or replay already accepted work: each POST creates a new import and there is no deduplication guarantee.

## 2. Draft customer communications

These are drafts only; no message was sent to a real customer. The incident times below are simulated exercise times, separate from actual execution timestamps and the real assignment deadline of Saturday, 31 October 2026, 11:59 PM IST.

### Acknowledgment — simulated 26 October 2026, 09:35 GST / 13:35 MYT

Thank you for reporting that your 12-record import appears complete while only seven results are visible. I understand this is interrupting your work. I am checking what the import accepted and what has actually been processed; I do not yet have a confirmed cause or a verified recovery. Please do not upload the same file again or replay records already accepted. For genuinely new records only, the single-record import flow is the safe temporary option. I will own the investigation and send you a progress update by 10:00 GST / 14:00 MYT, even if there is no material change. This is an update commitment, not a restoration estimate.

### Checkpoint update — simulated 26 October 2026, 10:00 GST / 14:00 MYT

I am continuing to reconcile the accepted rows with the persisted results. At this checkpoint, I have not confirmed whether the records without visible results remain pending, failed, or are affected in another way, and I cannot yet promise recovery. Please continue not to re-upload the file; the single-record flow remains limited to genuinely new work. My next step is to finish the record-level reconciliation and determine a safe recovery path. I will provide another update by 11:00 GST / 15:00 MYT.

### Final update / conditional closure — simulated 26 October 2026, 11:00 GST / 15:00 MYT

In the supplied local training database, the patched worker resumed the existing `case-002` import: all 12 source rows now have one matching normalized result, the import has no pending rows, and the seven results present before recovery were retained. The paused Maple control remained unchanged. This verifies the local fix and approved lab recovery only; it does not verify a production release, your production data, or your confirmation that work is restored. Support remains the customer owner. Engineering review and a release decision are requested next; after any independently approved release, Support should request customer verification and update you at the next agreed checkpoint. Closure is conditional on independent review/release, confirmation that the relevant customer import is complete without duplicate results, and customer confirmation that work can continue. If any check fails or broader impact is found, Support will keep the case open and re-escalate. No restoration ETA is supplied.

## 3. Reproduction and root cause

- **Environment and steps:** Windows local lab; Bun 1.4.4 and Node.js 26.8.1; default batch size 5. The supplied `case-002.csv` was POSTed with `Content-Type: text/csv` and `x-lab-workspace: cedar-demo` to a real local API using an isolated temporary SQLite database and port 52327. POST returned HTTP 202 and import ID `377d936c-6012-4cd9-b958-bfd996469a5c`; a subsequent read showed completed, 12 total, 7 processed, 5 pending. See [POST response](./evidence/02-reproduction/post-response.txt), [completion poll](./evidence/02-reproduction/completion-polls.txt), and [results](./evidence/02-reproduction/results.txt).
- **Expected versus observed:** Expected: 12 processed rows and 12 genuine results. Observed: 12 source rows, seven results, five pending despite the completed state.
- **Confirmed cause:** `processImport` requested batches using an offset and incremented that offset after each commit. `commitBatch` moves committed rows out of the pending set. With 12 rows and batch size 5, after the first batch of IDs 1–5, seven rows remain pending; offset 5 skips IDs 6–10 and returns IDs 11–12. The next offset page is empty, so processing finishes with five pending rows. `commitBatch` changes each committed record from pending to processed in the same transaction as result creation and fails if a row was not pending, so repeatedly fetching offset 0 does not keep selecting already committed rows.
- **Other hypotheses:** The local evidence does not indicate a Maple/workspace leak; the Maple-scoped Cedar read returned 404 and the paused Maple control remained unchanged. No evidence was found for a wider outage, security incident, or deadline impact in the supplied scenario.
- **Permanent change:** Only `starter/src/worker.ts` changes processing pagination: every fetch requests offset 0 from the shrinking pending set. The API, CSV contract, fixtures, default batch size, validation, and workspace checks are unchanged.

## 4. Tests and existing-case reconciliation

| Check | Actual result and evidence |
| --- | --- |
| Regression: failure before, success after | Original worker: 9 failed, 2 passed among 11 regression tests, with the expected incomplete counts; see [before-fix output](./evidence/02-reproduction/tests-before.txt). Fixed worker: all 11 regression assertions passed in the full run; the overall run still exits nonzero because of shutdown failures; see [full test output](./evidence/05-final-tests/tests-final.txt). |
| Varied volumes, batch boundaries, different batch size | Tests cover 1, 5, 6, 10, 11, 12, 21, and 200 rows at batch size 5, plus 12 rows at batch sizes 3 and 7. Exact document references, record/result identities, normalized values, unique results/event IDs, completion counts, and bounded batches are asserted. The regression test cases passed in the recorded post-fix run. |
| API validation and workspace isolation | The existing suite's validation, CSV, import-scope, and paused-control checks passed in the final run. Baseline cross-workspace read returned HTTP 404 in [baseline evidence](./evidence/01-baseline/maple-cross-workspace-case.txt); post-recovery it also returned HTTP 404 in [recovery evidence](./evidence/04-recovery/after/cross-workspace-404.txt). |
| Original case before recovery | Read-only snapshot: `case-002`, source IDs 1–12, 7 results with record IDs 1, 2, 3, 4, 5, 11, 12, and 5 pending rows. The [before snapshot](./evidence/04-recovery/before/database-snapshot.txt) and backup integrity check are recorded; the SQLite backup itself is local-only and not included. |
| Patched-worker restart and approved `resume-case` | Started the patched worker against the original lab DB, then `bun run resume-case` returned queued with 5 pending. The worker completed by the first recorded poll. See [health](./evidence/04-recovery/after/health.txt), [resume acknowledgment](./evidence/04-recovery/resume-case-output.txt), [poll](./evidence/04-recovery/after/case-polling.txt), and [events](./evidence/04-recovery/after/cedar-events.txt). |
| Original case after recovery | HTTP detail reports 12 processed and 0 pending; DOC-001–DOC-012 each have one normalized result. The original seven result IDs remain unchanged; the recovery batch contains only IDs 6–10. All checks passed in [verification.txt](./evidence/04-recovery/after/verification.txt). |
| Paused Maple control | Before/after detail, records, results, and events match; it remains paused with three pending records, IDs 13–15, and no results. The [verification](./evidence/04-recovery/after/verification.txt) also records a read-only DB comparison against the local backup. |

**Known test limitation:** On this Windows run, `bun run test` reported 35 passed and 1 failed. The existing clean-restart test fails because the Bun child does not stop with the expected clean `SIGTERM` exit; the same restart test also failed when run against the original worker. The new processing-volume test file reports an `afterAll` `AggregateError` for test-server shutdown. `bun run check-types` passed. WSL had only the `docker-desktop` distribution and no Bun/Node runtime, so no Linux test run was performed. During the standalone recovery shutdown, the server process stopped and port 4328 became free, but the `bun run start` wrapper logged exit code 1. Do not treat the full suite as green.

## 5. Escalation and customer ownership

- **Decision and reason:** Request independent engineering review and a release decision. A local fix and local recovery are verified, but production behavior and release approval are not.
- **Continuity:** Support retains customer ownership and should provide the next update after the independent-review checkpoint. No engineering owner has accepted this request; no release or ETA is confirmed.
- **Linear-ready draft (not filed):**
  - **Title:** P2: import worker completes while pending rows remain after offset pagination
  - **Impact/scope:** One reported customer import; 12 rows accepted, seven visible, five pending in the supplied local reproduction. No supplied evidence of wider impact.
  - **Reproduction/evidence:** POST the supplied 12-row CSV with default batch size 5. The local reproduction returned completed with 7 processed / 5 pending. See [reproduction response](./evidence/02-reproduction/completion-polls.txt), [results](./evidence/02-reproduction/results.txt), and [events](./evidence/01-baseline/cedar-case-events.txt).
  - **Findings/change/tests:** Worker offset pagination queried a shrinking pending set and skipped rows. Local change resets the pending query offset to 0; regression assertions cover multiple volumes and batch sizes. Local recovery is verified in [recovery verification](./evidence/04-recovery/after/verification.txt). Full Windows Vitest remains nonzero because of shutdown errors, including the restart test that fails on original code.
  - **Ask:** Independently review the worker fix and transaction/state invariants; decide whether and when to approve a release; advise on the Windows child-process shutdown test limitation.
  - **Requested owner/checkpoint:** Request an Engineering owner to acknowledge and provide a review checkpoint. No owner is assigned or accepted.
  - **Pending decisions:** Independent approval, release plan, production validation, and customer confirmation. No restoration ETA.
- **Exit criteria:** Keep Support engaged through review and release decisions. Close only after release is independently approved and verified, the affected customer confirms their work is complete and usable without duplicate processing, and no new impact is reported. Reopen/escalate if those checks fail.

## 6. Submission notes

- **Evidence index:** [Baseline](./evidence/01-baseline/), [reproduction and before-fix test](./evidence/02-reproduction/), [fix tests and diff](./evidence/03-fix/), [recovery before/after](./evidence/04-recovery/), and [final tests](./evidence/05-final-tests/). Evidence timestamps are actual execution times; the draft communications use only the separately labelled simulated incident clock.
- **AI assistance:** An AI coding assistant was used to inspect the supplied files, investigate the worker behavior, implement the narrow change, add regression tests, summarize command output, and draft this report. I reviewed the worker and repository transaction code, inspected actual HTTP and SQLite results, and ran the recorded tests and type-check independently.
- **Limitations:** No production systems, customer records, customer contact, release, engineering acceptance, or customer verification were involved. The Windows test-server shutdown failures remain unresolved; Linux test execution was unavailable. The final test command is not green.
