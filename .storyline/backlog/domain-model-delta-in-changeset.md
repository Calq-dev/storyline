# Feature: Domain Model Delta Belongs in the Changeset, Not the Blueprint

**Source:** Design gap surfaced during session (2026-04-06)
**Date:** 2026-04-06

## Raw Idea

Currently Sticky Storm and Doctor Context write new domain model entries (events, commands, invariants, relationships) directly into `blueprint.yaml` before anything is built. This means the blueprint describes things that don't exist in code yet — you can't tell what's built vs what's planned.

The fix: domain model deltas live in the changeset. The blueprint only gets updated after the build is green (by The Onion's delta-apply step).

## Why This Matters

**Interrupted sessions:** if Sticky Storm commits new events to the blueprint and the session stops before The Onion builds, the blueprint is now inconsistent with the codebase. The next session can't trust it. The as-built survey has to reverse-engineer reality to clean up.

**With deltas in the changeset:** the changeset file survives session interruption (it's committed to git), the blueprint stays trustworthy, and the Foreman can resume exactly where it left off via `build`.

## Scope

- **Changeset schema** — add a `domain_model_delta` section (new events, commands, aggregates, invariants, relationships to apply post-build)
- **Sticky Storm** — write delta to changeset, not blueprint directly
- **Doctor Context** — same: write invariants/relationships to changeset delta, not blueprint
- **The Onion** — read domain model from blueprint (existing) + delta (changeset); apply delta to blueprint after each scenario goes green (or after all green)
- **As-built survey** — no longer needs to reconcile pre-build blueprint pollution; still reconciles drift from implementation decisions
- **The Foreman (skill)** — no change expected for Role 2 briefing, but validate
- **The Foreman (status inspector agent)** — currently detects pipeline phase by reading blueprint content (e.g. "aggregates have events → Sticky Storm ran"). If Sticky Storm stops writing to the blueprint, this detection logic breaks silently. Phase detection needs to read the changeset delta instead, or a separate marker.

## Risks

- **Status inspector redesign is the hardest part.** `agents/foreman.md` has a fixed state detection table driven entirely by blueprint content. Moving domain model entries out of the blueprint means every phase-detection rule that checks for events, invariants, or relationships needs to be rethought — likely reading changeset delta presence instead. This is not a small tweak; it may require a new detection model entirely.

## Open Questions (pre-Three Amigos)

- Does The Onion apply the delta incrementally (per scenario) or all at once after all scenarios are green?
  **Best guess: incrementally.** Each green scenario advances both the code and the blueprint one step — they stay in sync commit by commit, like a small git flow for the domain model. "All at once" reintroduces the interrupted-session problem just later in the process.
- Do Sticky Storm and Doctor Context still commit their output, or does it all travel with the changeset?
  **Note:** If their output travels with the changeset, they no longer touch `blueprint.yaml` at all — a fundamental change in what both agents do. If they still commit separately, we need a clear convention for marking delta entries as "planned, not yet built" so the blueprint stays trustworthy. Either answer reshapes the agent design significantly.
- If a changeset is abandoned, how do we clean up a partially-applied delta?

## Ready for Three Amigos?

Yes — scope is clear, key risk is named, open questions are specific enough to drive a focused session. Start with the load-bearing question: do Sticky Storm and Doctor Context still touch the blueprint at all?
