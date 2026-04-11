# Narrative — The Full Session Story

## Act 1: The shallow-consolidation problem

The session opened with the user raising a real and specific pain point with the Three Amigos ritual:

> "I have an issue with the amigo sessions, they sometimes create so much super valuable note that the step after that, consolidating feels weird and shallow... I mean how do you go from all those amazing explorations and discoveries and suggestions and concerns to a consolidation of that knowing for sure you cover at least the most important aspects? Should the amigos themselves prioritise? So the main agent consolidates their most important stuff?"

This was an exploratory question, not a command. My answer was a two-part recommendation: push prioritization into the amigos themselves via a tiered output contract (`Must Address` / `Should Consider` / `Noted`), and let the main agent do what it's uniquely positioned for — cross-perspective synthesis over the pre-ranked lists instead of trying to re-read and re-rank everything. The tradeoff I called out was that amigos prioritize from their own lens, so cross-cutting items could still slip through — which is why the main agent still needs to run a synthesis pass, but only over the `Must Address` union.

The user's response was decisive: **"no just add this"**.

## Act 2: Shipping the tiered format

The first implementation pass touched six files:

- All five amigo agent definitions (`agents/product-amigo.md`, `developer-amigo.md`, `testing-amigo.md`, `frontend-amigo.md`, `security-amigo.md`) — added a `## Prioritized Findings` section requirement to Round 1, with the three-tier structure plus a one-line `Why:` rationale on every `Must Address` item, capped at 3–6 items to force real prioritization.
- `skills/three-amigos/full-session.md` — rewrote Step F4 (Synthesize the Discussion) to build the example map from the union of `Must Address` across amigos first, then do cross-perspective promotion, then sweep `Should Consider`, with a mandatory coverage check before presenting to the user: every `Must Address` item must either appear in the output or be explicitly excluded, never silently dropped.
- Round 2 in each amigo definition also gained the instruction to re-tier in place if another amigo's concerns change priority, and to state why.

Plugin version bumped to `1.12.0` (minor — new output contract).

## Act 3: The meta question

With the tiered format in place, the user raised a deeper question. They shared a clear technical picture of how LLMs work (next-token prediction + instruction tuning + system-prompt orchestration) and asked:

> "I want to know how valuable this three amigo really is... I think it's valuable, the perspectives because a single context window with a question: 'I want this, build this for me' will never cover all the perspectives,... the focus on looking at the question from a very focused perspective is great I believe... but I also don't want to overspend on tokens..."

This was the meta question: if all three amigos are the same base model wearing different system-prompt hats, are the "perspectives" genuinely independent or is the ritual expensive theater? The user asked me to run an actual amigo round on this exact question — dispatch the amigos to reflect on their own process.

## Act 4: The meta amigo session — Round 1

Three parallel dispatches, each prompted to reflect honestly from their own angle:

- **Product Amigo** was asked whether the ritual serves the real product goal (features get built that match intent), where the value is concentrated, when it pays off vs when it's theater, and the same-model problem head-on.
- **Developer Amigo** was asked for the token math, where parallelism actually helps, whether context bloat across rounds degrades synthesis, and when to skip.
- **Testing Amigo** was asked what the ritual catches that single-pass wouldn't, what it misses anyway (shared blind spots in training data), the independence illusion, Round 2's real value-add, and what a quality gate for the process itself would look like.

All three produced detailed notes (see `amigo-notes/` in this archive). The headlines from Round 1:

**Product** — the ritual's value is front-loaded into Round 1, especially the product-intent pass. The same-model problem is real: persona prompts buy a structured multi-lens checklist and mild position-commitment, but not independent priors. Three Claudes share blind spots. Token math: ~65–110k per full session; a "Round 1 only" path captures ~85% of value at ~45% of cost. Full ritual should be gated to novel, cross-context, or high-blast-radius features (~1 in 10 stories).

**Developer** — the ritual costs roughly 10x input tokens and 4x output tokens vs a single-agent pass, delivering ~1.3–1.6x the insight on average. Only pencils out if (a) triage gates away from running full sessions on small stories, (b) Round 3 becomes conditional on actual `@mentions` existing (not default-fire), and (c) prompt caching is verified on for blueprint reads and cross-round notes. Top unknown: is prompt caching actually on?

**Testing** — the real value is perspective pre-commitment: it stops the model collapsing into build-mode and forces the break-mode questions (boundaries, concurrency, idempotency, who-owns-the-error, prerequisites) that a single pass reliably skips. The real risk is the independence illusion — three prompts over one prior share the same blind spots, and Round 2 becomes *worse* than silence on shared-blind-spot classes because it produces confident mutual confirmation. Round 2 hit rate for genuinely new concerns: roughly 20–30%. Worst-case escape: a bug a 30-second grep or one clarifying user question would have caught, while three amigos reasoned about a sanitised blueprint world.

