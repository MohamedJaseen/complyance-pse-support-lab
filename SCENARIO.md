# PSE-A2-002 — Incomplete import

## Customer report

**Customer:** Cedar Demo Malaysia, a fictional customer. **Assigned priority:** P2.

> We uploaded 12 records. The import was accepted and now says complete, but we can see only seven results. We need to continue our work. Should we upload the file again?

Treat **12 accepted / seven visible / job complete** as the customer's observation, not an established root cause or your own verification. Your first action is to establish what the local application actually accepted, processed, stored, and reported. Record mismatches and distinguish observations from hypotheses.

The reported impact is partial degradation of one customer's import workflow. There is no supplied evidence of a wider outage, a security incident, or a legal/tax deadline. Do not invent any. A P2 investigation and a bounded local patch are appropriate; independently reviewed engineering release remains separate from support's local work.

## Training-policy card — SIM-1

| Item | Supplied exercise value |
| --- | --- |
| Receipt | Monday 26 October 2026, 09:30 GST (UTC+04) / 13:30 MYT (UTC+08). |
| Current simulated time | 09:35 GST / 13:35 MYT on the same day. |
| P2 first meaningful human response | Within four business hours; Monday–Friday, 09:00–18:00 Asia/Dubai, no holidays in this exercise. |
| First-response deadline | **13:30 GST / 17:30 MYT**, 26 October 2026. |
| First promised progress update | **By 10:00 GST / 14:00 MYT**, 26 October 2026, even if there is no material change. |
| Restoration | No numerical restoration SLA and no supplied restoration ETA. |

This policy is **training only**, not a production SLA. Draft the acknowledgment at the current simulated time. At the update checkpoint, report only what is known then, any remaining uncertainty, and a next action/checkpoint. You may choose a later simulated time for subsequent verification; label it explicitly and keep the sequence credible. Never present actual database timestamps as the policy clock or imply real hours elapsed. Do not wait in real time.

The simulated incident clock is separate from your **two-day window from receiving the assignment**. The recruiter email supplies the exact real submission deadline (date, time, and timezone), form URL, and HR contact; see `START_HERE.md` for submission rules. Do not change the simulated dates to match your real deadline.

Acknowledge the impact, explain the immediate investigation and safe workaround, and own the next update. Do not announce a diagnosis, completed recovery, customer confirmation, release, or engineering acceptance before you have corresponding evidence. All communications are **drafts in your report**, not messages to a real customer.

## Lab and provided evidence sources

Read [starter/README.md](starter/README.md) for installation, commands, complete request/response schemas, and runtime details. The lab runs on local Bun/SQLite with an API and real background processing. Each candidate uses an independent database; there are no production services or tax submissions.

Default configuration: loopback port `4328`, batch size `5`, database `starter/.data/lab.sqlite` when commands run from `starter/`. Settings are `SUPPORT_LAB_PORT`, `SUPPORT_LAB_BATCH_SIZE` (1–20), and `SUPPORT_LAB_DB`; port `0` permits an isolated test server to choose a free port. Do not change the default batch size or fixtures to make the reported case disappear.

On an empty database, startup supplies:

| Workspace selector | Import | Source data and initial state |
| --- | --- | --- |
| `cedar-demo` | `case-002` | 12 records, `DOC-001`–`DOC-012`, labels `Sample 001`–`Sample 012`; queued for the worker. |
| `maple-demo` | `control-002` | Three records, `CTRL-001`–`CTRL-003`; paused and pending. Keep this control unchanged. |

Capture actual state after the worker has run; the table describes seed data, not a claim that you have reproduced or diagnosed the report. Startup does not reset an existing database or automatically repair a completed case.

### Baseline API inspection

`GET /health` requires no workspace header. Other requests require `x-lab-workspace: cedar-demo` or `maple-demo`. These are synthetic local selectors, not production authentication.

For example, from another terminal while the default server is running (Bash/zsh; in Windows PowerShell use `curl.exe` instead of `curl`):

```sh
curl -sS http://127.0.0.1:4328/health
curl -sS -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002
curl -sS -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/records
curl -sS -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/results
curl -sS -H 'x-lab-workspace: cedar-demo' http://127.0.0.1:4328/imports/case-002/events
```

