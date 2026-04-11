# The Crew — Build Loop

```bash
echo "# Build Board\n" > .storyline/workbench/build-board.md
mkdir -p .storyline/workbench/build-briefs
```

**Before starting:** Check permission mode. If `default`, agents will be prompted for every file edit. Ask:

> "The crew needs to write code. Want me to switch to acceptEdits mode so the crew can work uninterrupted?"

---

## Context discipline (why this skill looks the way it does)

Every dispatched subagent is a cold start — no memory from earlier dispatches. The skill is structured to minimize what each dispatch has to re-read:

1. **Phase 0** runs once, reads everything, and leaves two durable artifacts behind: the failing test suite itself, and one `build-brief.yaml` per changeset task summarizing exactly what success means for that task. The design rationale (which edge cases were deferred, which invariants were skipped and why) lives in those briefs so later agents don't re-derive it.
2. **GREEN** dispatches read ONLY their brief + the named test files. They do NOT re-read the changeset, feature files, summary, or amigo-notes. The brief is the handoff.
3. **VERIFY** is conditional. It only fires when the brief explicitly lists `deferred_edge_cases` that still need tests. Otherwise the final code review catches the gaps.

Deviating from this (e.g. telling an agent to also read the changeset "for context") undoes the optimization and is the thing to push back on.

---

## Small-changeset fast path

If the changeset has **≤3 tasks**, skip dispatching Phase 0 to a subagent — the Foreman main agent writes the failing suite + briefs itself, inline. Rationale: the Phase 0 dispatch is the heaviest cold start in the pipeline, and for tiny changesets the main agent already has most of the relevant context from the Onion handoff. Proceed directly to the build loop once the suite is RED and briefs are written.

For ≥4 tasks use the dispatched Phase 0 below.

---

## TaskCreate scaffold

<TOOL-REQUIREMENTS>
Fetch task tools:
```
ToolSearch: select:TaskCreate,TaskUpdate,TaskGet
```

Create one upfront suite task, then linked tasks per changeset task. VERIFY tasks are created optimistically — they will be auto-completed without dispatch if the task's brief has no deferred edge cases.

```
TaskCreate — "SUITE: write failing acceptance + invariant suite + per-task briefs for [feature]"
# per changeset task:
TaskCreate — "GREEN [task-name]: Developer Amigo drives scoped tests green", addBlockedBy: [SUITE]
TaskCreate — "VERIFY [task-name]: Testing Amigo covers deferred edge cases", addBlockedBy: [GREEN]
```
</TOOL-REQUIREMENTS>

---

## Phase 0: Upfront failing test suite + build briefs

Dispatch one Testing Amigo for the whole changeset.

