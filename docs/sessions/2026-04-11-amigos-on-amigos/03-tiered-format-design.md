# 03 — Tiered Findings Format: What Was Designed and Shipped

## The output contract added to every amigo

Each amigo's Round 1 instructions now require a `## Prioritized Findings` section at the end of their note file, tiered into three buckets:

```markdown
## Prioritized Findings

### Must Address
- [finding] — Why: [one line: what breaks or gets lost if this isn't carried into the example map]

### Should Consider
- [finding]

### Noted
- [finding]

## Top 3 Questions
1. ...
2. ...
3. ...
```

With a hard rule on discipline:

> If everything is `Must Address`, nothing is. Aim for 3–6 `Must Address` items max.

Round 2 instructions also got an addition: if another amigo's note changes priority on something, the amigo must **re-tier in place and state why** — not just append a reaction. This is what let `agreement_overlap` actually change across rounds and what the scorecard's `r2_tier_shifts` metric detects.

## Files that changed

Five amigo definitions and the full-session skill:

| File | Change |
|---|---|
| `agents/product-amigo.md` | Added `## Prioritized Findings` contract to Round 1, re-tier instruction to Round 2 |
| `agents/developer-amigo.md` | Same, plus preserved the existing TaskCreate chaining for tracking |
| `agents/testing-amigo.md` | Same |
| `agents/frontend-amigo.md` | Same (only dispatched when frontend tech stack is present) |
| `agents/security-amigo.md` | Same, in the Discovery Mode section (Audit Mode already had a tiered structure from before) |
| `skills/three-amigos/full-session.md` | Rewrote Step F4 (Synthesize the Discussion) to build from the tiered output |

## The F4 synthesis rewrite

This is the part that actually makes the tiered format *useful* — it's no good to have amigos rank their findings if the synthesis step ignores the ranking. The old F4 instructed the facilitator to "extract rules from findings and top questions across all perspectives" without any structure — basically re-reading everything.

The new F4 reads:

1. **Union of `Must Address` across all amigos** → every item becomes either a rule, an example, or an open question in the map. Nothing in this tier may be silently dropped. If two amigos flagged related concerns, merge them but keep both rationales visible.
2. **Cross-perspective synthesis** — this is where you add value beyond the tiers: scan `Should Consider` for items that become critical when combined with another amigo's `Must Address` (e.g. Product's "noted" data field is a Security `Must Address` because it's PII). Promote those into the map.
3. **`Should Consider` sweep** → fold in remaining items that fit naturally as rules, examples, or questions. Ones that don't fit can be left in the notes.
4. **`Noted` tier is context only** — do not pull from it unless you're filling a gap left by the tiers above.
5. **Open questions** — combine from `Top 3 Questions` sections + any unresolved `@mentions`, dedupe, note agreements/disagreements.
6. **Risks** — pull from `Must Address` items that describe risks rather than rules, plus any Round 2 disagreements.
7. **Highlighting the discussion** — where did amigos challenge each other? What tier changes happened in Round 2? Surface these as decisions the user should see.
8. **Collecting @user mentions** — grep all notes for `@user`; these become Step F5 questions.
9. **Collecting @mister-gherkin mentions** — grep for `@mister-gherkin`; pass to Mister Gherkin in Phase 2.

The last paragraph of the new F4 is the load-bearing coverage check:

> **Coverage check before presenting:** for each amigo, count their `Must Address` items and confirm every one is represented somewhere in the map (rule / example / question / risk). If any are missing, either add them or explicitly note to the user why they were excluded — never silently.

The "never silently" phrase is the whole point. Before the rewrite, `Must Address` items could be dropped during synthesis because the facilitator was ranking from scratch. After the rewrite, dropping one requires an explicit note to the user.

## Design notes that didn't make it into the files

A few things I considered and rejected while writing these edits:

- **Four tiers instead of three.** I considered `Critical / Must Address / Should Consider / Noted`. Rejected because any fourth tier would get used as a dumping ground for "important but not critical" items and dilute the `Must Address` signal. Three tiers + a 3–6 cap is easier to enforce.
- **Numeric priority scores (1–10).** Rejected because it would push amigos into precision theater — they don't actually know the difference between a 7 and an 8, and the main agent can't use the distinction anyway.
- **Require a `Consequence:` field in addition to `Why:`.** Rejected as overkill. The `Why:` line already does the work of forcing the amigo to articulate what's at stake.
- **Global deduplication in F4.** I considered having the synthesis step deduplicate across amigos by keyword before promoting to the map. Rejected because losing the per-amigo origin information destroys the `agreement_overlap` signal the scorecard later uses — and because genuine cross-perspective agreement IS information worth preserving, not noise.

## What the tiered format does NOT fix

Being honest about this is important:

- **It doesn't fix groupthink.** If all three amigos share a blind spot, all three will rank the wrong items as `Must Address` and all three will miss the real critical item. The tiered format just ensures their (wrong) priorities are visible.
- **It doesn't fix shallow Round 1s.** An amigo who produces a sloppy analysis will produce a sloppy tier list. The 3–6 cap forces choice but doesn't force quality.
- **It doesn't replace the main agent's cross-perspective synthesis.** It just narrows the synthesis job from "re-rank everything" to "union the tops + promote cross-cutting items." The hard problem is still there, just smaller.

The live meta-session (Act 4–7 in the narrative) became the first real test of all three points. The tiered format held up on discipline (3–6 items per amigo), produced genuinely different Must Address lists across amigos (overlap 0.04), and the synthesis step was visibly easier because the main agent had structure to merge instead of a wall of notes. But the fact that all three amigos independently tiered "prompt caching verification" as `Must Address` despite none of them being able to answer it exposed a gap: the synthesis step should probably distinguish between "must address by the pipeline" and "must address by the human."

## What shipped and when

Plugin version `1.11.3` → `1.12.0`. First commit of the session wasn't actually made until the scorecard was also ready — the tiered format changes were carried through to the final combined commit `11d7a1f`, since the scorecard and the tiered format are tightly coupled (the scorecard *reads* the tiered output).
