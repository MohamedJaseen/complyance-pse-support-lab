# Complyance — Product Support Engineer
## Assignment 2: Own a Support Case from Report to Resolution

**Case: PSE-A2-002 · Priority: P2**

## Your task

Investigate a fictional customer's incomplete import, make a bounded local fix, and demonstrate how you would retain ownership throughout the support lifecycle. We assess technical reasoning, safe execution, clear communication, and honest verification—not just whether a test turns green.

Cedar Demo Malaysia reports that 12 records were accepted and the job appears complete, but only seven results are visible. They ask whether to upload the file again. This is the customer's reported observation, not a verified diagnosis. Establish the actual state before drawing conclusions or promising recovery.

## What we provide

The candidate packet contains a runnable TypeScript/Bun application, synthetic local data, starter tests, a scenario and training-policy card, and a case-report template. Each candidate works independently in their own local copy. Start with `START_HERE.md`; use `SCENARIO.md` and the starter README for the exact workflow, API, and safety rules. No production access or external service is needed.

## What you should do

- Draft an initial acknowledgment, a checkpoint update, and a final update or conditional closure. Distinguish customer reports, verified facts, hypotheses, and outstanding actions.
- Reproduce the issue through the supplied API workflow, identify its causal code path, implement a narrow permanent fix, and add a regression that fails before the fix and passes afterward.
- Verify genuine results and record identities across different input volumes and batch sizes. Preserve workspace isolation and the unaffected control case; do not substitute displayed counters for completed work.
- After patching, reconcile the existing case using the approved lab-only resume command. Demonstrate that previously produced results were preserved without duplicates. Do not blindly re-upload a partially processed file.
- Explain the P2 impact, safe workaround, and escalation decision. If escalation is needed, include a Linear-ready draft with evidence, a precise request, and a requested owner/checkpoint. Support retains customer continuity; do not invent engineering acceptance or a release.

## Exercise clock

The training-only first-response deadline is **13:30 GST / 17:30 MYT**. Draft the acknowledgment at the supplied current time and promise the first progress update by **10:00 GST / 14:00 MYT**. These are simulated policy checkpoints, not a production SLA, restoration promise, or your real submission deadline. Do not wait in real time.

## What to submit

Provide one **public** Assignment 2 repository with final work on its default branch. Include the starter with your fix, executable tests, a README with setup/run/test commands and actual results, `CASE_REPORT.md`, and small before/after/test evidence files. Record limitations and any AI assistance; AI-assisted development is allowed, but no AI integration is required.

No customer contact, deployment, video, or architecture presentation is required. Local verification is not production restoration; an honestly documented awaiting-release or awaiting-customer-verification status is acceptable.

You have **two days from receiving the assignment**. The recruiter email supplies the exact deadline (date, time, and timezone), submission form URL, and HR contact. Submit the final links for **two public repositories, one per assignment**, through that form once. No corrections or resubmissions are allowed; submitted work must remain unchanged. Extensions are considered only for a valid reason raised with HR and are not automatic or guaranteed. Only candidates advancing receive a reply; next steps are communicated by email.
