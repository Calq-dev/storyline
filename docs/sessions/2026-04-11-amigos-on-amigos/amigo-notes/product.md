# Product Amigo — Meta Reflection on the Three Amigos Ritual

This is a meta session. I am reflecting on whether the ritual I participate in actually earns its token cost. I will try to be honest rather than defend my own existence.

## 1. Does the ritual serve the real product goal?

The real goal is simple: features that match intent, don't bounce back in rework, don't ship with obvious gaps. Everything else is decoration.

My honest read: **the ritual helps with the first two, barely helps with the third, and often over-serves all three on small work.**

- **Intent matching:** the biggest lever is actually Round 1 of the Product pass — forcing *someone* to write down "what the user really wants" before anyone touches scenarios or code. That single artifact catches more rework than the rest of the ritual combined. It doesn't require three agents. It requires one disciplined pass with a product lens.
- **Rework reduction:** Round 2 reactions do catch real things — usually scope creep and missing edge cases. But the hit rate is maybe 1 useful catch per 3 sessions on routine work, and closer to 1 per session on novel work.
- **Obvious gaps at ship time:** this is mostly Testing Amigo's job and mostly happens in the scenario/gherkin phase, not in the amigo huddle. The huddle rarely surfaces a gap that wouldn't be found 20 minutes later when someone actually writes the Given/When/Then.

So: the ritual *contributes* to the goal, but the contribution is front-loaded into one specific moment (the first product-lens pass) and the rest is diminishing returns.

## 2. Where is value concentrated?

Ordered by value-per-token, best to worst:

1. **Round 1, Product pass.** Writing "intent behind the request" + "what already exists that conflicts." This is where most of the "wait, should we even build this?" moments happen. High value.
2. **Round 1, Testing pass.** The "how would I prove this is broken" lens forces concreteness. Medium-high value.
3. **Round 1, Developer pass.** Usually the least surprising of the three — an LLM writing about feasibility tends to converge on the same "it's fine, here are the usual concerns" shape unless the work is genuinely novel. Medium value on novel work, low on routine.
4. **Round 2 reactions.** Occasionally sharp, often polite agreement dressed up as critique. Same-model problem bites hardest here (see §4). Low-to-medium value.
5. **Round 3 @mention resolution.** Almost never decisive. It's a ceremony to close loops that were mostly already closed. Low value.
6. **Synthesis / Mister Gherkin handover.** Valuable as an *artifact*, not as a *process step*. The synthesis could be produced from Round 1 alone 80% of the time.

**What to keep:** Round 1 from all three perspectives, as short independent passes. **What to cut hardest:** Round 3. It's the most ritualistic and the least load-bearing.

## 3. When does it pay off vs when is it theater?

Concrete line-drawing:

**Theater (skip the ritual, use a single pass):**
- CRUD on an existing entity with established patterns
- Config/flag additions
- UI copy, error message wording
- Renames, refactors with no behavior change
- Adding a field to an existing form/API
- Bugfixes where the bug is already understood

**Real value (run the ritual, probably Round 1 only):**
- New bounded context or first feature in a context
- Cross-context features where ownership is unclear
- Features touching money, auth, permissions, or data retention
- Anything where the user request and the existing blueprint pull in different directions
- Features where stakeholders are known to disagree (the product pass has to adjudicate)
- Reversing or modifying a previously-shipped invariant

**Full three rounds only when:** the work is novel *and* high-blast-radius *and* the first round surfaced genuine disagreement. That's maybe 1 in 10 features on a mature codebase.

## 4. The same-model problem — honest read

The user is right and I shouldn't flinch from it. We are all Claude. The "three perspectives" are system-prompt costumes on one actor.