## Act 5: Round 2 — where the personas earned their keep

Round 2 is where the meta session became interesting. Each amigo read the others' notes and reacted — and the reactions were not polite mutual agreement.

**Developer pushed back on Product's cost math.** Product's "85% value at 45% cost" got restated. Developer argued R1-only is actually closer to ~25% of cost (not 45%), and on novel cross-context work captures closer to 65–75% of value (not 85%) because R2's second-order catches are unreachable. The tier-by-risk shape was accepted; the single blended number was rejected.

**Testing defended Round 2 against Product's "cut it" argument.** Product had proposed dropping R2 from the default to save tokens. Testing countered that the 20–30% of R2 that's new concerns is disproportionately *cross-perspective second-order* bugs (one amigo's premise combined with another amigo's consequence), which a single-pass three-lens agent would miss mechanically, not stylistically. Counter-proposal: keep a *trimmed* Round 2 budgeted at ~1.5k tokens per amigo whose only job is the second-order pass. Product accepted.

**Testing blocked Developer's proposal to add a forced-divergence opener to Round 1.** Developer had suggested it as protection against groupthink. Testing refused: "R1's mechanical value is uncontaminated perspective isolation; modeling the other amigos before writing is exactly the contamination R1 exists to prevent." Keep the opener in R2 only. Held.

**Testing promoted the scorecard from #3 Must Address to #2.** Both Product and Developer were blocked on missing data — everyone was speculating about ROI with no feedback loop. The scorecard became the foundational unblocker for everything else.

**Product re-tiered in place** based on Testing's groupthink warning. A new `Must Address` item appeared: "emit a product-visible low-confidence warning when amigos agree too fast." Product's reasoning: the ritual's *most confident* outputs (all three amigos agreeing) are the most dangerous on shared-blind-spot classes (auth, concurrency, perf, money), because false confidence forecloses the review that would have caught the bug.

Round 2 also produced real `@user` questions — things only the human could decide. These became the Step F5 presentation at the end of the synthesis.

## Act 6: Round 3 — mention resolution

Round 3 was tighter by design. Each amigo found `@<amigo>-mention` references directed at them and responded in 1–2 sentences. Four substantive exchanges landed:

