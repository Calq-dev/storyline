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
  ## Your notes from previous sessions:
  Read your persona memory from .storyline/personas/testing-amigo.md (may not exist yet).

  ## Your task:
  Read the current changeset from .storyline/changesets/<cs-filename>.yaml — identify the next pending task
  and the Gherkin scenario(s) it corresponds to in .storyline/features/.

  ## Your discovery notes:
  Read .storyline/workbench/amigo-notes/testing.md for your notes from the discovery session.

  Write the acceptance test BEFORE any implementation exists.
  Verify the test fails (RED), commit the failing test, and report back.
  Use context7 for test framework docs.
  Read and update `.storyline/workbench/build-board.md` per build board conventions.
  Work from: [project directory]
</agent-dispatch>

### 2. Developer Amigo implements (GREEN)

`TaskUpdate: RED task → completed` · `TaskUpdate: GREEN task → in_progress`

<agent-dispatch subagent_type="storyline:developer-amigo">
prompt: |
  ## Your notes from previous sessions:
  Read your persona memory from .storyline/personas/developer-amigo.md (may not exist yet).

  ## Your task:
  The Testing Amigo has written a failing acceptance test. Read the next pending task from
  .storyline/changesets/<cs-filename>.yaml.

  ## Your discovery notes:
  Read .storyline/workbench/amigo-notes/developer.md from the discovery session.

  Implement until the acceptance test is GREEN. Outside-in TDD: the acceptance test is there —
  write unit tests for the inner loop, then implement. Commit when green and report back.
  Use context7 for framework/library docs.
  Read and update `.storyline/workbench/build-board.md` per build board conventions.
  Work from: [project directory]
</agent-dispatch>

### 3. Testing Amigo verifies and adds edge cases

`TaskUpdate: GREEN task → completed` · `TaskUpdate: VERIFY task → in_progress`

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  ## Your notes from previous sessions:
  Read your persona memory from .storyline/personas/testing-amigo.md (may not exist yet).

  ## What the Developer just built:
  Run `git diff HEAD~1` to see the Developer's commit.

  ## Your discovery notes:
  Read .storyline/workbench/amigo-notes/testing.md from the discovery session.

  Confirm the acceptance test is green. Check: are the edge cases you flagged during discovery covered?
  Add any missing tests, commit additions, and report back.
  Use context7 for test framework docs.
  Read and update `.storyline/workbench/build-board.md` per build board conventions.
  Work from: [project directory]
</agent-dispatch>

### 4. (Optional — complex features) Product Amigo validates

<agent-dispatch subagent_type="storyline:product-amigo">
prompt: |
  ## The scenario that's now green:
  Read the relevant feature file in .storyline/features/.

  ## Your discovery notes:
  Read .storyline/workbench/amigo-notes/product.md from the discovery session.

  Does this match what we discussed? Is the behavior what the user expects?
  Work from: [project directory]
</agent-dispatch>

### 5. Update progress and move to next task

`TaskUpdate: VERIFY task → completed`

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
  | **Correctness** | Logic bugs, edge cases, off-by-one, null handling, incorrect conditionals, error handling gaps | Style, naming, formatting (linters handle that) |
  | **Invariants** | Every `invariants[]` from blueprint holds in the code. Every command validates its preconditions. | Generic "consider pattern X" suggestions |
  | **Cross-file impact** | Changes that break assumptions in other files. Dependency chains, call sites, type contracts. | Praise, positive comments |
  | **Security** | Injection, hardcoded secrets, auth gaps, unsafe input handling. Focus on code paths that touch user input or external APIs. | Low-risk utility code |
  | **Test completeness** | New code paths have tests. Sad paths from feature files have test coverage. | Asserting test style preferences |
  | **Glossary** | Code identifiers match `glossary[]` terms exactly. No drift from ubiquitous language. | |

  ## Rules
  - Only flag issues with high confidence. State confidence if borderline.
  - Every finding: severity (blocking / warning / nit), file:line, what's wrong, suggested fix.
  - If the feature touches auth, user input, sensitive data, or external APIs — the security pass is mandatory.
  - Do NOT comment on style, naming, formatting, or things linters catch.
  - Do NOT add praise or positive comments.

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

> "Building's done, specs are updated, session's archived. Ready for the next job."
