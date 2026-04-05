# Implementation Plan: Blueprint Views & Enforced Housekeeping

Generated from blueprint.yaml v4 on 2026-04-05

## Scenario Execution Order

This is a **tooling feature** — no domain aggregates or application code to build. The implementation targets are:
- `scripts/blueprint.py` (CLI commands)
- `scripts/test_blueprint.py` (tests)
- `hooks/hooks.json` (hook configuration)
- `skills/*/SKILL.md` + `agents/*.md` (convention updates)

### Task 1: `blueprint summary` CLI command
Priority: must-have | Scenarios: R1-E1, R1-E4, R6-E1
Why first: this is the walking skeleton — once summary works, agents can start using it immediately. All other tasks build on this.

**What to build:**
- `cmd_summary(args, cwd)` in `scripts/blueprint.py`
- Reads the full blueprint, outputs a compact view to stdout:
  - `meta` section (project, version, dates)
  - `tech_stack` section (as-is)
  - Per bounded context: name, description (first sentence), aggregate names with command/event counts
  - Relationships between contexts (type + target)
  - Glossary terms (term + context + meaning, one line each)
- Does NOT include: individual commands, events, policies, payload fields, gaps, questions, invariants
- Target output: ~80-120 lines for a 2500-line blueprint

**Tests to write:**
- `test_summary_shows_context_names_and_aggregate_counts` — init + add-context + add-aggregate, verify summary includes names and counts
- `test_summary_excludes_commands_and_events` — add commands/events, verify they don't appear in summary
- `test_summary_includes_glossary` — add glossary term, verify it appears
- `test_summary_on_empty_blueprint` — fresh init, verify summary works with minimal content

**Files:** `scripts/blueprint.py`, `scripts/test_blueprint.py`

### Task 2: `blueprint view --context X` CLI command
Priority: must-have | Scenarios: R1-E2, R1-E5, R6-E2
Why next: complements summary — agents escalate from summary to view for targeted work.

**What to build:**
- `cmd_view(args, cwd)` in `scripts/blueprint.py`
- `--context` argument: name of bounded context to display
- Outputs the full bounded context YAML block + relevant extras:
  - The complete context entry (all aggregates, commands, events, policies, invariants, relationships)
  - Glossary terms where `context` matches the requested context
  - Relationship targets mentioned by this context (just the target names, not their full content)
- If context not found: error message listing available context names, exit 1

**Tests to write:**
- `test_view_shows_full_context` — verify full context content in output
- `test_view_includes_relevant_glossary` — verify glossary terms for the context appear
- `test_view_nonexistent_context_lists_available` — verify error message includes context names
- `test_view_on_blueprint_with_multiple_contexts` — verify only the requested context appears

**Files:** `scripts/blueprint.py`, `scripts/test_blueprint.py`

### Task 3: `blueprint housekeeping` CLI command
Priority: must-have | Scenarios: R2-E1, R2-E2, R2-E3, R2-E4
Why next: the core enforcement mechanism — validate + stamp in one command.

**What to build:**
- `cmd_housekeeping(args, cwd)` in `scripts/blueprint.py`
- Without flags: validate, then stamp if valid. If already up-to-date (no changes since last stamp), report "Blueprint already up to date" and skip stamp.
- With `--cleanup`: after validate+stamp, check `.storyline/workbench/` for uncommitted files via `git status`. If uncommitted changes exist, refuse with error. If all committed, remove workbench files (but never remove directories that are empty already).
- With `--cleanup --phase <name>`: only remove artifacts belonging to that phase. Phase-to-artifact mapping:
  - `three-amigos`: `workbench/amigo-notes/`
  - `mister-gherkin`: (no workbench artifacts to clean — output goes to features/)
  - `sticky-storm`: `workbench/events-raw.md`
  - `doctor-context`: (no workbench artifacts)
  - `all`: all of the above
- Detect "already up-to-date" by comparing `meta.updated_at` with today's date AND checking if blueprint has been modified since last stamp (via git: `git diff --name-only .storyline/blueprint.yaml` returns empty).

**Tests to write:**
- `test_housekeeping_validates_and_stamps` — verify version increments
- `test_housekeeping_fails_on_invalid_blueprint` — verify exit code 1, no stamp
- `test_housekeeping_already_up_to_date` — stamp, then housekeeping again, verify "already up to date"
- `test_housekeeping_idempotent` — two calls in a row, second is no-op
- `test_housekeeping_cleanup_refuses_uncommitted` — create workbench file without committing, verify refusal (this test needs git init in tmpdir)
- `test_housekeeping_invalid_phase_name` — verify error on unknown phase

**Files:** `scripts/blueprint.py`, `scripts/test_blueprint.py`

### Task 4: Extend PostToolUse hook for Bash blueprint calls
Priority: must-have | Scenarios: R3-E1, R3-E2, R3-E3, R3-E4
Why next: closes the validation gap — catches CLI mutations that Edit/Write hooks miss.

**What to build:**
- Update PostToolUse hook in `hooks/hooks.json`:
  - Current matcher: `Edit|Write`
  - New matcher: `Edit|Write|Bash`
  - For Bash calls: parse `tool_input` to check if the command contains `blueprint add-` or `blueprint stamp` (mutation commands)
  - Skip validation for read-only commands: `blueprint summary`, `blueprint view`, `blueprint validate`
  - Handle chained commands: check if `blueprint add-` or `blueprint stamp` appears anywhere in the command string

