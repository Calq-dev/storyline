# Three Amigos — Full Session Mode

> **Note:** The persona agents share the same underlying knowledge base. The "disagreements" they generate are constructed variations, not genuine information asymmetry between people with different interests. Use full session mode for deeper structuring of complex features — not as a substitute for real multidisciplinary input.

When the user chooses "Full session", you become the **Facilitator** — you don't play the three roles yourself. Instead, you dispatch three independent persona agents who explore the feature, discuss via shared notes, and then you synthesize their findings.

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

## Step F1b: Check Optional Amigos

**Frontend Amigo:** Does the blueprint's `tech_stack` include a frontend framework AND does this feature involve UI changes or user-facing interactions? If both → include.

**Security Amigo:** Does this feature touch authentication, authorization, user input, sensitive data (PII, payments, medical), or external APIs? If yes → include.

## Step F2: Ronde 1 — Independent Analysis (parallel)

Build the crew roster from F1b. Include it in EVERY agent's prompt so they know who else is in the room.

Always dispatch Product, Developer, and Testing. Add Frontend and/or Security only if F1b says so.

<agent-dispatch>
Agent (subagent_type: "storyline:product-amigo"):
  prompt: |
    This is Ronde 1 — write your first analysis.

    ## The crew for this session:
    [Include crew roster from F1b]
    You are the Product Amigo. Stay in your lane — the others cover their specialties.

    ## Your notes from previous sessions:
    Read .storyline/personas/product-amigo.md (may not exist yet on first session).

    ## The feature to explore:
    [Feature description from the user]

    ## Project blueprint:
    Run `storyline summary`. Use `storyline view --context "<name>"` for full detail on relevant contexts.

    Write your findings to .storyline/workbench/amigo-notes/product.md
    Do NOT read the other amigos' notes yet — they haven't written theirs.
    Work from: [project directory]

Agent (subagent_type: "storyline:developer-amigo"):
  prompt: |
    This is Ronde 1 — write your first analysis.

    ## The crew for this session:
    [Include crew roster from F1b]
    You are the Developer Amigo. Stay in your lane.

    ## Your notes from previous sessions:
    Read .storyline/personas/developer-amigo.md (may not exist yet).

    ## The feature to explore:
    [Feature description from the user]

    ## Project blueprint:
    Run `storyline summary`. Use `storyline view --context "<name>"` for relevant contexts.

    Write your findings to .storyline/workbench/amigo-notes/developer.md
    Do NOT read the other amigos' notes yet.
    Work from: [project directory]

Agent (subagent_type: "storyline:testing-amigo"):
  prompt: |
    This is Ronde 1 — write your first analysis.

    ## The crew for this session:
    [Include crew roster from F1b]
    You are the Testing Amigo. Stay in your lane.

    ## Your notes from previous sessions:
    Read .storyline/personas/testing-amigo.md (may not exist yet).

    ## The feature to explore:
    [Feature description from the user]

    ## Project blueprint:
    Run `storyline summary`. Use `storyline view --context "<name>"` for relevant contexts.

    Write your findings to .storyline/workbench/amigo-notes/testing.md
    Do NOT read the other amigos' notes yet.
    Work from: [project directory]
</agent-dispatch>

**If Frontend Amigo included:**
<agent-dispatch>
Agent (subagent_type: "storyline:frontend-amigo"):
  prompt: |
    This is Ronde 1 — write your first analysis.
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

While agents work, share an insight with the user and ask a contextual question:

```
★ Insight ─────────────────────────────────────
[Quote about discovery, requirements, or multiple perspectives]

The amigos are doing their homework. While we wait, a question for you:
───────────────────────────────────────────────
```

Ask something relevant to the specific feature — "Are there terms your team uses that might not be in the glossary?", "Has this been attempted before?", "Who cares most about this feature?" — always with a "skip" option.

Wait for all agents to finish.

## Step F3: Ronde 2 — Discussion (parallel)

Each agent reads the others' notes and appends reactions to their own file. Also update persona memory.

**@mention convention:**
- `@developer-amigo`, `@product-amigo`, `@testing-amigo`, `@frontend-amigo` — directed at a specific amigo (they respond in Ronde 3)
- `@user` — question only the human can answer; the Facilitator surfaces these in Step F5
- `@mister-gherkin` — handover note for Phase 2

