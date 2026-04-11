# Session Archive — Amigos on Amigos

**Date:** 2026-04-11
**Plugin version at session start:** 1.11.3
**Plugin version at session end:** 1.13.0
**Blueprint version:** 49 → 50
**Commit:** `11d7a1f` on `main`

## One-paragraph summary

A working session that started with a practical concern — "the amigo sessions produce so much valuable material that consolidation feels shallow" — and ended with two shipped features and a live meta-reflection from the amigos themselves on whether their own ritual is worth its token cost. The shipped work: (1) a **tiered findings format** (`Must Address` / `Should Consider` / `Noted`) that pushes prioritization into the amigos so the synthesis step has something structured to merge instead of a wall of notes; (2) a **zero-LLM-call scorecard CLI** (`storyline amigo-score`) that reads the workbench notes after Round 3 and emits deterministic metrics including a pairwise Jaccard agreement-overlap signal for detecting same-model groupthink, with a RED hard gate that refuses handoff to Mister Gherkin when a sensitive aggregate was discussed with zero dissent. The meta-session was itself the first real test of both features: three amigos reflected on the amigo process, produced nearly-disjoint Must Address lists (agreement overlap `0.04`), genuinely disagreed on several points, and the scorecard gave the session a GREEN verdict — the first quantitative evidence that system-prompt perspective-isolation actually buys something beyond theater.

## Contents of this archive

| File | What it contains |
|---|---|
| [01-narrative.md](./01-narrative.md) | Chronological story of the whole session — what the user asked, what I thought, what was decided, what was built |
| [02-original-question.md](./02-original-question.md) | The opening exchange — user's concern about shallow consolidation + my recommendation |
| [03-tiered-format-design.md](./03-tiered-format-design.md) | The first shipped change: tiered findings format in the amigo prompts + synthesis rewrite |
| [04-meta-session-context.md](./04-meta-session-context.md) | The user's framing for the meta round (LLM mechanics + the real value question) |
| [amigo-notes/product.md](./amigo-notes/product.md) | Product Amigo's full note file across Rounds 1, 2, 3 (verbatim from workbench) |
| [amigo-notes/developer.md](./amigo-notes/developer.md) | Developer Amigo's full note file (verbatim) |
| [amigo-notes/testing.md](./amigo-notes/testing.md) | Testing Amigo's full note file (verbatim) |
| [amigo-notes/scorecard.yaml](./amigo-notes/scorecard.yaml) | Scorecard output from the live smoke test — GREEN verdict on the meta session |
| [05-synthesis.md](./05-synthesis.md) | My synthesis of the three amigo notes — convergences, disagreements, user-facing questions |
| [06-scorecard-design-and-ship.md](./06-scorecard-design-and-ship.md) | The scorecard sketch, the implementation, and the live run results |
| [07-research-followup.md](./07-research-followup.md) | The user's grounded research response — Du et al., heterogeneous agents, groupthink paper — and my analysis of what it adds |
| [08-outcomes.md](./08-outcomes.md) | What was committed, what's still open, what to ship next |

## Why this archive exists

The user asked for a comprehensive record of this session because the work — thinking about the amigo process, shipping the tiered format, reflecting on it with the amigos themselves, then shipping the scorecard — felt valuable enough to be worth preserving as a reference. It's also the first session in this repo where the amigos produced meta-commentary on their own ritual, and that's a rare artefact worth keeping as a baseline for future sessions to compare against.

The amigo notes are the most load-bearing pieces here — they're a 60+KB dump of what three system-prompt personas actually produced when asked to reason honestly about their own structural limits. Everything else in this archive is framing and narration around them.
