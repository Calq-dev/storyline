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
Ask MCQ: user-facing or technical? Ambiguous defaults user-facing.

**S4a (user-facing):** Reframe as user story ("As a [role] I want [action] so that [value]"), confirm → `Skill: storyline:three-amigos`

### S5: Technical task
Dispatch `Skill: storyline:the-brief`

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
- Full session mode (personas/ exist) + 5+ tasks → recommend The Crew
- Full session mode + <5 tasks → recommend Continue here
- No full session + 5+ tasks → recommend New session
- No full session + <5 tasks → recommend Continue here

### Step 3: Build choice MCQ
Options:
1. Save — commit `.storyline/`, come back later
2. Estimate first — `Skill: storyline:the-appraiser` → return to choice (minus estimate option)
3. [recommended ✓] Build now — continue in session
4. New session — commit, start fresh
5. The Crew — (only if personas/ exist) Developer + Testing Amigo, task by task

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