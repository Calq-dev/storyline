# 05 — Synthesis of the Meta Amigo Session

This is the synthesis I presented to the user after all three amigos had completed Rounds 1–3. It was built from the union of `Must Address` items across amigos, with cross-perspective promotion where one amigo's concern elevated another amigo's `Should Consider` or `Noted` item. Nothing was silently dropped.

---

## Three Amigos on Three Amigos

The three amigos converged on a coherent picture and genuinely disagreed on several points. **The disagreement itself is the first data point**: if they were just one model in three hats, Round 2 would have been mutual agreement — it wasn't.

### What they agreed on (Must Address across all three)

**1. Tier the ritual by risk, don't run full sessions by default.**

- **Routine work** (CRUD, config, copy, single-context): cheap path — one agent with a three-lens prompt, ~25% of the token cost, ~85% of the value
- **Novel / cross-context / sensitive work** (auth, money, permissions, PII, cross-aggregate events, high invariant count): full ritual earns its keep — ~65–75% of value vs cheap path, but the 25–35% gap is exactly the second-order bugs that matter
- **Trigger signals** (computable from blueprint, no LLM call): contexts-touched count, invariant delta, aggregate `touches[]` count, cross-context events, plus a `sensitive:` tag on aggregates touching auth/money/PII

**2. Make Round 3 conditional, not default.** Grep the Round 2 notes for `@<amigo>-mention`. If zero, skip R3 dispatch for that amigo. Filesystem grep is free; R3 dispatch isn't.

**3. The groupthink trap is the biggest real risk.** All three amigos share Claude's training priors — when they confidently agree on security, concurrency, perf, or library semantics, that's the danger zone, not the safe zone. Testing named the shape: Redis lock release semantics, "user" meaning three different aggregates, a config flag that looks trivial and ships a duplicate-processing bug. The fix has two layers:

- **Intervention (cheap):** forced-divergence opener in Round 2 — "name one thing the others missed entirely." Keep R1 uncontaminated (no divergence opener there — R1's one real job is perspective isolation from a blank slate)
- **Audit (cheaper):** a per-session scorecard computed from the note files with zero LLM calls — `edits` (git diff), `@peer/@user ratio`, `dissent` keyword grep, `deep_dive` flag, `r2_new_catches` (R2 items not keyword-overlapping R1). This is the single highest-leverage missing instrument. Without it, everyone's guessing about ROI.

**4. Hard stop on sensitivity + zero dissent.** If a feature touches a `sensitive:` aggregate AND the scorecard shows `edits=0, dissent=N, deep_dive=N`, refuse the Mister Gherkin handoff. Warning-only isn't enough here — false confidence on auth bugs is the worst failure mode.

**5. Verify prompt caching is actually on.** Developer flagged this as the single biggest unknown. Every token-cost number is wrong by 40–60% if it isn't. From inside a sub-agent nobody can tell — the facilitator code has to be checked. This gates the whole cost conversation.

**6. Be honest about the same-model problem in the user-facing docs.** Don't oversell "three independent experts." What the personas actually buy is: (a) a structured multi-lens checklist, (b) mild position-commitment per amigo, (c) attention-biasing toward different n-grams in the same input. What they do NOT buy: independent priors, genuinely different training data, or actual disagreement on shared blind spots.

### Where they disagreed (and how it landed)

| Tension | Resolution |
|---|---|
| Product: "cut Round 3 from default" | Developer: conditional-R3 via grep is strictly better. Product accepted. |
| Product: "85% value at 45% cost" | Developer: 25% cost, and value splits ~85% routine / ~65-70% novel. Product restated. |
| Product: "R2 is mostly ceremony, cut it" | Testing: trimmed R2 (~1.5k tokens/amigo, second-order pass only) preserves the one thing R2 uniquely catches — cross-perspective second-order bugs. Held. |
| Developer: "add R1 forced-divergence opener too" | Testing: no — R1's mechanical value IS uncontaminated first-pass. Held. |

### Questions only you can answer (`@user` from the notes)

1. **Is prompt caching on for sub-agent dispatches in this plugin?** Gates every cost number above.
2. **Acceptable to gate Mister Gherkin handoff** on `sensitive aggregate + zero dissent`? (Hard stop, not warning.)
3. **Acceptable to default routine work to a cheap single-agent three-lens path?** Saves ~75% of tokens on the common case.
4. **Is there any post-ship bug attribution back to amigo sessions?** If no, the scorecard is the first real feedback loop.
5. **Does the blueprint schema support a `sensitive:` tag on aggregates?** If not, is adding one acceptable?
6. **`deep_dive` default-on for Testing amigo** when the feature touches existing code?
7. **Product-visible "agreed too fast, lower confidence" label** on session output — acceptable vs brand risk?

### Live test of the new tiered format

The tiered findings format added earlier in the session survived contact — each amigo actually used the tiers to re-rank across rounds, and the synthesis above is built entirely from the union of their `Must Address` items plus one cross-perspective promotion (groupthink started as Testing Must → became Product Must after Round 2). No item was silently dropped. The cap of 3–6 `Must Address` items held — nobody inflated.

One weakness observed: all three amigos tiered `prompt caching verification` as Must Address but none of them can actually answer it — it's a `@user` question masquerading as an action item. The synthesis step should probably separate "must address by the pipeline" from "must address by the human."

### My recommendation on what to actually build next

If I had to pick one thing from this whole session to ship first, it's the **zero-LLM-call scorecard**. Every other optimization (triage gate, cheap path default, groupthink detection, conditional R3) is blocked on not having measurement. Without the scorecard you're tuning the ritual in the dark. With it, everything else becomes a data-driven decision instead of a guess.