Capture HTTP status as well as JSON when recording evidence. Inspect the equivalent control endpoints with `maple-demo` and `control-002`; also check a Cedar import cannot be read under Maple. Unknown or cross-workspace import IDs return `404`, not another workspace's data.

The evidence has distinct meanings:

- Import detail: `id`, `workspaceId`, `state`, `total`, `processed`, `pending`; counts reflect actual source-row states.
- Records: stable numeric `id`, `documentRef`, `label`, and `pending`/`processed` state.
- Results: `recordId`, `documentRef`, `normalizedLabel`; each processed source record must have one genuine result, normalized as `label.trim().toUpperCase()`.
- Events: ordered entries including `batch_processed` with `recordIds` and `count`. Batch writes, source-state changes, and that event commit together; a batch cannot exceed the configured size.

### Reproduction and permanent-fix checks

Reproduce the original workflow with `POST /imports`, workspace header, `Content-Type: text/csv`, and the supplied `starter/fixtures/case-002.csv` (header `document_ref,label`); then inspect the returned import ID through the read endpoints. Use synthetic data in an isolated test database for these submissions. **Every POST creates a new import; there is no deduplication guarantee.** Reproduction is not recovery of `case-002`.

Preserve the public API and validation rules in the README, including 1–200 valid rows, atomic rejection of invalid CSV/data, correct result normalization, scoped reads, and genuine HTTP error statuses. Implement a narrow causal fix, not a different workflow, larger batch size, changed fixtures, disabled workspace checks, or a fabricated success counter.

Add Vitest regression coverage that fails before your change and passes afterward. Verify the reported volume, smaller and larger volumes, batch boundaries, and a different supported batch size. Assert exact record/result identities and normalized values, not just lengths or a `completed` label. Completion requires no pending rows and `processed == total`; verify no duplicate results or processing, bounded batch events, and an unchanged paused control. Keep starter validation and isolation checks working. Use the actual local HTTP application in integration tests; see the README for test commands.

## Safe mitigation and existing-case recovery

The approved temporary workaround is the existing **single-record import flow for genuinely new records only**. It does not recover the partial case. Do not advise blindly re-uploading any unknown or partly processed records, deleting prior results, or replaying accepted work. First reconcile which source records already have genuine results.

After the permanent patch is in place, use the supplied **lab-only** command from `starter/`:

```sh
bun run resume-case
```

Run it against the original case database. It requeues the existing Cedar `case-002` when completed with pending records, records `resume_requested`, and prints an acknowledgment; it does not itself process records. The server worker processes the queued job while running or on its next start. Follow the README's restart instructions so the worker uses your patched code.

Capture pre-recovery identities and final evidence: the same import and source IDs, all 12 genuine results, none pending, all earlier result identities retained, no duplicate processing, and unchanged Maple control data. A resume acknowledgment alone is not verified recovery. Resuming without a permanent fix is not a durable solution for future imports. Do not add automatic repair on startup or generalize this approval to a production replay.

`bun run reset` deletes all demo data in the configured local lab database. Stop the server before using it; do not reset the original case as a substitute for reconciliation. Preserve before/after evidence and use separate test databases for repeatable experiments.

## Ownership, escalation, and end state

Support owns customer continuity, safe guidance, and the next update throughout. Always document your escalation decision. If engineering engagement is needed, draft a **Linear-ready ticket in the report**, with impact/priority, evidence and reproduction, local findings/change, a precise request, requested owner and checkpoint, and explicit pending decisions. Do not create an actual ticket or invent an accepted owner, approval, deployment, or restoration ETA. Newly discovered broader impact or security concerns require prompt engagement; explain the evidence if you find any.

Local patch verification is not production restoration. End with a truthful status such as local fix verified, awaiting independent review/release, or awaiting customer verification. State who is requested to act next, what remains unverified, and when support would next update the customer. Conditional closure must identify the confirmations needed first.

Complete `CASE_REPORT.md` using the supplied template and link small evidence files. No customer contact, production access, external service, deployment, video, or AI integration is required.
