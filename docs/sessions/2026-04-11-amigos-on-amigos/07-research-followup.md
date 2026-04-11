# 07 — Research Follow-up

After the commit landed and the feature was pushed, the user came back with grounded research confirming and sharpening the direction. This file preserves both the research and my analysis of what it added.

## The user's research (verbatim)

> Fair point — I didn't. Let me actually look into this. Now here's my updated advice, grounded in the research:
>
> **The core tension your documents identify is well-supported by recent work.** The multi-agent debate paper from MIT/CSAIL (Du et al., 2023) showed that multiple instances of the same language model generating and critiquing each other's outputs does improve factual accuracy and reasoning. So your amigos aren't pure theater — the mechanism is real. But there's a critical caveat your documents nail correctly.
>
> **The same-model groupthink problem is empirically confirmed.** A 2025 clinical multi-agent study found exactly the failure mode your Testing Amigo describes: agents with an initially correct assessment changed their vote to align with a flawed majority, often swayed by less critical evidence. The researchers' proposed fix mirrors what your documents converge on — introducing an agent specifically designed to challenge the emerging consensus, or giving more weight to initial, independent analyses. Your "forced-divergence opener" is a lightweight version of this.
>
> **Heterogeneous agents outperform homogeneous ones.** A 2025 study on coordinated multi-agent QA generation found that heterogeneous agents consistently outperform homogeneous ones, a gap attributable to differing model architectures, training data, and inductive biases resulting in varied reasoning strategies and error profiles. This validates Developer Amigo's honest admission that the same-model problem is "structural and probably unfixable without a different base model in the loop." Persona prompts are a partial substitute, not an equivalent.
>
> **Traditional Three Amigos works because of genuinely independent experience.** The intent of the practice is to include each necessary perspective in as small a group as possible — and in human teams, those perspectives come from different lived experiences, not different system prompts. Your Product Amigo's point that "a developer has been burned by a specific on-call incident the PM never saw" is the irreducible gap.
>
> **My revised advice, informed by all of this:**
>
> 1. **The triage gate is still #1.** Nothing in the research changes this. Most of the multi-agent debate literature shows diminishing returns on simple problems. Reserve multi-agent for genuinely complex work.
>
> 2. **The forced-divergence opener is more important than I initially said.** The clinical study's groupthink finding — where collaborative correction and collaborative amplification of errors use the *same mechanism* — means your R2 needs structural protection against convergence. "One thing the others missed entirely" is cheap and directly targets this.
>
> 3. **Consider mixing models if you can.** The heterogeneous-agent research suggests even swapping one amigo to a different model (Gemini, GPT) would provide more genuine diversity than three Claude instances with different prompts. If the orchestrator supports it, that's a higher-leverage fix for groupthink than any prompt engineering.
>
> 4. **Prompt caching is still the gating question.** Everything else is secondary.
>
> 5. **The scorecard is non-negotiable.** Every study I found either had instrumentation to measure multi-agent value or explicitly called out the lack of it as a limitation. You can't tune what you don't measure. Ship the append-only scorecard immediately.
>
> 6. **Don't oversell what you have.** The human Three Amigos ritual works because of genuine cognitive diversity. Your LLM version works because of structured attention-steering and pre-committed checklists. Both are valuable — but they're different things, and being honest about that with users builds more trust than pretending three Claudes are three people.

## My analysis of what the research changed

### What it confirmed (already shipped or designed)

- **Scorecard** — already shipped. The research confirms this was the right first move; every study either had measurement or called out the lack of it as a limitation.
- **The same-model problem** — already named explicitly in the meta synthesis and slated for the "be honest in user-facing docs" work. The clinical 2025 paper makes the honesty more urgent, not less.
- **Triage gate** — already identified as the next shippable piece. The research shows diminishing returns on simple problems, which matches exactly what the amigos concluded from first principles.

### What it sharpened

**The forced-divergence opener needs to be structural, not optional.** In my design notes for F4 I had the opener as part of the scorecard's prescribed intervention but didn't actually wire it into the amigo Round 2 instructions as a mandatory section. The clinical paper's finding — that collaborative correction and collaborative error amplification use the *same mechanism* — means R2 needs explicit structural protection. A "name one thing the others missed entirely" header with a hard requirement to fill it out is cheap and directly targets the groupthink mechanism. This should get elevated from design intent to a mandatory R2 section in each amigo definition file.

### What was genuinely new

**Heterogeneous models > homogeneous personas.** This was the part I had under-weighted.

Full cross-vendor mixing (Claude + Gemini + GPT) isn't available from inside Claude Code sub-agent dispatch — the `model: inherit` field in the amigo frontmatter selects within the Claude family. But cross-family *within* the Claude line is free and meaningful: Opus, Sonnet, and Haiku have different sizes, different training snapshots, and different response distributions. Not cross-vendor diversity, but not identical priors either.

A concrete adaptation: add a `preferred_model:` field to each amigo's frontmatter, with `model: inherit` as a fallback so the plugin keeps working if the user's setup only has one model available. Product on Sonnet, Developer on Opus, Testing on Sonnet (or some deliberate mix). The scorecard's `agreement_overlap` metric will tell us empirically whether it helps — if overlap drops further after the change, the heterogeneous-agent hypothesis is validated; if not, the intervention was noise.

This is the highest-leverage structural change I hadn't considered during the meta session. It should ship as a follow-on to the scorecard once someone confirms the frontmatter mechanism actually works across sub-agent dispatch.

### What I still can't do from here

**Prompt caching verification.** The user's research reinforced that this is the gating question, and I still can't answer it from inside a sub-agent. Checking requires a human to read either:

1. The Claude Code sub-agent dispatch implementation (likely not plugin code — this is Claude Code internals), or
2. The plugin's agent invocation path, if the plugin explicitly sets or omits `cache_control` markers when building sub-agent prompts.

Until this is checked, every cost number in every amigo analysis is off by an unknown factor, possibly as much as 40–60%.

## What I proposed as follow-on work

Given the research, I offered two small shippable changes and asked the user to pick:

1. **Mandatory forced-divergence opener in R2** — edit each amigo's Round 2 instructions so the first action after reading others' notes is to write, under a required `## One Thing I Think the Others Missed Entirely` header, a concrete claim that names something absent from the other notes. If they can't find one, they must say so explicitly. ~5 minutes of edits.

2. **Cross-family amigo assignment by default** — new `preferred_model:` field in each amigo's frontmatter with `model: inherit` fallback. Product on Sonnet, Developer on Opus, Testing on Sonnet. ~15 minutes plus a pre-commit verification that the frontmatter actually works across sub-agent dispatch.

The user's response was to request this archive be written first. Both proposals remain open at the time of writing.
