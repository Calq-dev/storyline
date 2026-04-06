# The Brief — Technical Task Intake

Structured intake for technical changes. Output: `technical-brief.yaml` as spec for The Onion.

**Pipeline position:** The Foreman → **The Brief** → The Onion

<HARD-GATE>
Do NOT explore the codebase. Run `storyline summary` for context. The blueprint IS your codebase context.
</HARD-GATE>

ALWAYS use AskUserQuestion for every question. ALWAYS use TodoWrite upfront.

Todos: read blueprint → ask what and why → ask how you know it's done → ask what could go wrong → check if visible impact → write brief → link blueprint → validate and commit → hand off

---

## Step 0: Read the Blueprint

```bash
storyline summary
```

If `.storyline/workbench/technical-brief.yaml` exists, read it — the user may be resuming.

---

## Step 1: Three Questions

**Q1 — What and why?**

Ask: "What do you want to change, and what's driving it?"

Free text. Becomes `task_description`.

**Q2 — How will you know it's done?**

Ask: "What needs to be true when this is finished?"

Free text or list. If the user gives nothing, ask again — this field cannot be empty.

**Q3 — What could go wrong?**

Ask: "Anything that could break, regress, or have unintended side effects?"

Free text. If "nothing" or "none", record as `["none identified"]`.

---

## Step 2: Visible Impact Check (conditional)

If Q1 mentions anything a user would notice — CLI output, file formats, agent behaviour, public API — ask:

```
AskUserQuestion: "How urgent is this?"
options:
  - "Now — something is broken or blocked without it"
  - "Soon — important but not blocking"
  - "Whenever — useful but no rush"
```

Record as `moscow` (must_have / should_have / could_have). Infer any quality concerns (performance, security, compatibility) from Q1 — don't ask separately.

If Q1 is purely internal (no visible change), skip this step.

---

## Step 3: Write technical-brief.yaml

Infer `scope` from Q1: single file/module → `single_file`; one area of the system → `single_context`; spans multiple areas or pipeline infrastructure → `cross_cutting`.

```yaml
id: brief-YYYY-MM-DD-<slug>
title: "<derived from Q1>"
created_at: "<ISO timestamp>"
subtype: pure_internal | scoped_technical
task_description: "<Q1>"
scope: single_file | single_context | cross_cutting
acceptance_criteria:
  - "<from Q2>"
risks:
  - "<from Q3>"
# scoped_technical only:
nfr_notes: "<inferred from Q1>"
moscow: must_have | should_have | could_have
```

Save to `.storyline/workbench/technical-brief.yaml`.

---

## Step 4: Blueprint Linking

If this change introduces a new command, register it:

```bash
storyline add-command \
  --context <ContextName> \
  --aggregate <AggregateName> \
  --name <CommandName> \
  --feature-files "technical-brief.yaml" \
  --spec-type "brief"
```

Pure internal changes with no new commands: leave blueprint unchanged.

---

## Step 5: Validate and Commit

```bash
storyline validate
storyline stamp
git add .storyline/workbench/technical-brief.yaml .storyline/blueprint.yaml
git commit -m "brief: <title>"
```

---

## Step 6: Hand Off

```
Skill: storyline:the-foreman
```