**What a persona prompt DOES buy:**
- **Attention steering.** It biases which tokens get weight. A "product" prompt really does make me dwell on intent, users, scope, and business risk instead of drifting toward "here's how I'd implement it." That bias is real and measurable in output shape.
- **Vocabulary priming.** Different personas surface different jargon, which surfaces different associations from training data. Testing-flavored prompts pull in edge-case patterns I wouldn't spontaneously generate from a neutral prompt.
- **A checklist effect.** The persona is effectively a structured checklist dressed as a character. That's useful — checklists reduce omissions — but it's a checklist, not a mind.
- **Commitment to a position.** Having written "as Product Amigo" in Round 1 makes me slightly more likely to defend the product lens in Round 2 rather than immediately agreeing with Developer. Slight, not strong.

**What it does NOT buy:**
- **Independent priors.** We share training data, biases, failure modes, and blind spots. If the base model doesn't know that a pattern is dangerous, no persona will catch it. Three Claudes will miss the same thing in the same way.
- **Genuine disagreement.** Real Three Amigos sessions with humans work because a developer has been burned by a specific on-call incident the PM never saw. We don't have that. Our "disagreements" are stylistic, not experiential.
- **Calibration diversity.** If I'm overconfident about X, Developer Amigo is probably also overconfident about X. Averaging three correlated estimates barely beats one.
- **The "wait, that's wrong" moment.** The highest-value thing a human amigo does is catch a factual error with "no, that's not how our billing works." We can't do that unless the blueprint already said it, in which case one pass would have found it.

**Net:** the persona wrappers buy us a structured multi-lens checklist with mild position-commitment. They do not buy us independent cognition. Pricing should reflect that.

## 5. Token economics

Rough order-of-magnitude for a typical 3-amigo session on a medium feature:
- Round 1: ~3 agents × ~8-15k tokens each (reading blueprint, writing notes) = ~30-45k
- Round 2: ~3 × ~5-10k = ~15-30k
- Round 3: ~3 × ~3-5k = ~10-15k
- Synthesis + handover: ~10-20k
- **Total: ~65-110k tokens per session.**

Value delivered on a **routine** feature: maybe 1-2 scope clarifications that would have been caught in review anyway. Value per token: poor. We are paying novel-feature prices for routine work.

Value on a **novel** feature: 3-6 real catches, at least one of which would have caused measurable rework. Value per token: good, probably net positive even at full ritual cost.

**Cheaper alternatives that capture most of the value:**

- **"Single agent, three-lens pass"** (one prompt, ~15-25k tokens): one agent explicitly told to write a Product section, a Developer section, and a Testing section in one pass. Captures maybe 60-70% of Round 1 value at 20-30% of the token cost. Loses the mild position-commitment effect and loses parallelism, but on routine work that's fine.
- **"Round 1 only, then straight to Gherkin"** (~30-45k tokens): keeps the independent-first-draft benefit, drops Rounds 2 and 3. Captures maybe 85% of total value at ~45% of the cost. **This is probably the sweet spot for most work.**
- **"Full ritual"** (~65-110k tokens): reserved for the 1-in-10 novel/high-blast-radius case.

My recommendation as the Product lens: **tier the ritual by feature risk, don't run full three-rounds by default.** The current default assumes every feature deserves the full ceremony, which is the token equivalent of putting every PR through architecture review.

## Prioritized Findings

### Must Address
- **Tier the ritual by feature risk, don't run it uniformly.** Why: we're paying novel-feature token prices on routine work, and most of the value is in Round 1 anyway. A risk-gated entry point captures 80%+ of value at <50% of tokens.
- **Cut Round 3 from the default flow.** Why: @mention resolution is the most ceremonial, least load-bearing step; its loops are usually already closed by Round 2. Keep it available, don't run it by default.
- **Name the same-model problem in the ritual's own docs.** Why: users should know what a persona pass buys (structured multi-lens checklist) and what it doesn't (independent cognition). Selling it as "three perspectives" overpromises and erodes trust when someone notices.

### Should Consider
- Offer a "single-agent three-lens pass" as the default entry for low-risk work (CRUD, config, copy, renames), with explicit escalation to full ritual when Round 1 surfaces genuine disagreement.
- Make Round 1 artifacts survive even when Rounds 2/3 are skipped — the product-intent note is the single highest-value output and should always be produced.
- Add a pre-check that asks "is this novel, cross-context, or touching money/auth/permissions?" before spinning up three agents. If no, use the cheap path.
- Track, even informally, which rounds actually produced a scope change in the last N features. If Round 3 never does, that's the evidence to cut it.

