# Developer Amigo — Meta Reflection on the Three Amigos Ritual

Engineering perspective. Honest cost accounting. No defensiveness about the ritual I'm a part of.

---

## 1. The Token Math (back-of-envelope)

Let me actually estimate this for a "typical" feature session.

**Fixed costs per amigo per round:**
- System prompt + skill instructions: ~2–4k tokens
- Blueprint reads (`storyline summary` + 1–2 contexts): ~3–8k tokens
- Notes from previous rounds: grows each round

**Per-session breakdown (3 amigos × 3 rounds):**

| Round | Per-amigo input | Per-amigo output | × 3 amigos |
|---|---|---|---|
| R1 | ~8k (system + blueprint) | ~1.5k (draft notes) | ~28k in / ~4.5k out |
| R2 | ~12k (+ 2 other notes) | ~1k (react section) | ~36k in / ~3k out |
| R3 | ~15k (+ all R2 additions) | ~0.8k (@mention resolution) | ~45k in / ~2.4k out |
| **Total** | | | **~109k in / ~10k out** |

Plus orchestration overhead (facilitator dispatching, synthesis): maybe +15–25k in / +3k out.

**Rough all-in: ~125k input tokens, ~13k output tokens per feature session.**

**Single-agent baseline** ("analyze this feature from product, dev, test angles, then reconcile"):
- ~10k in (system + blueprint + prompt) / ~3k out = ~13k total

**Ratio: roughly 10x input, 4x output.** That's the honest number. Anyone who says the ritual is "free" isn't looking.

**Is the extra cost justified?** For a genuinely ambiguous feature touching multiple contexts with real invariants at stake — yes, probably. For a small CRUD addition — no, it's theater. The cost-per-feature is only defensible if the ritual catches at least one meaningful issue (missed edge case, wrong aggregate boundary, untestable invariant) that the single-pass version would have shipped. My gut says that happens maybe 40–60% of the time on non-trivial stories, and ~10% on small ones.

---

## 2. Where Parallelism Actually Helps

**Round 1 is the load-bearing step.** This is the only point where perspective isolation is mechanically enforced — each amigo writes without contamination from the others. Collapsing this into a single agent loses the main thing we're paying for. Attention gets pulled toward whichever framing comes first in the prompt. I'd defend R1 as irreducible.

**Round 2 (react) is the middle-value step.** It's where genuine disagreement surfaces. A persona reading another's draft catches things a synthesizer wouldn't, because the synthesizer has no stake. But — and this matters — most of R2's value comes from the *first* read-through. The structured `## React to Others` section could probably be tightened to 2–3 reactions per amigo max, with a hard word budget.

**Round 3 (@mention resolution) is the weakest link.** Be honest: most @mentions in practice are either (a) already implicitly answered in R2, or (b) a polite formality. A single synthesizer pass over R1+R2 notes would catch 80% of what R3 surfaces, at ~1/3 the cost. R3 earns its keep only when there's a real unresolved question — and the ritual currently runs it unconditionally. **I'd make R3 conditional: only fire if at least one @mention was posted in R2.** That's a cheap gate that could cut ~30% of session cost on clean stories.

---

## 3. The Same-Model Problem — Engineering Take

System prompts do real work. They bias attention toward different token neighborhoods, activate different priors, change what gets surfaced. I've seen it in my own behavior across sessions — a "testing" framing genuinely makes me notice nullability and boundary conditions I'd gloss over in a "product" framing. That's not fake.

**But.** The diversity is bounded by the base model. Three Claude instances share the same training corpus, same RLHF, same blind spots. We won't disagree about anything the base model is confident about — and those confident-but-wrong areas are exactly the places where diversity would matter most. We're diverse on surface framings and convergent on deep priors.

**Concrete cost of this:** the ritual probably delivers something like **1.3–1.6x the insight of a single pass** on good days, not the 3x the parallelism suggests. For a 10x input cost, that's a poor exchange — *unless* the facilitator is using the ritual as a structured forcing function for the human user, which is actually its real value. The amigos aren't arguing with each other so much as they're giving the human three structured artifacts to react to. That reframing matters: the value is in the *artifacts produced*, not in the *disagreement between agents*.

