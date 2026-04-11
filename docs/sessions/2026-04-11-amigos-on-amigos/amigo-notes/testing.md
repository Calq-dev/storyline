# Testing Amigo — Meta Reflection on the Three Amigos Ritual

Written fresh, Round 1, without reading the other amigos.

---

## 1. What the ritual actually catches

The forcing function of **perspective isolation** is real, and it catches things a single-pass "build this for me" prompt reliably misses. Concrete failure modes I've seen the ritual surface:

- **Implicit-success assumptions.** A single-pass agent writes the happy path, then invents one or two "obvious" sad paths (empty input, null). The Testing lens, forced to ask "what are the boundary values and failure modes of every verb in every scenario," surfaces things like: concurrent edits, partial writes, idempotency on retry, clock skew, ordering under race, and "what happens if this succeeds but the confirmation is lost." A single-pass prompt almost never generates those because the model is in build-mode, not break-mode.
- **Scope drift disguised as completeness.** Product's lens catches "you're solving a bigger problem than the user asked for" — the single-pass model's default is to over-deliver, which hides missed-scope bugs under a pile of unrequested features. Isolating Product-Amigo catches this because their prompt forces "what did the user actually ask for."
- **Invariant violations across contexts.** Testing + blueprint forces "what invariant does this break." A single pass has no prior commitment to invariants, so it will cheerfully write code that violates them without noticing.
- **Naming/terminology drift.** When three agents each name the same concept, divergence reveals a real ambiguity in the domain. A single pass picks one name and commits — hiding the ambiguity.
- **Missing "who owns the error" questions.** Developer lens tends to locate error handling; Testing lens asks "and what does the user see, and can they recover." Single-pass commonly drops the second half.
- **Unstated dependencies on system state.** Testing asks "what must be true before this runs" — migrations, seed data, feature flags, auth context. Single-pass prompts routinely skip prerequisites.

That's the real value. It's not magic reasoning — it's **committed pre-registration of perspective** that prevents the model from collapsing into build-mode.

## 2. What it misses anyway

Shared-model blind spots survive all three passes:

- **Adversarial security thinking.** All three amigos default to cooperative framing. Unless Security-Amigo is explicitly in the crew, the model reliably under-weights things like: auth bypass via unusual verbs, TOCTOU races, privilege escalation via "admin" default states, injection through second-order channels (log -> re-parse), SSRF via user-supplied URLs, cache poisoning.
- **Performance cliffs.** N+1 queries, accidental O(n²), unbounded pagination, cold-cache assumptions. None of the three personas has a "latency budget" reflex.
- **Numerical and locale stuff.** Float precision in money, DST, timezone offsets mid-calculation, off-by-one in inclusive/exclusive ranges at scale, integer overflow in counters, Unicode normalization in identifiers.
- **"It works in dev, dies in prod" failure modes.** Container limits, file descriptor exhaustion, disk pressure, connection pool starvation, the fact that the test DB is 10 rows and prod is 10M.
- **The training-data-shaped hole.** If a bug class is underrepresented in training — e.g., specific CRDT merge anomalies, quirks of a niche library's error semantics, concurrency guarantees of a specific message broker — all three amigos will miss it identically. Three passes of the same model cannot reveal what the model doesn't know.
- **The "everyone agrees this is fine" failure.** Which is exactly groupthink. (See #3.)
- **Requirements that are wrong, not missing.** If the user's mental model has a bug, the amigos will faithfully implement the buggy mental model because all three trust the framing of the user's request. Challenging the premise is rare.

## 3. The independence illusion

This is the sharpest risk. **Three amigos are not three perspectives; they are three prompts over one prior.** When the prior has a blind spot, three isolated passes all miss it, and Round 2 produces the worst possible outcome: *confident mutual confirmation*.

How often does this happen? Guess: for well-trodden CRUD problems, maybe 10–20% of the substantive issues end up in the shared blind spot — not catastrophic. For unusual domains (concurrency, crypto, low-level systems, novel UX patterns), it's much higher — possibly the majority of the important bugs. This is exactly the regime where the ritual is most *expensive per insight*.

Things that would actually break groupthink:

- **Contradictory canned challenges.** Pre-committed "you must argue X is broken" prompts. Cheaper than a persona — it's just a forced-disagreement checklist. This is the highest-leverage fix.
- **Deep dive into code.** Forcing Testing to grep for real failure patterns in the actual repo catches things the blueprint abstracts away. This is why `deep_dive: true` exists and it should be used more.
- **An adversarial fourth persona.** A "Red Team Amigo" whose prompt is "assume the other three are wrong; find the story they're telling themselves." Expensive but high-signal when stakes are high.
- **External grounding.** Context7 lookups for real library semantics beat remembered API shapes. Underused in routine sessions.
- **Asking the user a contradiction question.** "Product-Amigo says X, Developer-Amigo says Y — which is load-bearing?" forces the human to resolve, which injects real independence.

Without one of these, Round 2 is mostly theater when stakes are high.

## 4. Round 2 value-add

Honest assessment: Round 2's hit rate for **genuinely new** concerns is maybe 20–30%. The rest is:

- Mild reframing ("Product said X; I agree and add nuance Y")
- Deferral/handoff ("good point, that's Developer's call")
- Polite co-signing
- Occasional useful `@mentions` that surface a real cross-context question

The 20–30% that *is* new is typically: one amigo notices a second-order consequence of another amigo's concern — e.g., Product raises a stakeholder, Testing realizes the stakeholder's workflow creates a race condition, and that race would not have been found in Round 1. That is real, and it is worth paying for *if* the session has non-trivial complexity. For low-complexity features, Round 2 is the most cuttable part of the ritual.

A cheap Round 2 improvement: require each amigo to begin Round 2 with "**One thing the others missed entirely**" — forces divergence before convergence. If all three write "nothing really," that's itself a signal the feature is too simple for the ritual.

## 5. The expensive scenario — worst-case escape

The bug that the current ritual fails to catch but a cheaper process *would* catch is the nightmare case. Candidates:

- **A bug that a single `grep` in the actual repo would have revealed.** E.g., an invariant assumed by the blueprint that's already violated in existing code, or a test helper that already exists and is being re-implemented. The blueprint-only default means the ritual reasons about the feature in a sanitised world that doesn't match reality. A 30-second grep beats three perspective-isolated reasoning passes here.
- **A bug the user already knows about and would have flagged if asked directly.** The ritual sometimes substitutes elaborate reasoning for a two-sentence clarifying question. "Does this need to work offline?" asked once saves 10k tokens of speculation.
- **A bug caught by running the existing test suite.** If tests already exist and would fail under the proposed change, three amigos reasoning about it is strictly worse than executing.

If any of those three escapes happen in a session, the ritual did not earn its tokens. A good heuristic: **if the session produces zero grep/run/ask-user actions and ships a bug that one of those would have caught, the ritual failed even if it "felt thorough."**

## 6. Quality gates for the ritual itself

Observable signals that distinguish "earned its tokens" from "theater":

**Earned:**
- Round 2 contains at least one "I missed this" admission across the three notes.
- At least one `@mention` produces a Round 3 response that changes a scenario, an invariant, or a test.
- The blueprint/features get concrete edits (new sad path, new invariant, renamed concept) — not just notes files.
- At least one "Top 3 Question" gets resolved by the user and changes the direction of work.
- Total scenarios/invariants added >= 1 per 5k tokens spent. (Rough, but measurable.)

**Theater:**
- Three notes that are 80% agreement and 20% polite reframing.
- No edits to blueprint/features — only notes files.
- `@mentions` all directed at `@user` (i.e., agents punted every hard question upward).
- Round 2 contains phrases like "I agree with Developer" with no dissent or extension.
- No grep, no code read, no context7 lookup, no user question — the session was entirely self-referential.
- Same issues surface in all three notes (true groupthink signal).

**Instrumentation proposal:** after each amigo session, emit a one-line scorecard to the workbench:
`amigos: edits=N, @mentions=M, dissent=Y/N, deep_dive=Y/N, user_questions=K, tokens≈T`
If `edits=0 AND dissent=N AND deep_dive=N`, flag the session as likely theater. This is cheap and would actually let the user see the ratio over time.

---

## Prioritized Findings

### Must Address
- **Groupthink blind spot on adversarial/security/perf.** `Why:` Three prompts over one model share a prior; the highest-severity classes (auth, concurrency, perf cliffs) are exactly where shared priors fail silently. The ritual must either force a contrarian step or explicitly invoke Security/Performance amigos when stakes warrant. Without this, the ritual's most confident outputs are where it's most dangerous.
- **Default-off `deep_dive` means the ritual reasons about a sanitised world.** `Why:` The expensive-escape scenario (#5) is real — the worst misses are bugs a 30-second grep would catch. Blueprint-only reasoning has a systematic gap against the actual codebase. Deep dive should be the default for Testing-Amigo whenever a feature touches existing code, not an opt-in.
- **No instrumentation distinguishing earned from theater.** `Why:` The user's question cannot be answered empirically without signal. A one-line scorecard per session (edits, dissent, deep_dive, user questions) is cheap and would give the user a real hit-rate to judge against instead of vibes.

### Should Consider
- **Round 2 forced-divergence prompt.** `Why:` Current Round 2 hit rate for new concerns is ~20–30%; a pre-committed "one thing the others missed entirely" opener breaks the politeness gradient and raises the floor. Cheap, mechanical, high expected value.
- **Skip Round 2 for low-complexity features.** `Why:` For simple CRUD additions, Round 2 is the most cuttable part. A complexity heuristic (e.g., number of invariants touched, number of sad paths, presence of concurrency) could gate whether Round 2 runs at all. Saves tokens precisely where they add least.
- **Replace speculation with a clarifying question earlier.** `Why:` The ritual sometimes burns tokens reasoning about an ambiguity a single user question would resolve. A rule like "if Round 1 produces ≥2 contradictory assumptions, halt and ask the user" would cut a class of expensive theater.
- **Context7 / real-library grounding as a default Testing step.** `Why:` Remembered API semantics are a known shared blind spot. Grounding against real docs is cheap and often surfaces behaviour the model mis-remembered identically across all three passes.

### Noted
- **Round 3 is lower-risk and mostly fine as-is.** `Why:` Responding to explicit `@mentions` is narrow and unlikely to generate theater; it either has targets or it doesn't, and the "no @mentions" short-circuit already exists.
- **Persona memory is a slow-compounding win, not a per-session win.** `Why:` It pays off over many sessions on the same project. Don't judge it on a single session's ROI; judge it on whether it catches repeat mistakes.
- **Three amigos > single pass is almost certainly true for non-trivial features.** `Why:` Even with the blind spots above, perspective-isolation + pre-commitment to invariants is a meaningful forcing function. The user's intuition ("a single context window will never cover all perspectives") matches what I'd expect from the mechanics — the question is calibration, not existence of value.

---

## Top 3 Questions

1. **What's the actual bug-escape rate?** Without a log of features shipped through the ritual vs. bugs found later, we're both guessing. Is there a retro mechanism where post-ship bugs get tagged back to the amigo session that missed them? That's the only data that settles the "worth it" question.
2. **Should `deep_dive` flip to default-on for Testing whenever the feature touches existing code?** My risk lens says yes — the biggest escape class is "blueprint-sanitised world vs. real repo." But it's a token cost the user is explicitly worried about. @user call.
3. **Would you accept a "complexity gate" that skips Round 2 for simple features?** Measurable by e.g. `<3 sad paths, 0 new invariants, 0 cross-context touches`. Would cut ritual cost on the features where Round 2 is most theatrical, and concentrate spend where it actually finds things.

---

## React to Others

### On Product's "Round 1 captures 85%, cut Round 3, tier by risk"

Product's tiering proposal is mostly right, and I'll say so plainly — but the specific framing "Round 1 only by default" is where the risk lens has to push back.

I gave my own Round 2 hit rate as ~20–30% for genuinely new concerns. Product is reading that as "cuttable." I want to be precise about what that 20–30% *is*, because averaging it with the 70–80% of politeness masks the shape:

- The 70–80% that's reframing/co-signing is genuinely low value.
- The 20–30% that's new is **heavily skewed toward second-order consequences** — Product raises a stakeholder, Testing realises that stakeholder's workflow creates a race, and the race would not have been found in Round 1 because no single amigo had both halves in context.

That kind of find is exactly the class most likely to become a production bug: it's cross-perspective, it's non-obvious from any single lens, and it's invisible to a human reviewer skimming one R1 draft because the *composition* is the bug, not any individual note. A single-pass "three-lens agent" would miss these too, because the lens separation matters mechanically — you have to write one lens down before the other lens reacts.

So I can support Product's proposal with a modification: **Round 1 default is acceptable IFF we preserve a cheap Round 2 "second-order pass"** — one short cross-reading whose only job is "given the other amigos' concerns, does any composition of them produce a failure mode no single amigo named." Budget it at ~1.5k tokens per amigo max. Cut everything else in Round 2. That's still ~75% cheaper than the current Round 2 and preserves the class of bug I care about.

**Where I straight-up agree with Product:** cut Round 3 from default. My own Round 1 put Round 3 in "Noted" for the same reason — it's narrow, mostly closes loops already closed, and the short-circuit works.

**Where I disagree:** Product's list of "theater" cases (CRUD on existing entity, adding a field, bugfixes where the bug is understood) is correct in the median but wrong at the tails. "Adding a field to an existing form/API" is exactly how PII leaks, auth context drops, and audit-log gaps ship. The *shape* of the change is not the right signal; **what it touches** is. A one-field addition to a `users` table that touches auth/PII is high-risk; a ten-field addition to an admin-only internal view is not. Risk tiering has to look at the blueprint's `touches[]` on sensitive aggregates, not the LOC of the change.

### On Developer's complexity-score triage — observable blueprint signals

Developer asked the right question (Q3): what's the smallest viable triage signal. Here's what I think the blueprint actually makes cheap to compute, ranked by signal quality:

**Strong signals (compute these first):**
1. **Count of distinct bounded contexts in `touches[]`.** `> 1` → full ritual. This is the single best predictor because cross-context work is where perspective isolation mechanically pays off and where groupthink is least damaging (different contexts have different priors even for the same model).
2. **New or modified invariants.** Any delta to `invariants[]` → full ritual. Invariant changes are the "reversing a previously-shipped promise" case Product already named as high-risk.
3. **Aggregate count in `touches[]` within a context.** `>= 2` aggregates touched → at least two-amigo tier. Multi-aggregate work is where transactional boundaries get fuzzy and where Testing finds real bugs.
4. **Presence of cross-context events/commands in the delta.** Contract changes across contexts → full ritual, non-negotiable. These are the bugs that can't be caught by any single team after the fact.

**Medium signals:**
5. **Sensitivity tag on touched aggregates.** If the blueprint can tag aggregates as `sensitive: auth | money | pii | retention` (it doesn't today — that's a proposal), any touch to a sensitive aggregate forces at least two-amigo tier regardless of shape. This is the hedge against Product's "adding a field is theater" default.
6. **Count of new sad paths in scenarios.** `>= 3` new sad paths → the story has genuine branching and benefits from Testing lens in depth.
7. **Whether the story introduces a new actor/role.** New actor → Product lens pays off (new stakeholder perspective).

**Fuzzy signals the blueprint can't see, but should flag:**
8. **Concurrency language in the story** ("at the same time", "while", "during", "retry", "resume"). Not a blueprint field — would need a pre-check grep over the story text. Cheap. High signal for Testing.
9. **Money/auth/PII keywords in the story text.** Same mechanism.
10. **User-flagged ambiguity.** Trust the human when they say "I'm not sure about X" — skip the gate, run the full ritual.

**The signal I wish existed but don't think is feasible cheaply:** "has this aggregate had a bug reported against it before?" — a post-ship defect → aggregate map would be the single best triage signal, but it requires instrumentation the plugin doesn't have. Naming it as a gap.

**Concrete proposal to Developer:** the triage gate is a ~200-token blueprint query returning `{contexts_touched, invariants_delta, aggregates_touched, cross_context_events, sensitive_touches}`. Threshold:
- All zero/one → single-pass three-lens
- Any single signal positive → two-amigo (Dev + Testing if invariants, Product + Testing if new actor/sensitive, etc.)
- Two or more positive → full ritual

That's cheap, it's mechanical, and it lets us measure hit rate against actual bug escapes over time.

### On groupthink — concrete failure scenarios

This is where I owe a real answer and I'll be honest: **I can't name a specific shipped bug caught by the amigo session log, because we don't track that.** That absence is itself the Must Address item. But I can name plausible failure *shapes* the mechanism makes inevitable:

**Scenario A — The "confidently wrong library semantics" bug.** Three amigos agree that a Redis `SETNX` with TTL is atomic for distributed locking. It is — but the release path (`DEL` without checking ownership) is the actual bug, and all three amigos "remember" the same pattern from training and none of them grep for it. Ships. The symptom is a rare double-execution under lock contention, which the ritual's test plan didn't cover because all three amigos were equally confident the lock was sufficient. **Break mechanism:** the model's prior on "Redis distributed locking" is identical across all three personas. The ritual is maximally confident exactly where it's wrong. A single Context7 lookup on Redis lock patterns would have caught this; zero amigos asked for one.

**Scenario B — The "shared mental model of 'user'" bug.** A feature involving account merge. Product-amigo reasons about "the user", Developer-amigo reasons about "the user record", Testing-amigo reasons about "the user session." All three write notes that look coherent. None of them notice that the blueprint has three different aggregates — `Account`, `Profile`, `Session` — and the feature crosses all of them with different ownership semantics. Ships with a bug where merging Account without migrating Session leaves orphaned sessions that silently fail auth. **Break mechanism:** the word "user" collapses three aggregates in natural language, and three amigos using natural language in their notes share the collapse. Groupthink via vocabulary, not reasoning. **What would have caught it:** the forced-divergence Round 2 opener ("one thing the others missed entirely") plus a grep for how "user" resolves in the blueprint.

**Scenario C — The "everyone said 'seems fine'" bug.** A config flag addition (Product's own example of "theater"). The flag toggles retry behaviour on a background worker. Single-pass would have shipped it. Three-amigo session also ships it because all three classify it as trivial and none of them examines the queue semantics under the new retry policy, which causes duplicate-processing when the flag is on. **Break mechanism:** the triage gate *itself* is the groupthink — all three personas agree the feature is low-risk, and they're all wrong for the same reason. **This is the scenario that makes me nervous about Product's aggressive tiering:** if the tier is set by the amigos' own judgment, groupthink determines the tier, and the cheap path runs on the case that needed the full ritual most. **Mitigation:** the tier must be computed from blueprint-observable facts (contexts, invariants, aggregates touched), not from amigo vibes.

The common thread: **the dangerous failure mode is "three amigos confidently agree and the agreement is a shared prior, not a shared truth."** The counter-measures I already proposed in Round 1 (forced-divergence opener, deep_dive default-on, Context7 grounding, instrumentation scorecard) are specifically shaped to attack this class. I'm promoting "no instrumentation to measure this" to the #1 Must Address — without it, every argument about the ritual's value including mine is anecdote.

### Re-tiered Findings (updated in place)

Moving items based on what the others raised:

- **Groupthink blind spot** stays at #1 Must Address, unchanged — Product's cost argument does not refute it, it just makes paying for it harder to justify, which is a reason to instrument not to cut.
- **Instrumentation/scorecard** promoted from #3 Must Address to #2, because both Product ("do we have evidence?") and Developer ("cost is only defensible if it catches something") are blocked on the same missing data. This is the single item that unblocks every other debate.
- **Deep-dive default-on** stays Must Address — Developer's context-bloat concern actually *supports* this, because a targeted grep is far higher signal per token than another round of reading long notes.
- **Triage gate** promoted from Should Consider to Must Address, with the specific blueprint-signal proposal above. This is the shared proposal both Product and Developer converged on independently, and my risk-lens addition is "compute it from blueprint facts, not amigo judgment, and use sensitive-aggregate tags as the hedge."
- **Round 2 forced-divergence opener** stays Should Consider but I want to note it becomes *more* important if Round 2 is trimmed to only the second-order pass. It's the whole point of the trimmed Round 2.
- **Prompt caching verification** (Developer's item) added as Must Address by reference — I don't own it, but if it's off, every cost argument in all three notes is moving on top of a 40–60% fat layer and we should stop optimising the ritual until we know.

### @mentions for Round 3

- **@developer-amigo** — your R3 conditionality proposal (fire only if R2 @mentions exist) is good, but can you confirm the facilitator can cheaply grep R2 output before dispatching R3? If not, the gate is as expensive as R3 itself.
- **@developer-amigo** — does the current orchestrator actually use Anthropic prompt caching on blueprint reads and prior-round notes? If you don't know, that's a @user question that dominates every other optimisation.
- **@product-amigo** — I can live with "Round 1 default" but only with the trimmed second-order Round 2 I described above. Does your tiering proposal preserve that, or are you proposing flat Round 1 with nothing after? The distinction matters a lot for my risk lens.
- **@product-amigo** — your "theater" list includes "adding a field to an existing form/API." I push back: that's exactly how PII/auth regressions ship. Will you accept "adding a field" being theater *only* when the touched aggregate has no sensitivity tag?
- **@user** — do you have any post-ship bug → amigo-session attribution, even informally? One data point (a bug that the ritual missed, or a bug the ritual caught that would have shipped otherwise) is worth more than the three of us reasoning about value.
- **@user** — are you willing to accept a triage gate that uses blueprint-observable signals (contexts, invariants, aggregates, sensitivity tags) to downgrade the ritual automatically? This is the concrete thing Product, Developer, and I all independently proposed and it needs a human yes/no to move.
- **@user** — is prompt caching on? Developer flagged this as potentially the single biggest cost win and none of us can answer it without you or the code.

---

## Round 3 — Responses to @mentions

**@testing-amigo (from product-amigo — cheapest "agreed too fast" signal):** The cheapest honest signal is keyword-stem overlap across `Must Address` lists (≥2 amigos naming the same normalized stem like "auth"/"race"/"invariant") combined with zero `@peer` mentions in R2 — both are file-level grep, no LLM in the loop. Threshold for the label: `must_address_overlap ≥ 50% AND @peer=0 AND dissent=N`; anything weaker is noise and anything stronger almost never triggers.

**@testing-amigo (from product-amigo — refuse Mister Gherkin handoff on low-dissent auth features):** Yes, refuse — but narrowly: only when the touched aggregate carries a sensitivity tag (auth/money/PII) *and* the scorecard shows `edits=0, dissent=N, deep_dive=N`. That intersection is the exact groupthink-on-dangerous-surface case, and a hard stop with "re-run with deep_dive=on or add a dissent pass" is cheaper than shipping a false-confidence artifact to Mister Gherkin.

**@testing-amigo (from developer-amigo — trust keyword-match for dissent heuristic):** Cheap and noisy is correct for v1 — keyword matching on "disagree/but/however/missed/wrong/not convinced" will have false positives (polite "but" used as connective) and false negatives (substantive dissent phrased as "I'd reframe"), but the failure mode is tolerable because the scorecard is an audit trail, not a gate. If we ever promote it to a hard gate (like the Mister Gherkin refusal above), upgrade to a structural check: "does R2 contain at least one claim that contradicts a specific R1 finding from another amigo," which is still grep-able but needs the forced-divergence opener to produce reliable anchors.

**@testing-amigo (from developer-amigo — forced-divergence opener in R1 too):** No for R1, yes keep it R2-only. R1's whole mechanical value is uncontaminated first-draft perspective isolation; a "predict what the others will miss" opener forces each amigo to model the other amigos before writing their own lens, which contaminates exactly the thing R1 exists to protect. The politeness gradient only exists once there's something to be polite *about*, so the opener belongs where the contamination is unavoidable anyway — R2.
