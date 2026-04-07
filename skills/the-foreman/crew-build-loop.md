# The Crew — Build Loop

```bash
echo "# Build Board\n" > .storyline/workbench/build-board.md
```

**Before starting:** Check permission mode. If `default`, agents will be prompted for every file edit. Ask:

> "The crew needs to write code. Want me to switch to acceptEdits mode so the crew can work uninterrupted?"

<TOOL-REQUIREMENTS>
**Fetch TaskCreate, TaskUpdate, and TaskGet before starting the loop:**
```
ToolSearch: select:TaskCreate,TaskUpdate,TaskGet
```

For each task in the changeset, create three linked tasks upfront:
```
TaskCreate — "RED [task-name]: Testing Amigo writes failing test"
TaskCreate — "GREEN [task-name]: Developer Amigo implements", then TaskUpdate addBlockedBy: [RED task id]
TaskCreate — "VERIFY [task-name]: Testing Amigo confirms + edge cases", then TaskUpdate addBlockedBy: [GREEN task id]
```

Then set the first RED task `in_progress` before dispatching.
Update each task's status (`in_progress` → `completed`) as agents report back.
</TOOL-REQUIREMENTS>

---

## The Build Loop (per task)

For each task in the implementation changeset:

### 1. Testing Amigo writes the acceptance test (RED)

`TaskUpdate: RED task → in_progress`

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  Read persona memory: .storyline/personas/testing-amigo.md
  Read changeset: .storyline/changesets/<cs-filename>.yaml — identify next pending task and its Gherkin scenario(s) in .storyline/features/
  Read discovery notes: .storyline/workbench/amigo-notes/testing.md

  Write the acceptance test BEFORE any implementation exists. Verify RED, commit, report back.
  Use context7 for test framework docs.
  Update .storyline/workbench/build-board.md per build board conventions.
  Work from: [project directory]
</agent-dispatch>

### 2. Developer Amigo implements (GREEN)

`TaskUpdate: RED task → completed` · `TaskUpdate: GREEN task → in_progress`

<agent-dispatch subagent_type="storyline:developer-amigo">
prompt: |
  Read persona memory: .storyline/personas/developer-amigo.md
  Read changeset: .storyline/changesets/<cs-filename>.yaml — next pending task
  Read discovery notes: .storyline/workbench/amigo-notes/developer.md

  The acceptance test is failing. Implement until GREEN. Commit, report back.
  Use context7 for framework/library docs.
  Update .storyline/workbench/build-board.md per build board conventions.
  Work from: [project directory]
</agent-dispatch>

### 3. Testing Amigo verifies and adds edge cases

`TaskUpdate: GREEN task → completed` · `TaskUpdate: VERIFY task → in_progress`

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  Read persona memory: .storyline/personas/testing-amigo.md
  Run `git diff HEAD~1` — see what the Developer built.
  Read discovery notes: .storyline/workbench/amigo-notes/testing.md

  Confirm acceptance test is GREEN. Are the edge cases you flagged during discovery covered?
  Add missing tests, commit, report back.
  Use context7 for test framework docs.
  Update .storyline/workbench/build-board.md per build board conventions.

  ## Invariant integration tests

  Write one integration test per in-scope invariant:

  **Pre-check:** If `phases[].touches[]` is empty across all phases, report "no aggregates touched — no invariant integration tests required" and skip.

  1. Extract `bounded_contexts[X].aggregates[Y]` from all touches. Iterate ALL phases.

  2. For each (X, Y): run `storyline view --context X`, read `aggregates[Y].invariants[]`. If none, report "no invariants defined for Y" and skip.

  3. Classify each invariant before writing:
     - **Assertable**: observable state or emitted events → write a test.
       (Edge case: "delta entries are applied to blueprint.yaml incrementally" IS assertable — inspect `applied` flags after the command runs.)
     - **Architectural**: process discipline, no observable outcome (e.g. "acceptance test must be written before unit test") → skip with reason "architectural".

  4. Check each assertable invariant against acceptance test step definitions (read the step def code — not just the feature file). Mark "already covered" and skip if asserted end-to-end.

  5. Write or update `tests/integration/<context>_<aggregate>_invariants_test.<ext>`. If file exists, update (do not skip). Do NOT mock the aggregate, command handler, or domain service.

  6. Commit: `verify: invariant tests for [feature] — N written, N skipped (architectural), N already covered`
     If >50% skipped (any reason): append `— N% skipped, review invariant quality`

  Work from: [project directory]
</agent-dispatch>

### 4. (Optional — complex features) Product Amigo validates

<agent-dispatch subagent_type="storyline:product-amigo">
prompt: |
  Read the relevant feature file in .storyline/features/.
  Read discovery notes: .storyline/workbench/amigo-notes/product.md
  Does this match what we discussed? Is the behavior what the user expects?
  Work from: [project directory]
</agent-dispatch>

### 5. Murphy + move to next task

`TaskUpdate: VERIFY task → completed`

Surface one Murphy critique now — pick the sharpest note logged since the last phase. Present as AskUserQuestion.

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

  ## Review passes (run sequentially)

  | Pass | Check | Skip |
  |---|---|---|
  | **Correctness** | Logic bugs, null handling, error handling gaps | Style, naming, formatting |
  | **Invariants** | Every `invariants[]` from blueprint holds in the code | Generic suggestions |
  | **Cross-file impact** | Broken assumptions, call sites, type contracts | Praise |
  | **Security** | Injection, hardcoded secrets, auth gaps — mandatory if touching user input or external APIs | Low-risk utility code |
  | **Test completeness** | Uncovered code paths and sad paths from feature files | Style preferences |
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

