# 08 — Outcomes

## What was committed

**Commit `11d7a1f` on `main`:** `feat: tiered amigo findings + zero-LLM-call session scorecard`

```
 .claude-plugin/plugin.json          |   2 +-
 .storyline/blueprint.yaml           |   4 +-
 agents/developer-amigo.md           |  40 +++-
 agents/frontend-amigo.md            |  29 ++-
 agents/product-amigo.md             |  30 ++-
 agents/security-amigo.md            |  22 ++
 agents/testing-amigo.md             |  40 +++-
 bin/storyline                       |   6 +
 scripts/amigo-score.ts              | 379 ++++++++++++++++++++++++++++
 scripts/blueprint.ts                |  12 +-
 skills/three-amigos/full-session.md |  46 +++-
 11 files changed, 569 insertions(+), 21 deletions(-)
 create mode 100644 scripts/amigo-score.ts
```

Pushed to `origin/main` along with nine prior commits that were already ahead of the remote.

## Plugin version history for this session

| Version | Change |
|---|---|
| `1.11.3` | State at session start |
| `1.12.0` | Tiered findings format (part of the final combined commit — version bumped mid-session, committed at the end) |
| `1.13.0` | `+ storyline amigo-score` CLI and `--sensitive` aggregate flag — final state |

Blueprint meta version bumped 49 → 50 via `storyline stamp`.

## What's actually shipping to users

Users running `/plugin upgrade` will get:

### New CLI command
```
storyline amigo-score
```

Reads the current `.storyline/workbench/amigo-notes/*.md`, writes `scorecard.yaml`, prints a one-line verdict, exits `0` on GREEN/YELLOW, `2` on RED hard gate.

### New blueprint flag
```
storyline add-aggregate --context X --name Y --sensitive
```

Tags the aggregate as touching sensitive data (auth, PII, money, permissions). The scorecard uses this to decide whether to apply the RED hard gate.

### New tiered amigo output contract

Every Three Amigos session now produces amigo notes ending with `## Prioritized Findings` in three tiers (`Must Address` / `Should Consider` / `Noted`), each `Must Address` item carrying a `Why:` rationale, capped at 3–6 items per amigo.

### New synthesis behavior

Step F4 of the full-session skill now builds the example map from the union of `Must Address` items across amigos first, then does cross-perspective promotion, then sweeps `Should Consider`. The coverage check ensures no `Must Address` item is silently dropped — either it appears in the output or the user is explicitly told why it was excluded.

### New pipeline gate

Step F3c runs the scorecard between Round 3 and F4 synthesis. A RED verdict refuses handoff to Mister Gherkin with three recovery options: re-run with `deep_dive: true`, add a Security amigo, or documented override.

## Live metric baseline

