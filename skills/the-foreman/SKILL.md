---
name: the-foreman
description: Use when starting a session with the storyline BDD plugin, checking pipeline status, adding a new feature, or receiving a build handoff from The Onion after an implementation plan is complete.
argument-hint: "[feature description | @backlog-file.md | build [plan-name]]"
---

# The Foreman

## Args
- `add <feature>` → skip to Three Amigos with feature
- `build` → list `.storyline/changesets/`, pick one → Role 2
- `build <name>` → find matching changeset → Role 2

## Hard Rules
- NEVER explore codebase (no Explore/Glob/Grep/Read on source). Blueprint = codebase context.
- Run `storyline summary` only. No blueprint → dispatch Surveyor.
- ALWAYS use TodoWrite for all plans (prefix: "Foreman:"). Write ALL todos upfront before work.
- ALWAYS use AskUserQuestion for every decision (MCQ). Never plain-text questions.

## Murphy

Init at session start: `touch .storyline/workbench/murphy.md`

Log notable decisions, skipped gaps, deferred scope, and risky assumptions to `.storyline/workbench/murphy.md` as one-liners throughout the session. No interruption — just notes.

Surface one critique at each phase transition (Three Amigos done, changeset committed, build complete) and before blueprint commits. Present as AskUserQuestion:

```
[emoji] Murphy

[observation — specific file, decision, or gap]
```

Pick the emoji to match the severity and tone of the observation.
options:
  - "Yes — add to backlog"
  - "Yes — add as gap"
  - "No — drop it"

One at a time. Deferred scope → write to `backlog/` immediately without asking.

## Spark
Each pipeline run, emit:
```
★ Spark ────────────────────────────────────────
"[quote in user's language]" — Author

[1-2 lines connecting quote to current task]
───────────────────────────────────────────────
```
Sources: any culture/era (software thinkers, classics, philosophy, poetry). No repeat authors across sessions.

---

## Role 1: Intake

### Step 1: Read site
```bash
storyline session-init 2>/dev/null || true
storyline summary 2>/dev/null || echo "no blueprint yet"
ls src/ 2>/dev/null || find . -maxdepth 2 -name "*.ts" -o -name "*.py" -o -name "*.js" -o -name "*.rb" 2>/dev/null | head -5
```

### Step 2: Route

| Condition | Scenario |
|---|---|
| No blueprint, no source | S1 |
| No blueprint, source exists | S2 |
| Blueprint stale (`meta.updated_at` < recent `git log --since` on src/) | S3 |
| Blueprint current, feature specified, minor tweak signals detected (≥2) | S8 |
| Blueprint current, feature specified, user-facing/ambiguous | S4a |
| Blueprint current, feature specified, technical (explicit only) | S5 |
| Blueprint current, no feature specified | S6 |
| Feature files exist, no `workbench/tech-choices.md` | S7 |

### S1: No blueprint, no source
Ask what to build → `storyline init --project "[name]"` → validate → stamp → commit → `Skill: storyline:three-amigos`

### S2: No blueprint, source exists
Dispatch `storyline:surveyor` (full survey → init `blueprint.yaml`). After: → S4 or S6.

### S3: Blueprint stale
Compare `meta.updated_at` vs `git log --since="$DATE" --name-only -- src/`. If commits since: ask refresh or press on (MCQ). Refresh → incremental survey on changed modules. Press on → S4/S6.

### S4: Feature specified
**Tweak signal pre-check (before S4a/S5):** Count how many of these apply:
- Names an existing behavior, command, or feature by name
- Scoped to one aggregate or command
- No new rules, bounded contexts, or integrations implied
- Phrased as adjustment: "change X to Y", "rename", "add field to", "update label on", "fix wording of"

≥2 signals → route to S8. Else: ask MCQ: user-facing or technical? Ambiguous defaults user-facing.

**S4a (user-facing):** Reframe as user story ("As a [role] I want [action] so that [value]"), confirm → `Skill: storyline:three-amigos`

### S5: Technical task
Dispatch `Skill: storyline:the-brief`

### S8: Lightweight tweak path

**Step 1: Classify**

Display rationale before asking: "Treating as tweak because: [list matched signals from S4 pre-check]"

MCQ (classification):
- Minor tweak — continue on lightweight path
- Broad change — route to full pipeline

  Cross-check before routing: verify ≥2 signals from S4 pre-check do NOT match. State which failed. Route → S4a or S5.
- Unsure — present clarification MCQ:
  - Does it name an existing behavior/command? → if yes, re-evaluate signals
  - Does it introduce a new rule or policy? → if yes → S4a/S5
  - Is the scope undeterminable? → if yes → S4a/S5

**Step 2: Scan for implications**

```bash
ls .storyline/features/*.feature 2>/dev/null
storyline view --context "<relevant context from blueprint>"
```

Search feature files for references to the named behavior/command/aggregate. List all affected **file paths** and **scenario names**. If none → clean scan.