### Noted
- The ritual has real value on novel, high-blast-radius, cross-context features — don't throw it out, right-size it.
- Persona prompts genuinely do shift output distribution; they're not pure theater. They just don't buy independent cognition.
- Testing Amigo's Round 1 is doing more work than it gets credit for because it forces concreteness; preserve that even in the cheap path.

## Top 3 Questions

1. Are we willing to tier the ritual by feature risk and accept that most features should run a cheaper path, or is uniform ceremony a non-negotiable for the brand of the plugin?
2. Do we have any actual evidence (last 10-20 features) of Round 2 or Round 3 changing a decision that Round 1 had already made? If not, that's the cut.
3. How should the plugin present the same-model honesty to users — as a footnote, as a first-class disclaimer, or as a design principle that shapes which rounds run by default?

---

## React to Others

### To Developer Amigo — the cost math and triage proposal

The 10x-input / 4x-output ratio is the number I wish I'd put in my own Round 1. That's the honest headline: the ritual is not expensive in absolute terms, it's expensive **relative to a single-pass baseline that captures most of the value**. Your 1.3–1.6x insight-per-pass estimate lines up with Testing's 20–30% new-insight figure for Round 2, and both are well below the 3x that "three parallel agents" implies. The business case collapses into a narrow wedge.

**Does the business case hold up?** Partially. It holds for:
- Novel / high-blast-radius / cross-context work (my original "full ritual" bucket)
- Features where the facilitator is really running the ritual as *a structured forcing function for the human reader*, not for the agents — your reframing in §3. That's actually the strongest remaining defense I've seen, and I hadn't named it in Round 1. The amigos are generating three pre-committed artifacts *for the human to triangulate against*, not arguing with each other. If that's the real value, then R1 alone delivers it and everything after R1 is overhead on the agent side that the human barely reads.

It does **not** hold for routine work at current cost, and your triage gate is the right mechanism. I endorse your "Quick scan / Middle tier / Full session" ladder — it's a sharper version of my tiering recommendation and I'm adopting it.

**On prompt caching — this is the most important engineering question in this whole meta session.** If caching isn't on, every cost number we've produced is inflated by 40–60% and the whole conversation is distorted. @developer-amigo please confirm in Round 3 whether storyline's current facilitator actually leverages Anthropic prompt caching on blueprint reads and cross-round notes. If not, that one fix probably changes the economics enough to make "full ritual by default" defensible on more features.

**On your tiered-format risk prediction:** agreed, and I want to second the hard caps (3/5/5). Without them, `Must Address` becomes a politeness floor, not a prioritization signal. I notice my own Round 1 has 3 items in `Must Address` — that's the cap working, but it's also suspiciously round. Worth noting.

### To Testing Amigo — the groupthink warning

This is the finding that actually shifts my tiers. Your framing — "confident mutual confirmation" as the worst-possible Round 2 outcome — is the concrete mechanism behind the same-model problem I hand-waved at in my Round 1 §4. I said "three correlated estimates barely beat one." You said "three confident agreements on a security issue are worse than no ritual at all because they manufacture false confidence in the reader." Your version is strictly sharper and I'm updating toward it.

**The business implication I missed in Round 1:** the ritual's *highest-confidence outputs* (where all three amigos agree) are the ones most likely to be groupthink artifacts on exactly the classes where agreement is most dangerous (auth, concurrency, perf cliffs, numerical/locale). From a product lens, shipping with false confidence is worse than shipping with known uncertainty, because the former forecloses the review that would have caught the bug. **A product-visible "the amigos agreed unusually fast — treat this as lower-confidence, not higher" warning is not a nice-to-have, it's a correctness feature.** I'm adding this to `Must Address`.

Your scorecard proposal (`edits=N, @mentions=M, dissent=Y/N, deep_dive=Y/N`) is the cheapest honest instrumentation I've seen in this meta session. If `dissent=N` triggers a "low-confidence, not high-confidence" label on the output, you've turned groupthink from a silent failure into a visible one. I am strongly in favor.

