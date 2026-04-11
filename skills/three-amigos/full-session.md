# Three Amigos — Full Session Mode

> Persona agents share the same knowledge base. Use full session mode for deeper structuring, not as a substitute for real multidisciplinary input.

When the user chooses "Full session" or "Deep dive", become the **Facilitator** — don't play the three roles yourself. Dispatch three independent persona agents who explore the feature, discuss via shared notes, then synthesize their findings.

**Deep dive mode:** If the user chose "Deep dive", include `deep_dive: true` in every Developer and Testing amigo prompt. This tells them they have permission to explore the codebase (grep, read source files, review patterns). Without this flag, amigos limit themselves to blueprint exploration only — saving tokens.

## Step F1: Setup

<bash-commands>
```bash
mkdir -p .storyline/workbench/amigo-notes
mkdir -p .storyline/personas
```
</bash-commands>

Read each persona's memory (may be empty on first run):
- `.storyline/personas/product-amigo.md`
- `.storyline/personas/developer-amigo.md`
- `.storyline/personas/testing-amigo.md`

## Step F1b: Codebase exploration choice

MCQ: Should the Developer Amigo explore the codebase or work from the blueprint only?
- Blueprint only (Recommended) — uses `storyline summary` + `storyline view`. Faster, lower token cost. Sufficient when the blueprint is current.
- Deep dive — also reads source files, greps for patterns. Use when the blueprint may be stale or the feature touches unfamiliar code paths.

Pass the choice to the Developer Amigo dispatch prompt in F2 (include/exclude explicit codebase exploration instruction).

## Step F1c: Check Optional Amigos

**Frontend Amigo:** Does the blueprint's `tech_stack` include a frontend framework AND does this feature involve UI changes or user-facing interactions? If both → include.

**Security Amigo:** Does this feature touch authentication, authorization, user input, sensitive data (PII, payments, medical), or external APIs? If yes → include.

## Step F2: Round 1 — Independent Analysis (parallel)

Build the crew roster from F1c. Include it in EVERY agent's prompt so they know who else is in the room.

Always dispatch Product, Developer, and Testing. Add Frontend and/or Security only if F1c says so.

<agent-dispatch>
Agent (subagent_type: "storyline:product-amigo"):
  prompt: |
    This is Round 1 — write your first analysis.

    ## The crew for this session:
    [Include crew roster from F1b]
    You are the Product Amigo. Stay in your lane — the others cover their specialties.

    ## Your notes from previous sessions:
    Read .storyline/personas/product-amigo.md (may not exist yet on first session).

    ## The feature to explore:
    [Feature description from the user]

    ## Project blueprint:
    Run `storyline summary`. Use `storyline view --context "<name>"` for full detail on relevant contexts.

    Write to .storyline/workbench/amigo-notes/product.md
    Do NOT read the other amigos' notes yet — they haven't written theirs.
    Work from: [project directory]

Agent (subagent_type: "storyline:developer-amigo"):
  prompt: |
    This is Round 1 — write your first analysis.

    ## The crew for this session:
    [Include crew roster from F1b]
    You are the Developer Amigo. Stay in your lane.

    ## Your notes from previous sessions:
    Read .storyline/personas/developer-amigo.md (may not exist yet).

    ## The feature to explore:
    [Feature description from the user]

    ## Project blueprint:
    Run `storyline summary`. Use `storyline view --context "<name>"` for relevant contexts.

    Write to .storyline/workbench/amigo-notes/developer.md
    Do NOT read the other amigos' notes yet.
    Work from: [project directory]

Agent (subagent_type: "storyline:testing-amigo"):
  prompt: |
    This is Round 1 — write your first analysis.

    ## The crew for this session:
    [Include crew roster from F1b]
    You are the Testing Amigo. Stay in your lane.

    ## Your notes from previous sessions:
    Read .storyline/personas/testing-amigo.md (may not exist yet).

    ## The feature to explore:
    [Feature description from the user]

    ## Project blueprint:
    Run `storyline summary`. Use `storyline view --context "<name>"` for relevant contexts.

    Write to .storyline/workbench/amigo-notes/testing.md
    Do NOT read the other amigos' notes yet.
    Work from: [project directory]
</agent-dispatch>

**If Frontend Amigo included:**
<agent-dispatch>
Agent (subagent_type: "storyline:frontend-amigo"):
  prompt: |
    This is Round 1 — write your first analysis.
    [Same structure — include crew roster, feature, blueprint instructions]
    Write to .storyline/workbench/amigo-notes/frontend.md
    Do NOT read others' notes yet.
    Work from: [project directory]
</agent-dispatch>