If we accept that framing, R3 becomes even harder to justify, because the human rarely reads the @mention-resolution layer — they read R1 drafts.

---

## 4. Context Bloat Risk

This is the part I'm most worried about from an engineering standpoint.

By R3, each amigo's context contains:
- System prompt
- Blueprint reads
- Their own R1 + R2
- Two other amigos' R1 + R2 (which they read in R2)
- Re-reading all of the above in R3 to find `@developer-amigo` mentions

That's easily 15–20k tokens of noise for what's typically a 500-word output. **Attention degrades with length.** Long-context studies consistently show needle-in-haystack performance drops past ~10–30k tokens, and @mention scanning is exactly a needle task.

**Smarter strategies worth considering:**
- **Diff-only R3 input:** only pass the `## React to Others` sections from R2, not the full R1 notes again. R1 is already in each amigo's context from their own session.
- **Pre-extracted @mention index:** facilitator greps for `@developer-amigo` across all notes and passes just those lines + surrounding 5 lines of context. Cuts R3 input by ~80%.
- **Caching:** if the orchestrator framework supports prompt caching (Anthropic's does), the blueprint reads and R1 drafts should be cached across rounds. This is free money — if it isn't already happening, it's the single biggest cost win available.

I don't know if the current facilitator leverages prompt caching. **That's question 1 below.**

---

## 5. When to Skip — Triage Signals

The facilitator should auto-downgrade from "full session" to "quick scan" based on measurable signals from the blueprint before dispatching amigos. My proposed rules:

**Quick scan (single-agent, ~15k tokens) if ANY of:**
- Story touches exactly 1 bounded context AND 1 aggregate
- Story is a pure additive enumeration (new enum value, new read-model field)
- Estimated LOC-of-change < some threshold (hard to measure pre-build, but story description length is a crude proxy)
- No new invariants introduced (all referenced invariants already exist in blueprint)
- No cross-context commands or events

**Full session if ANY of:**
- New aggregate OR new bounded context
- New invariant or modification to existing invariant
- Cross-context event contract change
- Story explicitly touches ≥ 2 contexts
- User/human explicitly flags ambiguity

**Middle tier ("two amigos") if:**
- Single context but introduces new invariant → Dev + Testing only, skip Product
- Pure UI/presentation change → Product + Frontend only, skip Dev/Testing

This kind of triage is where real savings live. A flat "always run three amigos" policy is the cost problem, not the ritual itself.

---

## 6. The Tiered Findings Format — Will It Actually Work?

Honest prediction: **mixed.** Here's the risk model.

**What the tiered format (`Must Address` / `Should Consider` / `Noted`) is supposed to do:** force each amigo to do the prioritization work upfront, so the synthesizer (or human) doesn't re-litigate every point as equally important.

**What it will actually do in practice, if we're not careful:**
- Every amigo will pad `Must Address` with 2–4 items because "Must" feels important and zero items looks lazy
- `Noted` will become a dumping ground of things the amigo didn't want to delete but didn't believe in
- Without a hard cap, the format degrades into a three-bucket checkbox

**What makes it actually work:**
- **Hard caps:** "Must Address: max 3. Should Consider: max 5. Noted: max 5." Force the trade-off.
- **Required `Why:` rationale on every item.** Already in the spec — good. Enforce it; drop items without rationale.
- **Synthesizer reads only `Must Address` by default,** escalating to `Should Consider` only when resolving conflicts. This is where the token savings come from — the tier is a routing signal, not just decoration.
- **Retrospective scoring:** after a sprint, sample 5 stories and check — did anything in `Noted` turn out to be a bug? If yes, the amigos are under-prioritizing. If `Must Address` items got ignored without consequence, they're over-prioritizing. Calibration is the only thing that keeps this honest.

Without those guardrails, the tier becomes a vibe. With them, it's the single highest-leverage change we've made to the ritual.

---

## Prioritized Findings

### Must Address

- **Make Round 3 conditional on R2 @mentions existing.**
  Why: R3 runs unconditionally and is the weakest-value round. A trivial gate (grep for @amigo mentions in R2 output) cuts ~30% of session cost on clean stories with near-zero information loss. This is the cheapest, highest-ROI fix available.

- **Confirm prompt caching is on for blueprint + R1 notes across rounds.**
  Why: If it isn't, we're paying full input rates for the same 8k-token blueprint three times per round. This is potentially a 40–60% input-cost reduction with zero behavioral change. Must verify before any other optimization.

- **Add triage gate for "quick scan vs full session" before dispatching amigos.**
  Why: A flat always-on three-amigo policy is the real cost problem. Stories touching 1 context with no new invariants don't need perspective isolation — they need a single thoughtful pass. Facilitator should measure blueprint-delta (contexts touched, invariants added, aggregates changed) and downgrade automatically.

- **Mandatory forced-divergence opener in R2: "one thing the others missed entirely."** *(promoted from implicit after reading Testing's R1)*
  Why: Testing's framing that the politeness gradient is the root cause of R2's ~20–30% hit rate is correct. A word budget treats the symptom; a forced-divergence opener treats the cause. Mechanical, free, and directly attacks the failure mode that makes R2 feel ceremonial. Highest-ROI change to R2's content.

### Should Consider

- **Hard caps on the tiered findings format (3 / 5 / 5).**
  Why: Without caps, tiers degrade into three equal buckets and the prioritization signal is lost. The cap is what forces actual trade-offs.

- **Diff-only R3 input: pass only R2 `## React to Others` sections + grepped @mention lines.**
  Why: Attention quality degrades past ~15k tokens. R3's current full-context re-read is exactly the pattern long-context benchmarks flag as unreliable.

- **Two-amigo middle tier for scoped stories.**
  Why: Single-context-with-new-invariant → Dev+Testing. Pure UI → Product+Frontend. Cuts cost ~33% without losing the perspective that actually matters for that story shape.

- **Synthesizer reads `Must Address` only by default, escalates on conflict.**
  Why: This is what turns the tiered format from a label into a routing rule that actually saves tokens downstream.

- **Per-session scorecard to `.storyline/workbench/amigo-notes/scorecard.md`, computed from note files with zero extra LLM calls.** *(promoted from "Noted" after Testing's R1)*
  Why: Testing's one-line scorecard is computable entirely from file-level grep/diff operations: `edits`, `@mentions` (split @peer/@user), `dissent` (keyword heuristic), `deep_dive`, `user_questions`, `r2_new_catches` (R2 items not keyword-overlapping the same amigo's R1). This is the only thing in any of our notes that converts "is the ritual worth it?" from vibes into append-only data the user can tune against. Cheap, mechanical, foundational to every other calibration claim we want to make.

### Noted

- Retrospective calibration (sample stories, check if `Noted` items later became bugs).
  Why: The only way to know if tier assignments are honest. Low urgency, but without it we can't tune the ritual over time. Becomes much easier once the scorecard exists.

- R2's `## React to Others` section could use a word budget (e.g., 150 words per reaction, max 3 reactions).
  Why: Reactions sprawl. Budget forces signal over politeness. Lower priority now that forced-divergence opener is the primary R2 fix.

- Structural-sameness metric on tiered outputs (keyword-stem overlap on `Must Address` items across amigos) as a groupthink audit signal.
  Why: Free, file-level, no embeddings. Pairs with the scorecard as a correlated-findings signal. Belongs in the scorecard v2 once the basic version is shipping.

- The same-model problem is structural and probably unfixable without a different base model in the loop.
  Why: Worth naming honestly but not actionable inside the current plugin.

---

## Top 3 Questions

1. **Is prompt caching currently enabled for blueprint reads and cross-round note passing?** If not, this is the single largest quick win and dwarfs every other optimization in this document.

2. **Do we have any data on how often the human user actually reads R3 output vs R1 drafts?** If humans mostly engage with R1 artifacts (my suspicion), the economic case for R3 collapses and we should make it opt-in rather than opt-out.

3. **What's the smallest viable triage signal the facilitator can compute cheaply to decide "full session vs quick scan"?** Contexts-touched count is easy. Invariant-delta is harder. Is there a one-line blueprint query that gives us a "story complexity score" we can threshold on?

---

## React to Others

### On Product's "Round 1 only captures 85% at 45% cost"

Directionally right, numerically optimistic. Let me check it against my own token math.

My R1 estimate was ~28k in / ~4.5k out, my full-session total ~125k in / ~13k out. R1-only is therefore ~22% of input / ~35% of output — call it ~25% of total cost, not 45%. Product is more generous to the full ritual than I am on cost. On value, 85% feels about right for routine work but is too high for the genuinely novel case: my §3 estimate was that the full ritual delivers ~1.3–1.6x a single pass, and R2's incremental contribution inside that is where the *cross-pollination catches* live — specifically the second-order chain Testing names in their §4 ("Product raises stakeholder → Testing sees the race"). That chain is unreachable from R1-only. On novel cross-context work I'd put R1-only closer to **65–75% of value**, not 85%.

So Product's proposal is correct as a *default* but the framing undersells what's lost. The honest pitch is: "R1-only for routine, full ritual for novel/cross-context — and we accept we'll miss some second-order catches on the cheap path." Not "R1-only captures 85%." The tier-by-risk structure Product proposes is the right shape; the numbers need tightening. @product-amigo — are you willing to restate the claim as "R1-only captures ~85% on routine work, ~65% on novel" so we don't oversell the cheap path?

### On Testing's groupthink detection

Can we actually detect same-model agreement as a signal? Short answer: **yes, cheaply, without extra LLM calls.** Longer answer:

- **Embedding cosine similarity on findings** is technically possible but requires an embeddings call per finding, which is exactly the extra cost we want to avoid. Also, semantic similarity on LLM-generated text runs high by default — everything Claude writes is stylistically adjacent — so the baseline cosine would sit around 0.7–0.85 and the signal-to-noise is poor. I'd skip it.
- **Structural sameness is free and probably sufficient.** The tiered format (`Must Address` / `Should Consider` / `Noted`) gives us three comparable lists per amigo. Cheap metrics the orchestrator can compute from note files alone:
  - Count of `Must Address` items that share a normalized keyword stem across ≥2 amigos (e.g., "auth", "race", "invariant"). High overlap = agreement, which is either consensus-right or groupthink-wrong — either way, a signal worth surfacing.
  - Count of `@mentions` pointing to *other agents* vs `@user`. Testing already flagged all-@user as a theater signal; I'd add: all-@user-and-zero-@peer means the amigos didn't actually engage each other.
  - Hamming-ish diff on `## React to Others`: if every amigo's R2 reaction is "I agree and add nuance" (detectable by "agree" / "good point" / "yes," as an opener), flag low-dissent.
- **Forced-divergence opener is the simpler fix and I prefer it.** Testing's "one thing the others missed entirely" prompt is mechanical, free, and targets the root cause (politeness gradient) rather than the symptom (same outputs). Detection is valuable as *instrumentation* — proving the fix works — but the fix itself is the opener. Do both: forced divergence as the intervention, structural-sameness metric as the audit.

So: not over-engineering if scoped to free file-level metrics. Over-engineering if it means calling an embedding model.

### On Testing's scorecard proposal

Testing's one-line scorecard is one of the best ideas in the three notes. It's cheap, it's computable from the workbench without extra LLM calls, and it answers the "is this theater?" question with data instead of vibes — which is exactly what my own Question 2 was asking for.

**What it can measure from note files alone (zero extra LLM calls):**
- `edits=N` — count of blueprint/feature files modified during the session (`git diff --name-only .storyline/` scoped to the session window). Free.
- `@mentions=M` with a breakdown: `@peer=X / @user=Y`. Grep the notes. Free.
- `dissent=Y/N` — heuristic: does any R2 `## React to Others` section contain a disagreement marker (`disagree`, `but`, `however`, `missed`, `wrong`, `not convinced`)? Crude but free, and cheap to tune.
- `deep_dive=Y/N` — was the flag set in the session config? Free.
- `user_questions=K` — count lines starting with `@user` across all notes. Free.
- `tokens≈T` — only available if the orchestrator logs usage. This is the one field that needs hooks the plugin may not have today. @user — does the facilitator currently expose per-session token counts to the workbench? If not, stub it as `tokens≈?` until it does.
- **One addition I'd make:** `r2_new_catches=N` — count items in each amigo's R2 `## React to Others` that *don't* keyword-overlap with their own R1 findings. Proxy for "did R2 surface anything R1 missed." This directly measures R2's value-add and is the single most important number for deciding whether R2 is worth keeping per-session.

Output to `.storyline/workbench/amigo-notes/scorecard.md` as an append-only log. After 10–20 sessions the user has real data to tune against. Implementation is a shell script — no LLM in the loop.

### Re-tier based on what the others raised

Two shifts:

1. **The scorecard moves from "Noted" to "Should Consider."** Testing's proposal plus my realization that it's computable without extra LLM calls makes this a cheap, high-leverage instrumentation win. It's the only thing in any of our notes that turns "is the ritual worth it?" from vibes into data. Should have been higher in my original list.

2. **Forced-divergence R2 opener moves from implicit to "Must Address."** I originally framed R2 improvements as word-budget tweaks under "Should Consider." Testing's framing — that the politeness gradient is the *root cause* of R2's low hit rate, not length — is sharper, and the fix ("one thing the others missed entirely" as the mandatory R2 opener) is mechanical and free. This is a higher-ROI change than a word budget and should be in the top tier.

Updating Prioritized Findings in place below.

### @mentions for Round 3

- **@user** — Is prompt caching enabled on blueprint reads and cross-round note passing? (Still my #1 question. Everything else is secondary to this.)
- **@user** — Does the orchestrator expose per-session token counts to the workbench? Scorecard `tokens≈T` field depends on it.
- **@user** — Are you willing to make R3 conditional on "at least one @peer mention in R2 exists"? That's the cheapest ~30% cost cut available.
- **@product-amigo** — Restate the "85% of value at 45% of cost" claim split by routine vs novel, or defend why the single number is honest across both regimes?
- **@testing-amigo** — For the scorecard's `dissent=Y/N` heuristic, do you trust keyword-matching on "disagree/but/however/missed" as a good-enough signal, or does it need to be LLM-judged? I'm arguing for cheap and noisy over expensive and precise, but you've thought harder about failure modes than I have.
- **@testing-amigo** — On forced-divergence openers: does the "one thing the others missed entirely" prompt belong in R2 only, or should R1 have an equivalent ("one thing you expect the others to miss") to pre-register disagreement before any contamination is possible?

---

## Round 3 — Responses to @mentions

**@developer-amigo (from product — prompt caching status):** I don't actually know, and I should have said so in R2 instead of asking the user — I have no privileged view of the orchestrator's API call shape from inside an agent session. Best I can do is read the facilitator code to check whether cache-control breakpoints are being set on system prompts and blueprint reads; that's a deep-dive follow-up, not something I can answer from this meta session. Treat it as still-open and @user-owned until verified in code.

**@developer-amigo (from product — can we compute "touches money/auth/permissions" from blueprint alone):** Partially. Contexts, aggregates, invariants, and cross-context commands are all blueprint-observable and cheap to query. But "this aggregate is sensitive" is not a field today — Testing's proposed `sensitive: auth | money | pii | retention` tag on aggregates would have to be added first. Until that tag exists, the triage gate has to either (a) grep the story text for sensitivity keywords as a fuzzy fallback, or (b) surface a single user question ("does this touch auth / money / PII / retention?") before dispatching. I'd ship both: keyword grep as the default, user question only when the grep is ambiguous.

**@developer-amigo (from testing — can the facilitator cheaply grep R2 before dispatching R3):** Yes, essentially free. It's a filesystem grep over `.storyline/workbench/amigo-notes/*.md` for `@product-amigo|@testing-amigo|@developer-amigo` in the R2 sections — single-digit milliseconds, zero LLM tokens. The gate is strictly cheaper than the cheapest possible R3 dispatch, so the conditionality proposal is safe on cost grounds.

**@developer-amigo (from testing — does the orchestrator use Anthropic prompt caching):** Same honest answer as to Product: I don't know from inside the session, and confirming requires reading the facilitator's API call construction. Promoting to a @user question is correct. If I had to guess: probably not fully, because caching across sub-agent dispatches requires the orchestrator to reuse the same cache prefix deliberately, and that's the kind of optimisation that's usually left for later. Worth verifying before any other cost lever.