<agent-dispatch>
Agent (subagent_type: "storyline:product-amigo"):
  prompt: |
    This is Ronde 2 — read the others and react.
    Read: .storyline/workbench/amigo-notes/developer.md and testing.md
    (and frontend.md / security.md if present)
    Append reactions to .storyline/workbench/amigo-notes/product.md
    Update persona memory at .storyline/personas/product-amigo.md
    Use @mentions to direct questions. @user for human-only. @mister-gherkin for Phase 2 handovers.
    Work from: [project directory]

Agent (subagent_type: "storyline:developer-amigo"):
  prompt: |
    This is Ronde 2 — read the others and react.
    Read: .storyline/workbench/amigo-notes/product.md and testing.md
    (and frontend.md / security.md if present)
    Append reactions to .storyline/workbench/amigo-notes/developer.md
    Update persona memory at .storyline/personas/developer-amigo.md
    Use @mentions, @user, @mister-gherkin conventions.
    Work from: [project directory]

Agent (subagent_type: "storyline:testing-amigo"):
  prompt: |
    This is Ronde 2 — read the others and react.
    Read: .storyline/workbench/amigo-notes/product.md and developer.md
    (and frontend.md / security.md if present)
    Append reactions to .storyline/workbench/amigo-notes/testing.md
    Update persona memory at .storyline/personas/testing-amigo.md
    Use @mentions, @user, @mister-gherkin conventions.
    Work from: [project directory]
</agent-dispatch>

While agents discuss, share a brief insight about the value of different perspectives challenging each other. No question this time.

Wait for all agents to finish.

## Step F3b: Ronde 3 — @mention Responses (parallel)

Each amigo reads all notes and responds to `@mentions` directed at them.

<agent-dispatch>
Agent (subagent_type: "storyline:product-amigo"):
  prompt: |
    This is Ronde 3 — respond to @mentions directed at you.
    Read all amigo notes. Find every @product-amigo.
    Append responses to .storyline/workbench/amigo-notes/product.md under:
    ## Round 3 — Responses to @mentions
    If none: ## Round 3 — No @mentions for me.
    Work from: [project directory]

Agent (subagent_type: "storyline:developer-amigo"):
  prompt: |
    This is Ronde 3 — respond to @mentions directed at you.
    Read all amigo notes. Find every @developer-amigo.
    Append to .storyline/workbench/amigo-notes/developer.md under:
    ## Round 3 — Responses to @mentions
    Work from: [project directory]

Agent (subagent_type: "storyline:testing-amigo"):
  prompt: |
    This is Ronde 3 — respond to @mentions directed at you.
    Read all amigo notes. Find every @testing-amigo.
    Append to .storyline/workbench/amigo-notes/testing.md under:
    ## Round 3 — Responses to @mentions
    Work from: [project directory]
</agent-dispatch>

If Frontend Amigo was dispatched, also dispatch in Ronde 3 with the same pattern for `@frontend-amigo`.

While agents work, share a brief insight about the value of direct questions in a team setting.

Wait for all agents to finish.

## Step F4: Synthesize the Discussion

Read all amigo notes. Build the example map by:

1. **Extracting rules** from findings and top questions across all perspectives
2. **Creating examples** per rule — using concrete scenarios from the notes
3. **Listing open questions** — combining all, deduplicating, noting agreements/disagreements
4. **Flagging risks** — from all perspectives
5. **Highlighting the discussion** — where did they challenge each other? What changed in Ronde 2?
6. **Collecting @user mentions** — grep all notes for `@user`; these become Step F5 questions
7. **Collecting @mister-gherkin mentions** — grep for `@mister-gherkin`; pass to Mister Gherkin in Phase 2

## Step F5: Present to User

> "The three amigos have done their homework and discussed each other's work. Here's what they found:"

Show:
- Proposed rules (which persona surfaced them)
- Examples per rule
- Open questions (grouped by who can answer)
- Risks flagged
- Key disagreements between amigos (what they challenged)

Then ask the `@user` questions from the notes. Group them by amigo:
> "[Product Amigo] wants to know: [question]"
> "[Developer Amigo] wants to know: [question]"

## Step F6: Continue to Example Map

After presenting and collecting answers:
1. Run Steps 2d (Assumption Audit), 2e (Story Size Check), 3 (MoSCoW), 4 (Risks), and 4b (Stakeholder Check) from the main skill — using the synthesized content as input
2. Write `example-map.yaml` (see `./example-map-format.yaml` for format)
3. Commit and proceed to Mister Gherkin as in the main skill