**If Security Amigo included:**
<agent-dispatch>
Agent (subagent_type: "storyline:security-amigo"):
  prompt: |
    This is a discovery session — NOT a code audit. Flag security concerns BEFORE implementation.
    [Same structure — include crew roster, feature, blueprint instructions]
    Focus on: auth design, data exposure risks, input validation needs, security requirements
    that should become Gherkin scenarios.
    Write to .storyline/workbench/amigo-notes/security.md
    Do NOT read others' notes yet.
    Work from: [project directory]
</agent-dispatch>

While agents work, ask the user a contextual question relevant to the feature (glossary terms, prior attempts, key stakeholder) — always with a "skip" option. Wait for all agents to finish.

## Step F3: Round 2 — Discussion (parallel)

Each agent reads the others' notes and appends reactions to their own file. Also update persona memory.

**@mention convention:**
- `@developer-amigo`, `@product-amigo`, `@testing-amigo`, `@frontend-amigo` — directed at a specific amigo (they respond in Round 3)
- `@user` — question only the human can answer; the Facilitator surfaces these in Step F5
- `@mister-gherkin` — handover note for Phase 2

<agent-dispatch>
Agent (subagent_type: "storyline:product-amigo"):
  prompt: |
    This is Round 2 — two-step:
    Step 1 — BEFORE reading any other notes, append `## One Thing I Think the Others Missed Entirely` to your own note with a concrete claim or the literal sentence `I couldn't find one`. This section must not echo your R1 Must Address.
    Step 2 — Now read: .storyline/workbench/amigo-notes/developer.md and testing.md (and frontend.md / security.md if present). Append reactions to .storyline/workbench/amigo-notes/product.md.
    Update persona memory at .storyline/personas/product-amigo.md
    Use @mentions to direct questions. @user for human-only. @mister-gherkin for Mister Gherkin handovers.
    Work from: [project directory]

Agent (subagent_type: "storyline:developer-amigo"):
  prompt: |
    This is Round 2 — two-step:
    Step 1 — BEFORE reading any other notes, append `## One Thing I Think the Others Missed Entirely` to your own note with a concrete claim or the literal sentence `I couldn't find one`. Must not echo your R1 Must Address.
    Step 2 — Read: .storyline/workbench/amigo-notes/product.md and testing.md (and frontend.md / security.md if present). Append reactions to .storyline/workbench/amigo-notes/developer.md.
    Update persona memory at .storyline/personas/developer-amigo.md
    Use @mentions, @user, @mister-gherkin conventions.
    Work from: [project directory]

Agent (subagent_type: "storyline:testing-amigo"):
  prompt: |
    This is Round 2 — two-step:
    Step 1 — BEFORE reading any other notes, append `## One Thing I Think the Others Missed Entirely` to your own note with a concrete claim or the literal sentence `I couldn't find one`. Must not echo your R1 Must Address.
    Step 2 — Read: .storyline/workbench/amigo-notes/product.md and developer.md (and frontend.md / security.md if present). Append reactions to .storyline/workbench/amigo-notes/testing.md.
    Update persona memory at .storyline/personas/testing-amigo.md
    Use @mentions, @user, @mister-gherkin conventions.
    Work from: [project directory]
</agent-dispatch>

Wait for all agents to finish.

## Step F3b: Round 3 — @mention Responses (parallel)

Each amigo reads all notes and responds to `@mentions` directed at them.

<agent-dispatch>
Agent (subagent_type: "storyline:product-amigo"):
  prompt: |
    This is Round 3 — respond to @mentions directed at you.
    Read all amigo notes. Find every @product-amigo.
    Append responses to .storyline/workbench/amigo-notes/product.md under:
    ## Round 3 — Responses to @mentions
    If none: ## Round 3 — No @mentions for me.
    Work from: [project directory]

Agent (subagent_type: "storyline:developer-amigo"):
  prompt: |
    This is Round 3 — respond to @mentions directed at you.
    Read all amigo notes. Find every @developer-amigo.
    Append to .storyline/workbench/amigo-notes/developer.md under:
    ## Round 3 — Responses to @mentions
    Work from: [project directory]

Agent (subagent_type: "storyline:testing-amigo"):
  prompt: |
    This is Round 3 — respond to @mentions directed at you.
    Read all amigo notes. Find every @testing-amigo.
    Append to .storyline/workbench/amigo-notes/testing.md under:
    ## Round 3 — Responses to @mentions
    Work from: [project directory]
</agent-dispatch>

If Frontend Amigo was dispatched, also dispatch in Round 3 with the same pattern for `@frontend-amigo`.

Wait for all agents to finish.

## Step F3c: Score the Session (zero LLM calls)

<bash-commands>
```bash
storyline amigo-score
```
</bash-commands>

