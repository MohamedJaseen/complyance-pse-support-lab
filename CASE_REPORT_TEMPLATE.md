# Case report — PSE-A2-002

Copy this file to `CASE_REPORT.md`. Replace prompts with your own concise findings and evidence links; distinguish drafts, customer reports, verified facts, and hypotheses. Do not invent actions or acceptance. Use “not verified” or “awaiting” where appropriate.

## 1. Summary and impact

- **Priority / rationale:** P2; explain observed impact, scope, and why the safe workaround is limited.
- **Current status:** State local verification and any pending review, release, or customer confirmation separately.
- **Reported observation:** What the customer said; do not present it as your verified diagnosis.
- **Verified baseline:** Actual import state/counts, source rows, result identities, events, control state; evidence links and actual execution timestamps.
- **Workaround / safety:** Guidance for genuinely new records; what must not be replayed and why.

## 2. Draft customer communications

All messages below are drafts, not communications sent to a real customer. Keep the simulated policy clock separate from actual test timestamps and the real two-day submission deadline supplied in the recruiter email.

### Acknowledgment — simulated 26 October 2026, 09:35 GST / 13:35 MYT

Write a customer-ready acknowledgment: impact, current understanding without an unverified diagnosis, safe immediate guidance, investigation ownership, and promised next update **by 10:00 GST / 14:00 MYT**. The training first-response deadline is **13:30 GST / 17:30 MYT**; this is not a restoration promise.

### Checkpoint update — simulated 10:00 GST / 14:00 MYT

Write a meaningful update even if there is no change: facts established by this checkpoint, uncertainty, safe actions, next step, and next promised checkpoint. Do not backfill later discoveries into this message.

### Final update / conditional closure — label your chosen simulated time

Explain what was verified locally, what remains unverified, and the next action/owner/checkpoint. Do not claim a release or customer confirmation without evidence. If proposing closure, state the required confirmations and follow-up conditions.

## 3. Reproduction and root cause

- **Environment and steps:** Runtime, configured batch size, isolated test database, CSV input, API requests, and resulting import ID. Link reproducible before evidence.
- **Expected versus observed:** Compare genuine source states, results, and events, not only summary counters.
- **Causal explanation:** Trace the relevant code path and explain why it produces the observed behavior. Separate confirmed cause from rejected/unproven hypotheses.
- **Permanent change:** Files/logic changed and why the change addresses the cause without changing the public contract.

## 4. Tests and existing-case reconciliation

| Check | Actual result and evidence |
| --- | --- |
| Regression: failure before, success after | Commands, outputs, and assertion showing the behavior difference. |
| Varied volumes, batch boundaries, different batch size | Inputs/settings; exact identities, normalized values, bounded batches, no duplicates. |
| API validation and workspace isolation | Existing checks, unknown/cross-workspace reads, real error statuses. |
| Original case before recovery | Import/source/result identities and pending work; original evidence preserved. |
| Patched-worker restart and approved `resume-case` | Command/acknowledgment, subsequent worker processing, and events. |
| Original case after recovery | Same import/source IDs, 12 genuine results, zero pending, prior results retained, no duplicate work. |
| Paused Maple control | Before/after evidence proving it stayed unchanged. |

List unrun or failing checks explicitly. A command acknowledgment or local passing tests do not establish production restoration.

## 5. Escalation and customer ownership

- **Decision and reason:** Escalate now, request review/release, or no additional escalation; explain boundaries and unresolved risks.
- **Continuity:** Support owner, next customer update/checkpoint, and next requested action. Separate a requested engineering owner from an accepted owner.
- **If escalation is needed — Linear-ready draft:** Title; P2 impact/scope; reproduction and evidence; confirmed findings/local change/tests; precise engineering ask; requested owner/checkpoint; pending acceptance/release decisions. Keep the draft here; do not create a real ticket.
- **Exit criteria:** Remaining review/release/customer-verification steps and conditions for closure or renewed engagement. No invented restoration ETA.

## 6. Submission notes

- **Evidence index:** Relative links to small baseline, post-fix/recovery, and test-output files.
- **AI assistance:** Tools and how they were used, or “none”; how you checked assisted work.
- **Limitations:** Outstanding uncertainties or unfinished work, without implying success.