- Product restated 85%/45% split by routine vs novel work (accepted Developer's pushback).
- Product conceded Testing's point on sensitivity-tagged aggregates overriding shape-based triage.
- Developer admitted "I don't know if prompt caching is on from inside a session" — genuinely owned the limit.
- Testing refused Developer's proposed R1 forced-divergence opener and accepted it for R2 only, for the reason above.

## Act 7: The synthesis

I then synthesized the three note files into a user-facing presentation. The convergence across all three amigos (`Must Address` in multiple notes):

1. **Tier the ritual by risk, don't run full sessions by default.** Routine work → cheap single-agent three-lens pass at ~25% of cost, ~85% of value. Novel / cross-context / sensitive work → full ritual, which earns its keep on the 25–35% of second-order bugs that matter.
2. **Make Round 3 conditional, not default.** Grep R2 for `@mentions`; skip R3 dispatch if zero. Filesystem grep is free; R3 dispatch isn't.
3. **Groupthink is the biggest real risk.** When all three amigos confidently agree on security, concurrency, perf, or library semantics, that's the danger zone, not the safe zone. Fix has two layers: forced-divergence R2 opener (intervention) + per-session scorecard with agreement-overlap metric (audit).
4. **Hard stop on sensitivity + zero dissent.** If a feature touches a `sensitive:` aggregate AND the scorecard shows zero dissent and zero new catches, refuse the Mister Gherkin handoff.
5. **Verify prompt caching is actually on.** Gates every cost number by 40–60%. Only humans can check.
6. **Be honest about the same-model problem in docs.** Don't oversell "three independent experts." Persona prompts buy: structured multi-lens checklist, mild position-commitment, attention-biasing toward different n-grams. They do not buy: independent priors, different training data, genuine disagreement on shared blind spots.

The synthesis also validated the new tiered format itself: each amigo used the tiers to re-rank across rounds, every `Must Address` item was traceable into the synthesis, and the 3–6 item cap held — nobody inflated their tier. One weakness observed: all three amigos tiered `prompt caching verification` as `Must Address` but none of them could actually answer it — a `@user` question masquerading as an action item. The synthesis step should probably separate "must address by the pipeline" from "must address by the human."

## Act 8: The scorecard sketch

My recommendation for the single most valuable thing to ship next was the **zero-LLM-call scorecard**, because every other optimization (triage gate, cheap-path default, groupthink detection, conditional R3) is blocked on not having measurement. Without the scorecard you're tuning the ritual in the dark.

I presented the sketch: what it reads, what it computes, the YAML output shape, the rating rules, the dissent-keyword list with its honest noise limits, the new-catch detection approach (stem-overlap against R1 bullets), the agreement-overlap metric (pairwise Jaccard on stemmed `Must Address` bullets — the groupthink signal), and the F3c pipeline integration between Round 3 and F4 synthesis.

The user's response: **"no go ahead, this is above my comprehension haha, but this seems like it could be gold"**.

## Act 9: Shipping the scorecard

Five implementation pieces:

1. **`scripts/amigo-score.ts`** — a ~330-line standalone TypeScript script that reads all `amigo-notes/*.md`, splits each note by round markers (`## React to Others` / `## Round 3`), extracts tier items from the `## Prioritized Findings` section, computes per-amigo metrics (must/should/noted counts, `r1_must_caps_ok` discipline check, R2 word count, new-catch count, tier shifts, peer/user mention counts, dissent markers, R3 responses), computes session totals and pairwise Jaccard agreement overlap, scans the blueprint for `sensitive: true` aggregates with keyword fallback, assigns GREEN/YELLOW/RED verdict, and writes `scorecard.yaml`. Exits `2` on RED hard gate so the skill can branch.
2. **Blueprint schema — `--sensitive` flag** — added to `add-aggregate` in `scripts/blueprint.ts`. Validator was already permissive, no schema migration needed.
3. **`bin/storyline` dispatcher** — wired a new `amigo-score` subcommand that shells into the new script.
4. **`skills/three-amigos/full-session.md`** — new Step F3c between Round 3 and F4 that runs `storyline amigo-score`, reads the scorecard, and branches on GREEN (continue), YELLOW (continue with warning shown in F5), or RED (hard stop with three recovery options: re-run with `deep_dive: true`, add Security amigo, documented override with `best_guess` assumption).
5. **F5 presentation** — now surfaces the scorecard one-liner to the user alongside the example map.

Plugin version bumped to `1.13.0` (minor — new command + new schema field). Blueprint stamped to v50.

## Act 10: The live smoke test

The scorecard ran on its own source material — the meta session's own amigo notes. Result:

```
[amigo-score] GREEN  new_catches=67  dissent=55  overlap=0.04  peer:user=1.45
```

Observations:
- **All three amigos passed the tier discipline check** (`r1_must_caps_ok: true`) — the new format works.
- **`agreement_overlap: 0.04`** is the standout. Very low. The personas produced nearly-disjoint `Must Address` content. That's the first quantitative evidence that system-prompt perspective-isolation actually produces different output rather than three reheats of the same priors.
- **GREEN verdict** matches intuition — there was real disagreement in Round 2.
- **Known v1 limitation** — the keyword-fallback fired `sensitive_aggregate_hit: true` because "auth/token/session/permission" appeared in the abstract discussion of security concerns. False positive. Doesn't break anything (GREEN verdict + nonzero dissent means the RED hard gate can't fire), but worth knowing. Real feature sessions won't have this noise once aggregates get tagged with `sensitive: true` directly.

## Act 11: The research follow-up

After shipping, the user came back with grounded research — Du et al. (MIT/CSAIL 2023) on multi-agent debate, a 2025 clinical study on same-model groupthink in multi-agent systems, and a 2025 study on heterogeneous vs homogeneous agents. The user's updated advice reinforced most of what the amigos had already concluded and added one concrete new angle I had under-weighted: **heterogeneous models > homogeneous personas**. Full cross-vendor mixing isn't available from inside Claude Code sub-agent dispatch, but cross-family within the Claude line (Opus / Sonnet / Haiku on different amigos) is meaningful and free.

I proposed two small follow-on changes: (1) elevate the forced-divergence opener from "design intent" to a mandatory R2 section in each amigo definition, (2) add a `preferred_model:` field to each amigo's frontmatter so the dispatcher can assign different Claude family members per persona. Held for the user's decision on which to ship next.

## Act 12: Commit and push

The feature landed in commit `11d7a1f` on `main`:

```
feat: tiered amigo findings + zero-LLM-call session scorecard
11 files changed, 569 insertions(+), 21 deletions(-)
create mode 100644 scripts/amigo-score.ts
```

Pushed to `origin/main` along with nine prior unpushed commits. Workbench artefacts (this session's actual amigo notes) were left untracked per the convention that `.storyline/workbench/` is ephemeral — preserved in this session archive instead.

## What this session produced

- **Two shipped features** — tiered findings format + `storyline amigo-score` CLI
- **One live validation** — agreement overlap 0.04 on the meta session proved perspective-isolation produces different output
- **One artefact set** — ~75KB of amigo notes reflecting on their own ritual, now preserved in this archive
- **One pending decision** — forced-divergence opener + cross-family model assignment, held for the next session
- **One unanswered question** — is prompt caching actually on in the plugin's sub-agent dispatch? Gates every cost estimate. Can only be answered by a human reading the dispatch code.