**Implementation detail:**
The PostToolUse hook receives tool_input via stdin as JSON. For Bash, the `command` field contains the shell command. Parse it with a simple grep for `blueprint add-\|blueprint stamp` (mutation indicators).

**Tests:** Manual testing — hooks are not unit-testable. Verify by running the hook command in isolation:
```bash
echo '{"tool_input":{"command":"blueprint add-context Payment"}}' | <hook-command>
```

**Files:** `hooks/hooks.json`

### Task 5: Update skills and agents for summary-first convention
Priority: must-have | Scenarios: R6-E1, R6-E2, R6-E3
Why: the summary/view CLI is useless if skills don't use it. This is the largest task — many files, but each change is small.

**What to change:**
Every skill/agent that starts with "Read `.storyline/blueprint.yaml`" needs to change to:
- **Summary-first agents** (read `blueprint summary` output): The Foreman, The Scout, Product Amigo, The Appraiser
- **Context-view agents** (read summary, then `blueprint view --context X`): Developer Amigo, Testing Amigo, Mister Gherkin, The Onion, Frontend Amigo, Security Amigo
- **Full-read agents** (read full `blueprint.yaml`): Sticky Storm, Doctor Context

Also add the decision tree convention to CLAUDE.md.

**Files to update:**
- `skills/the-foreman/SKILL.md` — summary-first
- `skills/the-scout/SKILL.md` — summary-first
- `skills/three-amigos/SKILL.md` — summary for facilitator, view for persona agents
- `skills/mister-gherkin/SKILL.md` — view for relevant context
- `skills/the-onion/SKILL.md` — view for implementation context
- `skills/the-appraiser/SKILL.md` — summary-first
- `agents/developer-amigo.md` — view for relevant context
- `agents/testing-amigo.md` — view for relevant context
- `agents/product-amigo.md` — summary-first
- `agents/frontend-amigo.md` — view for relevant context
- `agents/security-amigo.md` — view for relevant context
- `agents/sticky-storm.md` — full read (event uniqueness)
- `agents/doctor-context.md` — full read (cross-context modeling)
- `agents/foreman.md` — summary-first
- `agents/surveyor.md` — full read (needs to see everything)
- `CLAUDE.md` — add decision tree convention

### Task 6: Add housekeeping todo step to every skill
Priority: must-have | Scenarios: R2-E1 through R2-E4
Why: makes housekeeping visible and enforceable through the todo list.

**What to change:**
Every skill's TodoWrite section needs a final item:
```
{ content: "[Skill]: housekeeping — validate, stamp, done", status: "pending", activeForm: "Running housekeeping" }
```

And a corresponding step at the end of the skill that runs `blueprint housekeeping`.

**Files to update:**
- `skills/the-foreman/SKILL.md`
- `skills/the-scout/SKILL.md`
- `skills/three-amigos/SKILL.md`
- `skills/mister-gherkin/SKILL.md`
- `skills/the-onion/SKILL.md`
- `skills/the-appraiser/SKILL.md`

### Task 7: Move estimation report output to plans/
Priority: should-have | Scenario: R5-E1
Why: estimation reports are stakeholder artifacts, not transient workbench docs.

**What to change:**
- `skills/the-appraiser/SKILL.md` — change output path from `workbench/estimation-report.md` to `plans/YYYY-MM-DD-estimation-<feature>.md`

**Files:** `skills/the-appraiser/SKILL.md`

## Component Inventory

| Component | Type | Tasks | Path |
|---|---|---|---|
| `cmd_summary` | CLI command | T1 | `scripts/blueprint.py` |
| `cmd_view` | CLI command | T2 | `scripts/blueprint.py` |
| `cmd_housekeeping` | CLI command | T3 | `scripts/blueprint.py` |
| PostToolUse hook (Bash) | Hook config | T4 | `hooks/hooks.json` |
| 7 skills | Convention update | T5, T6 | `skills/*/SKILL.md` |
| 8 agents | Convention update | T5 | `agents/*.md` |
| `CLAUDE.md` | Documentation | T5 | `CLAUDE.md` |
| Test suite | Tests | T1, T2, T3 | `scripts/test_blueprint.py` |

## Dependency Graph

```
Task 1: blueprint summary     ← no dependencies
Task 2: blueprint view        ← no dependencies (parallel with T1)
Task 3: blueprint housekeeping ← no dependencies (parallel with T1, T2)
Task 4: PostToolUse hook       ← no dependencies (parallel)
Task 5: summary-first skills   ← depends on T1, T2 (skills reference the commands)
Task 6: housekeeping todos     ← depends on T3 (skills reference the command)
Task 7: estimation report path ← no dependencies
```

Tasks 1-4 can be built in parallel. Tasks 5-6 depend on 1-3. Task 7 is independent.

## Test Strategy

All new CLI commands are tested via `scripts/test_blueprint.py` using the existing subprocess pattern (`run(args, cwd=tmpdir)`). No new test infrastructure needed.

Hook changes are tested manually by running the hook command with mock JSON input.

Skill/agent changes are text-only — no automated tests, verified by `blueprint validate` (ensures feature_files references are correct).

## Risk Spots

- **GAP-001**: No automated test coverage for scaffold.py — not affected by this feature
- **Q1 (summary contents)**: Resolved by best_guess from Three Amigos — context names + descriptions + aggregate names + counts + relationships + glossary. No commands/events/policies/gaps/questions.
- **"Already up to date" detection**: Need to compare `meta.updated_at` with current state. Simplest approach: if `updated_at` is today AND `git diff` shows no blueprint changes, it's up to date.