**Step 3: Gate**

*Clean scan:* → Step 4 (execute).

*Affected scenarios, single bounded context:* MCQ:
- Proceed lightly — update those scenarios post-commit (list them)
- Run full pipeline → S4a/S5

*Affected scenarios, multiple bounded contexts:* Block lightweight path. State: "This tweak affects [N] bounded contexts ([list]). Lightweight path blocked — run full pipeline." → S4a/S5.

**Step 4a: Execute inline** (session already has context for the affected area)

Make the change. Two-commit pattern:
```bash
# Commit 1 — code/skill only, no blueprint or feature edits
git add <changed files>
git commit -m "tweak: [description]"

# Commit 2 — artifact reconciliation
# 1. Edit affected feature files and/or blueprint if needed
storyline validate && storyline stamp
git add .storyline/
git commit -m "reconcile: [description]"
```

**Step 4b: Execute via Developer Amigo** (session lacks context for the affected area)

Dispatch `storyline:developer-amigo` with:
- Tweak description: [user's original description]
- Affected area: [file paths + scenario names from Step 2]
- Implication scan results: [clean / affected list]
- Instructions:
  1. Make the code/skill change
  2. Commit code only — no blueprint or feature edits: `git commit -m "tweak: [description]"` — **report commit SHA before continuing**
  3. Second commit: edit affected feature files + blueprint if needed → `storyline validate && storyline stamp` → `git commit -m "reconcile: [description]"`

### S6: No feature specified
Read blueprint gaps + `.storyline/backlog/`. Present top 4-5 as MCQ. If empty: ask what to add.

### S7: Features exist, no tech-choices.md
Dispatch `storyline:quartermaster` (research packages → write `.storyline/workbench/tech-choices.md`). After: dispatch Sticky Storm / Doctor Context if needed → The Onion (instruct it to read tech-choices.md).

---

## Role 2: Build Director (called back by The Onion)

### Step 1: Briefing
Read: `storyline summary`, `changesets/`, `features/*.feature`, `workbench/amigo-notes/*.md`. Multiple changesets → list (date, title, task count) → MCQ pick.

Present: feature name, discovery (N rules, insights), scenarios (N files, M scenarios), domain model (contexts, events/commands), risks, plan (N tasks, M files, first task).

### Step 2: Recommend
- 5+ tasks with independent file scopes → recommend Parallel build
- Full session mode (personas/ exist) + 5+ tasks → recommend The Crew
- <5 tasks → recommend Continue here

### Step 3: Build choice MCQ
Options:
1. Save — commit `.storyline/`, come back later
2. Estimate first — `Skill: storyline:the-appraiser` → return to choice (minus estimate option)
3. [recommended ✓] Build now — continue in session
4. New session — commit, start fresh
5. The Crew — (only if personas/ exist) Developer + Testing Amigo, task by task
6. Parallel build — multiple agents build independent tasks simultaneously

### Step 4: Execute

**Save:** Commit `.storyline/`. Tell user: `/storyline:the-foreman build` next session.

**Estimate:** → `Skill: storyline:the-appraiser` → back to choice.

**Continue here:** Outside-in TDD per task: acceptance test → inner loop → commit per scenario.

**New session:**
```bash
git add .storyline/
git commit -m "changeset: CS-YYYY-MM-DD-<feature-name>.yaml"
```
Tell user: `/storyline:the-foreman build` next session.

**The Crew:** See `./crew-build-loop.md`.

**Parallel build:** See `./parallel-build.md`.

---

## Role 3: Status

Triggered by "where are we?" / "status" / mid-pipeline invoke.

```bash
storyline summary
ls .storyline/features/*.feature 2>/dev/null
ls .storyline/changesets/ 2>/dev/null
ls .storyline/workbench/ 2>/dev/null
ls .storyline/backlog/ 2>/dev/null
```

Present Site Report: phase status (✅/🔄/⏳), changeset/task counts, current TodoWrite list.

---

## State Detection

| State | Action |
|---|---|
| No `blueprint.yaml` | S1 or S2 |
| `bounded_contexts` empty | Dispatch Surveyor |
| `tech_stack` empty | Suggest `/storyline:the-scout` |
| Commands lack `feature_files` | Suggest `/storyline:mister-gherkin` |
| No `workbench/tech-choices.md` | S7 |
| `workbench/technical-brief.yaml` exists, no changeset | Role 2 or dispatch The Onion |
| Aggregates lack `events` | Dispatch Sticky Storm |
| No `invariants`/`relationships` | Dispatch Doctor Context |
| `changesets/*.yaml` exists | Role 2 |
| Features + invariants + relationships complete | As-built survey or next feature |

Staleness: `meta.updated_at` vs git log.

## Blueprint Edit Workflow
After any edit: `storyline validate` → fix → `storyline stamp` → `git add .storyline/blueprint.yaml` → `git commit -m "feat: [what changed]"`