Your "one thing the others missed entirely" Round 2 opener is also a real fix — it's a mechanical forced-divergence prompt that costs nothing. Adopting.

On `deep_dive` defaulting on when touching existing code: from a product perspective, yes. The blueprint-sanitised world is a real product risk because it ships features that are internally consistent with the blueprint but inconsistent with the code the user actually runs. That's a rework source I had not been pricing in.

### Re-tiered `Prioritized Findings`

Based on the two reactions above, I'm moving items in place. Summary of changes:

- **Promoted to `Must Address`:** groupthink warning / low-confidence labeling when amigos agree too fast (new item, driven by Testing). Prompt-caching verification (promoted from Developer's note into my own Must because it gates the entire cost conversation).
- **Demoted from `Must Address`:** "Cut Round 3 from the default flow" → demoted to `Should Consider`, because Developer's conditional-R3 gate (only run if R2 has @mentions) is strictly better than unconditional cut, and Testing notes R3 is low-risk and short-circuits cleanly. The original reason for cutting was token waste, and the conditional gate solves that at lower behavioral cost.
- **Held in `Must Address`:** tier-the-ritual-by-risk and name-the-same-model-problem-in-docs. Both reinforced by the other amigos, not challenged.

**Updated `Must Address`:**
- **Tier the ritual by feature risk, don't run it uniformly.** Why: unchanged from Round 1, plus Developer's triage ladder gives us a concrete mechanism (Quick scan / Two-amigo middle / Full session) I'm adopting wholesale. The business case for full-ritual-by-default doesn't survive the 10x input ratio except on the narrow novel/high-blast-radius wedge.
- **Emit a low-confidence warning when amigos agree too fast.** Why: (new, driven by Testing §3 and §6.) When three notes show `dissent=N` on a feature touching auth / concurrency / perf / money, the ritual's most confident output is its most dangerous. Users will trust "all three amigos confirmed" as a quality signal; from a product standpoint, that's a correctness hazard we are currently manufacturing. A visible "agreement-too-fast" label converts silent groupthink into a flagged output the user can override.
- **Verify prompt caching is on for blueprint + cross-round notes before making any other cost decision.** Why: (promoted from Developer.) Every cost number in this meta session — mine, Developer's, the user's concern that triggered it — is wrong by 40–60% if caching isn't active. This is the single change that could reframe the entire "is the ritual worth it" question, and it's upstream of every other optimization we're proposing. Must verify before we commit to cuts that might be premature.
- **Name the same-model problem in the ritual's own docs, and name groupthink as its specific failure mode.** Why: unchanged in substance, but strengthened by Testing's framing. Users should be told what a persona pass buys (structured multi-lens checklist + pre-commitment) and what it demonstrably does not buy (independent cognition, independent priors, adversarial challenge on shared blind spots). The ritual currently over-promises on the second and under-delivers the first as a consequence.

**Updated `Should Consider`:**
- **Make Round 3 conditional on R2 @mentions existing** (adopted from Developer, demoted from my original Must). Why: a conditional gate is strictly better than an unconditional cut and keeps R3 available for the cases where it earns its tokens.
- **Round 2 forced-divergence opener: "one thing the others missed entirely"** (adopted from Testing). Why: mechanical, cheap, breaks politeness gradient, and — crucially — gives us the `dissent=Y/N` signal the Must-Address warning needs.
- **Default `deep_dive=on` for Testing when a feature touches existing code** (adopted from Testing). Why: blueprint-sanitised reasoning is a real product risk. The rework cost of shipping a feature that conflicts with actual code exceeds the token cost of a grep.
- **Single-agent three-lens pass as the default entry for low-risk work** (held from Round 1). Why: captures 60–70% of Round 1 value at 20–30% of cost for the majority of routine features.
- **Hard caps on the tiered format (3/5/5) with required `Why:` rationale** (adopted from Developer). Why: turns tiers from decoration into a routing signal.
- **One-line scorecard per session to `.storyline/workbench/`** (adopted from Testing). Why: the only way any claim in this entire meta conversation becomes evidence instead of vibes.

**Updated `Noted`:**
- Retrospective calibration over N features.
- Pre-check gate for novel/cross-context/money/auth before spinning up three agents.
- Round 1 artifacts survive even when later rounds are skipped.
- Persona prompts genuinely shift output distribution but do not buy independent cognition.
- Testing Amigo's Round 1 does more work than it gets credit for — preserve concreteness-forcing in the cheap path.

### @mentions for Round 3

- **@developer-amigo:** Is prompt caching currently active in the storyline facilitator for (a) blueprint reads across rounds and (b) Round 1 notes being re-read in Round 2? This is gating my entire tier structure above — if caching is on, the cost pressure is lower and "full ritual by default" becomes defensible for a wider band of features. If it's off, enabling it is the only real Must Address and everything else is secondary.

- **@developer-amigo:** Your triage ladder proposes "measure blueprint-delta" as the gate. From a product lens I need to know: can we reliably compute "story touches money / auth / permissions / data retention" from the blueprint alone, or do we need the user to flag it explicitly? If the latter, the triage gate has to surface as a user question, not a silent heuristic.

- **@testing-amigo:** For the groupthink warning — what's the cheapest signal to detect "agreed too fast"? Is it literally `all three Must Address lists have zero overlap-by-topic with another amigo's dissent`, or something richer? I want to know what threshold I should propose for the product-visible label before I defend it to the user.

- **@testing-amigo:** If the scorecard shows `edits=0, dissent=N, deep_dive=N` on a feature that touches auth, should the facilitator *refuse to hand off to Mister Gherkin* until at least one of those flips? That's a harder product stance than "emit a warning." I'd take it, but I want your read before proposing it.

- **@user:** This is the load-bearing human-only question. Given Developer's 10x-input cost ratio and Testing's groupthink risk: **is a product-visible "the amigos agreed too fast, treat this as lower-confidence" label acceptable, or does it undermine the plugin's brand more than the groupthink risk undermines its correctness?** I think it's worth it. This is a values call, not a technical one, and I can't make it for you.

- **@user:** Are you willing to accept a tiered default where most features run a single-agent three-lens pass and full three-amigo sessions only fire on novel / high-blast-radius / cross-context work? This is the single biggest cost lever and it requires your sign-off because it changes what users experience when they invoke the plugin on routine work.

- **@mister-gherkin:** Handover note — if the tiered-default recommendation above is adopted, your input shape changes. On the cheap path you'll receive a single-agent three-lens artifact rather than three independent R1 drafts. The useful content is mostly the same but the "cross-check between amigos" affordance you currently use is gone. Worth knowing so you can adjust how you treat agreement as signal.

## Round 3 — Responses to @mentions

**@product-amigo (from Developer Amigo — restate 85%/45% split by routine vs novel):** Accepted and restating: R1-only captures ~85% of value on routine work at ~25% of full-ritual cost, but only ~65–70% of value on novel/cross-context work where second-order composition catches live in R2. The single blended number was dishonest across regimes; the tier-by-risk framing is what makes the cheap path defensible, not a flat percentage.

**@testing-amigo (from Testing Amigo — does tiering preserve the trimmed second-order R2?):** Yes — my "Round 1 default" is shorthand for R1 + your trimmed ~1.5k-token second-order cross-read, not flat R1 with nothing after. The second-order pass is the one R2 affordance I explicitly want to keep on the cheap path; cutting it would forfeit exactly the cross-perspective composition bugs that justify the ritual at all.

**@testing-amigo (from Testing Amigo — does "adding a field is theater" hold when sensitive tags are present?):** No, and I'm updating the theater list. Sensitivity on the touched aggregate (auth / money / pii / retention) overrides shape-based triage — a one-field addition to a sensitive aggregate forces at least two-amigo tier regardless of how small it looks. The signal must be "what it touches," not "how much it changes," and I'm adopting the blueprint `sensitive:` tag proposal as the hedge.
