# Skill Authoring Conventions

All skills follow YAML frontmatter + structured Markdown with XML tags for machine-parseable elements.

## File Structure

```
---
name: skill-name
description: one-line description used for skill matching
argument-hint: "[optional args]"   # optional
---

# Skill Title

<HARD-GATE>           ← constraints Claude must never violate
...
</HARD-GATE>

<todo-actions>        ← ALL todos to create at skill start (pending except first = in_progress)
...
</todo-actions>

[prose: who you are, your philosophy]

## Step N: ...

<bash-commands>       ← bash to run at this step
```bash
...
```
</bash-commands>

<user-question id="unique-id">   ← AskUserQuestion block
...
options:
  - "Option A"
  - "Option B"
</user-question>

<agent-dispatch>      ← Agent tool invocation
subagent_type: "storyline:some-agent"
prompt: |
  ...
</agent-dispatch>

<branch-todos id="scenario-name">  ← todos to create when entering this branch (all at once)
- Skill: doing thing A
- Skill: doing thing B
</branch-todos>
```

---

## XML Tag Reference

### `<HARD-GATE>`
Hard constraints. Claude must stop and report if it cannot comply.
Already in use — do not rename.

### `<todo-actions>`
**Create ALL listed todos at skill start** — the first as `in_progress`, the rest as `pending`.
This gives the user a full roadmap upfront instead of a rolling single-task view.
Use `Skill Name:` prefix in character.

```xml
<todo-actions>
- Foreman: checking the site
- Foreman: applying decision tree
- Foreman: putting the amigos on the case
</todo-actions>
```

### `<branch-todos id="...">`
Todos specific to a conditional branch. When entering that branch, create **all** branch todos
at once (replacing the generic "applying decision tree" todo with the specific ones).
The `id` matches the scenario or branch name for traceability.

```xml
<branch-todos id="scenario-feature">
- Foreman: framing the feature as a user story
- Foreman: putting the amigos on the case
</branch-todos>
```

### `<user-question id="...">`
An `AskUserQuestion` MCQ block. The `id` is a short slug for the question.
Write the question and options in natural language — Claude formats the actual MCQ call.

```xml
<user-question id="session-mode">
How would you like to explore this feature?
options:
  - "Quick scan — I'll look at it from all three perspectives (faster)"
  - "Full session — Three independent personas prepare and discuss (more thorough)"
</user-question>
```

### `<bash-commands>`
Bash to run at this point in the flow. Wraps existing ```bash fences for discoverability.
Claude should run these commands, not skip them.

```xml
<bash-commands>
```bash
storyline session-init 2>/dev/null || true
storyline summary 2>/dev/null || echo "no blueprint yet"
```
</bash-commands>
```

### `<agent-dispatch>`
Dispatches a subagent via the Agent tool. Include subagent_type and the full prompt.

```xml
<agent-dispatch subagent_type="storyline:surveyor">
prompt: |
  Execute a full survey for this project.
  Initialize .storyline/blueprint.yaml with all findings.
</agent-dispatch>
```

---

## Upfront Todo Rule

**Every skill must create ALL its todos at the start**, not one at a time.

- Linear skills (The Onion, Mister Gherkin, The Scout): list every step in `<todo-actions>`
- Branching skills (The Foreman, Three Amigos): list the known first steps in `<todo-actions>`,
  then use `<branch-todos id="...">` to add branch-specific todos all at once when branching.

Never add a single todo mid-flow without also creating the remaining todos for that branch.

---

## Agent & Prompt Writing Style

**Caveman English.** Keep agent instructions and dispatch prompts short. The model knows BDD, TDD, DDD, outside-in testing, blueprints, etc. from training — don't explain concepts it already understands.

Write:
- File paths, commands, output locations
- Constraints and hard gates (what NOT to do)
- Patterns it can't infer (shared notes format, task chaining, @mention conventions)

Don't write:
- Why something works ("you just built it so you have context")
- How standard practices work ("outside-in means acceptance test first, then unit tests, then implementation")
- Motivation ("this saves tokens because...")

**Example — too verbose:**
```
After all tasks are green, you update the blueprint to match reality — you just built it,
so you have the context. Compare the changeset with what you actually implemented:
- Changed payloads, invariants, glossary → edit blueprint directly
- New structures → use CLI helpers (`storyline add-command`, `storyline add-aggregate`, etc.)
```

**Example — caveman English:**
```
Compare changeset vs what you built. Update `blueprint.yaml`:
- Changed payloads/invariants/glossary → edit directly
- New structures → CLI helpers (`storyline add-command`, etc.)
```

---

## Frontmatter Fields

| Field | Required | Description |
|---|---|---|
| `name` | yes | Matches plugin.json skill name |
| `description` | yes | Used by Claude for skill matching — be specific |
| `argument-hint` | no | Shown in `/help` output |
