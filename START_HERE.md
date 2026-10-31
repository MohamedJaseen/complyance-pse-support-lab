# Assignment 2 — Start here

Own the fictional P2 case `PSE-A2-002` from initial response through investigation, a local fix, and a truthful handoff or conditional closure. Work in your own copy of this packet; all data and activity are local training material.

## Provided files

| File or directory | Purpose |
| --- | --- |
| `SCENARIO.md` | Customer report, exercise clock, policy, safety boundaries, and required evidence. |
| `CASE_REPORT_TEMPLATE.md` | Copy to `CASE_REPORT.md` and complete with your decisions and evidence links. |
| `starter/README.md` | Authoritative setup, commands, runtime settings, API details, and recovery instructions. |
| `starter/` | Standalone TypeScript/Bun application, synthetic fixtures, and starter tests. |

You need Bun 1.3 or later and Node.js 22 or later for Vitest tooling. See `starter/README.md` for official installation links and Bash/zsh and Windows PowerShell commands. No production credentials, external database, Docker, or Linear account is required. Use the supplied application, not the surrounding company monorepo.

## Working sequence

1. **Read before running.** Read the scenario and starter README. Record the simulated clock separately from actual execution timestamps. Draft the acknowledgment at the scenario's current time; do not imply you have already verified the customer report.
2. **Prepare the local lab.** Follow `starter/README.md` to install dependencies and start the API/background worker. Startup seeds only an empty database; retain your existing case and its evidence. Reset is destructive to the configured local demo database: stop the server first and use it only when intentionally discarding that database.
3. **Capture the baseline.** Inspect health, the Cedar case, source records, actual results, and processing events. Capture the paused Maple control and cross-workspace behavior. Reproduce through the CSV import API in an isolated test database; a synthetic reproduction is not permission to replay a customer's partial upload.
4. **Investigate and fix.** Follow the evidence to the causal code path. Make a bounded change and add Vitest regression coverage that demonstrates failure before and success after the fix. Preserve the public API, valid CSV behavior, configured batching, and workspace boundaries.
5. **Recover and verify.** After the patch is in place, use `bun run resume-case` against the original lab database to requeue the existing supplied case. The worker processes it; the command acknowledgment alone is not recovery evidence. Verify genuine results, preserved prior identities, no duplicate processing, and an unchanged control. See the scenario and README for the full checks.
6. **Complete the lifecycle.** Write the checkpoint update, final update/conditional closure, and escalation decision. Keep support ownership explicit. Record pending review, release, or customer verification without fabricating those events.

## Required submission artifacts

- Your modified starter application and executable tests.
- A repository README with prerequisites, setup/run/test/recovery commands, actual test outcomes, and known limitations.
- `CASE_REPORT.md`, based on the supplied template.
- Small evidence files for baseline API responses, post-fix/recovery checks, and test output; link them from the report. No secrets or unrelated data.
- AI-assistance disclosure, including “none” where applicable, and known limitations.

Provide one **public** Assignment 2 repository link with final work on its default branch. Submit the final links for **two public repositories, one per assignment**, using the form URL in the recruiter email. You have **two days from receiving the assignment**; that email supplies the exact deadline (date, time, and timezone) and HR contact. This real submission window is separate from the simulated incident clock.

Submit once: no corrections or resubmissions are allowed, and submitted work must remain unchanged. Extensions are considered only for a valid reason raised with HR; they are not automatic or guaranteed. Only candidates advancing receive a reply; next steps are communicated by email.

Do not send messages to the fictional customer, open a real Linear issue, deploy the application, or record a video.