The first real run of the scorecard (on this session's own meta reflection) produced:

```
GREEN  new_catches=67  dissent=55  overlap=0.04  peer:user=1.45
```

This is the first baseline data point. Future sessions can compare against these numbers to see if agreement overlap trends up (groupthink drift), new catches trend down (amigo fatigue), or dissent trends toward zero (convergence collapse).

Most importantly: **`agreement_overlap: 0.04`** is the number to beat. It's the live measurement that the personas can produce nearly-disjoint `Must Address` content when given a question they have genuinely different angles on. If this number drifts toward 1.0 in future sessions, that's the signal that either (a) the system prompts are converging, (b) the feature under discussion has no genuine cross-perspective tension, or (c) the meta session was a lucky outlier. Either way, it's measurable now, and before this session it wasn't.

## What's open

### Proposed but not shipped

1. **Forced-divergence opener as a mandatory R2 section.** Research-backed (2025 clinical groupthink study), cheap to implement (~5 minutes), directly targets the R2 convergence failure mode. Currently the divergence opener exists as design intent in the synthesis step but is NOT wired into the individual amigo Round 2 instructions as a required section.

2. **Cross-family amigo model assignment via `preferred_model:` frontmatter field.** Research-backed (heterogeneous agents outperform homogeneous), moderate implementation cost (~15 minutes + verification that the frontmatter actually works across sub-agent dispatch). Proposed shape: Product on Sonnet, Developer on Opus, Testing on Sonnet. Scorecard's `agreement_overlap` metric will empirically validate whether it helps.

3. **Triage gate — automatic cheap-path selection for routine work.** The highest-value unbuilt piece from the meta session synthesis. Requires defining the blueprint-observable complexity signals (contexts-touched count, invariant delta, aggregate count, `sensitive:` tag presence) and wiring a decision branch into Step F1b or a new Step F0 in `full-session.md`. Non-trivial — maybe 45 minutes of skill editing plus a careful definition of the thresholds.

4. **Honest user-facing docs about the same-model problem.** Not yet written. The amigos and the research both agree this is load-bearing for building user trust.

### Unanswered questions

1. **Is prompt caching actually on for sub-agent dispatches?** Gates every cost estimate by 40–60%. Only humans can check. Requires reading either Claude Code sub-agent dispatch internals or the plugin's agent invocation path.

2. **Is there post-ship bug attribution back to amigo sessions?** If no, the scorecard is the first real feedback loop and there's no way to calibrate whether the GREEN/YELLOW/RED thresholds are in the right place.

3. **Acceptable to gate Mister Gherkin handoff on `sensitive aggregate + zero dissent`?** The RED hard gate is already shipping and will fire on this condition — implicitly the answer is "yes, try it" — but this is the first real user-facing friction point the ritual will ever produce, and user feedback on the first RED firing will determine whether the threshold stays where it is.

4. **Acceptable to default routine work to a cheap single-agent three-lens path?** Saves ~75% of tokens on the common case per the amigos' estimates. Requires explicit user approval to ship as the new default — currently full session is still the default.

### Known v1 limitations of what shipped

- **Keyword-fallback sensitivity detection** will false-positive on meta/abstract discussions that mention security concepts. Doesn't break anything (the RED gate needs zero dissent AND zero new catches AND sensitivity to fire), but worth knowing. Fixed once real features tag aggregates with `sensitive: true`.
- **Dissent keyword list includes `but\b`** which is noisy. Acceptable for v1 because the hard gate fires on `dissent == 0` where noise pushes away from firing.
- **Jaccard threshold of 0.7** for groupthink detection is a guess. Needs calibration data from real sessions.
- **No historical trending.** Scorecards are written to `.storyline/workbench/` which is ephemeral. To preserve trends, scorecards would need to be archived to `.storyline/sessions/<id>/scorecard.yaml` on session completion — not yet wired.
- **`prompt_caching_verified: unknown`** is always emitted because there's no way to check from inside a sub-agent.

## How to use what shipped

For the user or anyone running the pipeline tomorrow:

1. Run a Three Amigos session normally (`/storyline:three-amigos <feature description>`).
2. When the session reaches Step F3c, the facilitator will automatically run `storyline amigo-score`.
3. GREEN → continue normally, scorecard summary appears in the F5 presentation.
4. YELLOW → continue normally, scorecard reasons appear in the F5 presentation so you can see what was weak.
5. RED → hard stop. You'll be presented with the scorecard and three recovery options. Pick one.
6. After any session, you can manually run `storyline amigo-score` to see the scorecard for the current session's notes.
7. To tag an aggregate as sensitive (for the RED gate to fire correctly on future sessions), run `storyline add-aggregate --context X --name Y --sensitive` or manually add `sensitive: true` to an existing aggregate in `blueprint.yaml`.

## The single most important outcome

Before this session, the Three Amigos ritual had no feedback loop. It was impossible to tell whether a given session had earned its tokens or had been theater, and the only way to calibrate was intuition. After this session, every amigo session produces a deterministic scorecard with an `agreement_overlap` number that measures whether the personas actually produced different output, a `new_catches` number that measures whether Round 2 was productive, and a dissent count that measures whether the amigos engaged or mutually confirmed. The thresholds for GREEN/YELLOW/RED are still guesses. But the measurement exists now, and it didn't before. Everything else — triage gates, cross-family model assignment, forced-divergence openers, honest docs — becomes data-driven from this point forward.