`TaskUpdate: SUITE task → in_progress`

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  Read persona memory: .storyline/personas/testing-amigo.md
  Read changeset: .storyline/changesets/<cs-filename>.yaml — you are writing tests for ALL tasks at once, not one task.
  Read every .feature file referenced by the changeset in .storyline/features/
  Read discovery notes: .storyline/workbench/amigo-notes/testing.md
  Run `storyline summary` for invariants and glossary.

  ## Part 1: Write the failing suite

  1. **Acceptance tests** — one failing acceptance test per scenario in every .feature file the changeset touches. Declarative step definitions (business actions, not UI). Match existing test style from `tech_stack`. Use exact glossary terms.
  2. **Invariant integration tests** — one test per in-scope invariant. Extract `bounded_contexts[X].aggregates[Y]` from `phases[].touches[]` across ALL phases. For each (X, Y): `storyline view --context X`, read `aggregates[Y].invariants[]`. Classify assertable vs architectural (skip architectural with reason). Write to `tests/integration/<context>_<aggregate>_invariants_test.<ext>`. Do NOT mock the aggregate, command handler, or domain service.
  3. Unit tests are NOT in scope — dev agents write those during their inner TDD loop.

  Run the suite. Every new test must fail for the right reason (missing symbols, compile errors, or assertion failures). Tighten anything that accidentally passes.

  ## Part 2: Write one build brief per changeset task

  For EACH task in the changeset, write `.storyline/workbench/build-briefs/<task-id>.yaml`. This is the ONLY handoff the Developer Amigo will read — the changeset, features, and summary are NOT re-read downstream. Make it complete.

  Schema:
  ```yaml
  task: T2
  name: "<task name from changeset>"
  one_liner: "<what this task does, business-language>"
  green_when:
    - "tests/acceptance/<feature>_steps.<ext>::<scenario name>"
    - "tests/integration/<context>_<aggregate>_invariants_test.<ext>::<test name>"
  files_in_scope:
    - src/<path>
  files_off_limits:
    - tests/acceptance/**
    - tests/integration/**
  glossary_terms:
    - <term>: <meaning in one clause>
  contracts:
    - "<command/event/interface this task must produce, with shape>"
  dependencies:
    - "depends on T1 for <what>"
  deferred_edge_cases:
    - id: concurrent_add_remove
      reason: "race on cart.items — cover in VERIFY, needs impl first"
    - id: currency_rounding
      reason: "out of scope — flagged as gap, not for VERIFY"
  framework_notes:
    - "use context7 for <library> docs"
  ```

  Rules for briefs:
  - `green_when` MUST be complete — if a test isn't listed, the dev agent won't run it.
  - `deferred_edge_cases` with empty list means VERIFY will be skipped entirely for this task. Only list items that actually need a test written after implementation exists. Out-of-scope concerns go in the `reason` field with "not for VERIFY" so the Foreman knows to drop it.
  - `files_off_limits` always includes the upfront test directories — dev agents must not edit your tests.
  - Prefer quoting glossary/contract text verbatim from blueprint over paraphrasing.

  ## Commit
  `git add tests/ .storyline/workbench/build-briefs/`
  `git commit -m "test: failing suite + build briefs for [feature]"`

  Report back:
  - N acceptance tests, N invariant tests (N skipped architectural, N already covered)
  - N briefs written, of which M have deferred edge cases (VERIFY will fire M times)
  - Confirmed RED

  Update .storyline/workbench/build-board.md per build board conventions.
  Use context7 for test framework docs.
  Work from: [project directory]
</agent-dispatch>

`TaskUpdate: SUITE task → completed` — surface one Murphy critique before entering the build loop.

**After Phase 0:** for each task whose brief has `deferred_edge_cases: []`, auto-complete the VERIFY task immediately (no dispatch). Only tasks with deferred items keep their VERIFY task pending.

---

## The Build Loop (per task)

For each task in the implementation changeset:

### 1. Developer Amigo implements (GREEN)

`TaskUpdate: GREEN task → in_progress`

<agent-dispatch subagent_type="storyline:developer-amigo">
prompt: |
  Read persona memory: .storyline/personas/developer-amigo.md
  Read your brief: .storyline/workbench/build-briefs/<task-id>.yaml
  Read only the test files listed in `green_when`.
  Read .storyline/workbench/build-board.md (short — scan for entries affecting your task id).

  Do NOT read: changeset, feature files, blueprint summary, amigo-notes. Everything you need is in the brief. If something critical is missing from the brief, post on the build board as "brief-gap" and stop.

  ## How to build
  - All tests in `green_when` are currently RED. Drive them to GREEN.
  - Inner loop TDD for components you create: failing unit test → simplest pass → refactor. Unit tests go next to the code, not in `tests/acceptance/` or `tests/integration/`.
  - Stay inside `files_in_scope`. Never touch `files_off_limits`.
  - Use exact `glossary_terms` in identifiers.
  - Use context7 for framework/library docs (see `framework_notes`).
  - Commit: `git commit -m "feat: [feature] — [task name] green"`

  Report back: which tests in green_when are now passing, any brief-gaps posted, files touched.
  Work from: [project directory]
</agent-dispatch>

### 2. Testing Amigo covers deferred edge cases (VERIFY — conditional)

**Skip this step entirely if the brief's `deferred_edge_cases` is empty.** Auto-complete the VERIFY task and move to Murphy.

Otherwise:

`TaskUpdate: GREEN task → completed` · `TaskUpdate: VERIFY task → in_progress`

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  Read persona memory: .storyline/personas/testing-amigo.md
  Read your brief: .storyline/workbench/build-briefs/<task-id>.yaml
  Run `git diff HEAD~1` — see what the Developer built.

  Do NOT read: changeset, feature files, blueprint summary, amigo-notes. The brief is authoritative for what needs writing.

  ## Scope
  For each item in `deferred_edge_cases` (skip items whose reason starts with "not for VERIFY"):
  1. Write the test where it naturally belongs (extend existing test file, or add a new one next to related tests).
  2. Verify it goes RED against a temporarily broken assumption, then GREEN against the real implementation.
  3. If an item is impossible to test at this level, log it as a gap on the build board and move on.

  If implementation revealed a new or changed invariant, update the matching invariant integration test in place — never duplicate.

  Commit: `verify: deferred edge cases for [feature] — [task name]`
  Report back: which deferred ids were covered, which were dropped and why.
  Work from: [project directory]
</agent-dispatch>

### 3. (Optional — complex features) Product Amigo validates

Only for user-facing features where behavior match matters. The Product Amigo reads only the brief + the feature file(s) named in it — same context-discipline rules.

<agent-dispatch subagent_type="storyline:product-amigo">
prompt: |
  Read your brief: .storyline/workbench/build-briefs/<task-id>.yaml
  Read only the .feature file(s) referenced from `green_when`.
  Does the delivered behavior match what we discussed during the Amigo session? Flag mismatches only — no praise.
  Work from: [project directory]
</agent-dispatch>

### 4. Murphy + move to next task

`TaskUpdate: VERIFY task → completed` (or auto-completed if skipped)

Surface one Murphy critique — pick the sharpest note logged since the last phase. Present as AskUserQuestion.

Update the in-progress todo:
`Foreman: task [N] of [total] — walls are going up`

---

## After All Tasks Complete

<branch-todos id="after-build">
- Foreman: building's done — running code review
- Foreman: updating blueprint to match what was actually built
- Foreman: archiving the session
</branch-todos>

### Code review

Dispatch a fresh agent — not the Foreman. Clean context = better review.

<agent-dispatch>
prompt: |
  You are reviewing code that was just built. No persona, no role-play — just review the code.

  ## Load context
  1. Read `.storyline/changesets/<cs-filename>.yaml` — what was planned
  2. Run `git diff HEAD~[task count]` — what was built
  3. Read `.storyline/features/*.feature` — what behavior was specified
  4. Run `storyline summary` — blueprint invariants and glossary
  5. Skim `.storyline/workbench/build-briefs/*.yaml` — what each task's contract actually was (briefs may have drifted from the changeset during build)

  ## Review passes (run sequentially)

  | Pass | Check | Skip |
  |---|---|---|
  | **Correctness** | Logic bugs, null handling, error handling gaps | Style, naming, formatting |
  | **Invariants** | Every `invariants[]` from blueprint holds in the code | Generic suggestions |
  | **Cross-file impact** | Broken assumptions, call sites, type contracts | Praise |
  | **Security** | Injection, hardcoded secrets, auth gaps — mandatory if touching user input or external APIs | Low-risk utility code |
  | **Test completeness** | Uncovered code paths and sad paths from feature files; also: for any task where VERIFY was auto-skipped, spot-check that no silent edge cases slipped through | Style preferences |
  | **Glossary** | Code identifiers match `glossary[]` exactly | |

  Only flag high-confidence issues. Every finding: severity (blocking/warning/nit), file:line, what's wrong, fix.

  Work from: [project directory]
</agent-dispatch>

**Blocking findings → fix before proceeding. Warnings and nits → present to user.**

### As-built blueprint update

Compare changeset plan vs actual diff. Update `blueprint.yaml` to match reality:
- Changed payloads, invariants, glossary → edit directly
- New structures discovered during build → `storyline add-command`, `storyline add-event`, etc.
- Planned but not implemented → `storyline add-gap --description "Planned <X> not built" --severity "important" --affects "<Ctx>"`
- Scenarios that drifted → dispatch Mister Gherkin to update feature files
- Never delete existing entries — reconcile and extend

```bash
storyline validate
storyline stamp
```

New ideas → `.storyline/backlog/`. Gaps → `storyline add-gap`.

### Archive the session

<bash-commands>
```bash
storyline archive --feature "<feature name>"
git add .storyline/sessions/ .storyline/
git commit -m "refine: code review + as-built update for [feature name]"
storyline housekeeping --cleanup
git add .storyline/
git commit -m "chore: workbench cleanup after [feature name]"
```
</bash-commands>

Housekeeping note: `.storyline/workbench/build-briefs/` is workbench — cleaned up on archive.