Reads the amigo notes and writes `.storyline/workbench/amigo-notes/scorecard.yaml`. Deterministic metrics only — tier counts, new-catch detection, dissent markers, agreement overlap, sensitive-aggregate hit, and per-amigo forced-divergence classification (`substantive | disclaimed | missing`). When `.storyline/.session-id` is set, the scorecard is also snapshotted to `.storyline/sessions/<session-id>/scorecard.yaml` so historical trending across runs is possible. Exits `0` for GREEN/YELLOW, `2` for RED hard gate.

**Handle the verdict before F4:**

- **GREEN** → session earned its tokens. Continue to F4. Surface the one-line summary in F5.
- **YELLOW** → note the warning. Continue to F4. Show the scorecard reasons in F5 alongside the example map so the user sees which signals were weak.
- **RED (hard gate)** → stop. A sensitive aggregate was discussed with zero dissent and zero Round 2 new catches. Do NOT proceed to F4. Present the scorecard to the user and require one of:
  1. **Re-run with `deep_dive: true`** (forces Developer/Testing to read actual code — breaks shared-prior groupthink on library semantics)
  2. **Add a Security Amigo** to the crew and re-run Rounds 1–3 (different system prompt = different attention biases on the same input)
  3. **Documented override** — user explicitly accepts the risk in writing; record it as a `best_guess` assumption in the example map with `confidence: low`

The RED trigger exists because the worst failure mode of the ritual is three amigos confidently agreeing on a security, concurrency, or money-handling concern that all three got wrong from the same training prior. When the scorecard shows zero dissent AND a sensitive aggregate, the output is a false-confidence signal and should not be trusted downstream.

## Step F4: Synthesize the Discussion

Each amigo ends their note with a `## Prioritized Findings` section tiered into `Must Address` / `Should Consider` / `Noted`. Use the tiers — don't try to re-rank the full wall of notes yourself.

Read all amigo notes, then build the example map in this order:

1. **Union of `Must Address` across all amigos** → every item becomes either a rule, an example, or an open question in the map. Nothing in this tier may be silently dropped. If two amigos flagged related concerns, merge them but keep both rationales visible.
2. **Cross-perspective synthesis** — this is where you add value beyond the tiers: scan `Should Consider` for items that become critical when combined with another amigo's `Must Address` (e.g. Product's "noted" data field is a Security `Must Address` because it's PII). Promote those into the map.
3. **`Should Consider` sweep** → fold in remaining items that fit naturally as rules, examples, or questions. Ones that don't fit can be left in the notes.
4. **`Noted` tier is context only** — do not pull from it unless you're filling a gap left by the tiers above.
5. **Open questions** — combine from `Top 3 Questions` sections + any unresolved `@mentions`, dedupe, note agreements/disagreements.
6. **Risks** — pull from `Must Address` items that describe risks rather than rules, plus any Round 2 disagreements.
7. **Highlighting the discussion** — where did amigos challenge each other? What tier changes happened in Round 2? Surface these as decisions the user should see.
8. **Collecting @user mentions** — grep all notes for `@user`; these become Step F5 questions.
9. **Collecting @mister-gherkin mentions** — grep for `@mister-gherkin`; pass to Mister Gherkin in Phase 2.

**Coverage check before presenting:** for each amigo, count their `Must Address` items and confirm every one is represented somewhere in the map (rule / example / question / risk). If any are missing, either add them or explicitly note to the user why they were excluded — never silently.

## Step F5: Present to User

Show:
- **Session ROI** — one line from the scorecard: `rating  new_catches=N  dissent=N  overlap=N.NN  peer:user=N.NN  forced_divergence=N/M`. The `forced_divergence` field counts how many amigos wrote a substantive `One Thing I Think the Others Missed Entirely` section out of the total dispatched (the rest were disclaimed or missing) — it's an audit signal, not a gate in v1. If YELLOW, also show the `verdict.reasons` list so the user understands what was weak.
- Proposed rules (which persona surfaced them)
- Examples per rule
- Open questions (grouped by who can answer)
- Risks flagged
- Key disagreements between amigos

Then ask the `@user` questions from the notes. Group them by amigo:
> "[Product Amigo] wants to know: [question]"
> "[Developer Amigo] wants to know: [question]"

## Step F6: Continue to Example Map

After presenting and collecting answers:
1. Run Steps 2d (Assumption Audit), 2e (Story Size Check), 3 (MoSCoW), 4 (Risks), and 4b (Stakeholder Check) from the main skill — using the synthesized content as input
2. Write `example-map.yaml` (see `./example-map-format.yaml` for format)
3. Commit and proceed to Mister Gherkin as in the main skill
