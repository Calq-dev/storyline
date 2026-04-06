# The Crew — Build Loop

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

### Memory update (parallel)

<agent-dispatch subagent_type="storyline:developer-amigo">
prompt: |
  The feature is built. Read .storyline/changesets/<cs-filename>.yaml and run
  `git log --oneline -20` to understand what was implemented and any deviations.
  Update your persona memory at .storyline/personas/developer-amigo.md
  Work from: [project directory]
</agent-dispatch>

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  The feature is built. Update your persona memory at .storyline/personas/testing-amigo.md
  with what you learned during implementation — edge cases found, test patterns that worked.
  Work from: [project directory]
</agent-dispatch>

<agent-dispatch subagent_type="storyline:product-amigo">
prompt: |
  The feature is built. Update your persona memory at .storyline/personas/product-amigo.md
  with how the implementation matched (or deviated from) the discovery session.
  Work from: [project directory]
</agent-dispatch>

### As-built survey

<branch-todos id="after-build">
- Foreman: building's done — sending the surveyor for final inspection
- Foreman: calling in the security inspector
- Foreman: final walkthrough — do the specs still match the building?
- Foreman: final inspection done — archiving the session
</branch-todos>

<agent-dispatch subagent_type="storyline:surveyor">
prompt: |
  Run an as-built survey. Compare what was planned (in the blueprint) with what was actually built.
  Update blueprint.yaml to match reality. Read .storyline/changesets/<cs-filename>.yaml to see which
  bounded contexts were touched, then focus your survey on those.
  Work from: [project directory]
</agent-dispatch>

### Security audit (if applicable)

If the feature touches auth, user input, sensitive data, or external APIs:

<agent-dispatch subagent_type="storyline:security-amigo">
prompt: |
  Audit the code just built for security vulnerabilities.

  ## Your notes:
  Read .storyline/personas/security-amigo.md (may not exist yet).

  ## What was built:
  Read .storyline/changesets/<cs-filename>.yaml and run `git log --oneline -10`
  and `git diff HEAD~[task count]` to see actual changes.

  ## Blueprint:
  Run `storyline summary`. Use `storyline view --context "<name>"` for specific contexts.

  Write findings to .storyline/workbench/amigo-notes/security.md
  Focus on code that was just changed — not the entire codebase.
  Work from: [project directory]
</agent-dispatch>

If critical issues found → Developer Amigo fixes, Security Amigo reviews.

### Scenario refinement (parallel)

<bash-commands>
```bash
mkdir -p .storyline/workbench/amigo-notes
```
</bash-commands>

<agent-dispatch subagent_type="storyline:developer-amigo">
prompt: |
  The feature is built. Review .storyline/features/ against what was actually implemented.
  Write refinement notes to .storyline/workbench/amigo-notes/developer.md:
  - Scenarios that no longer match implementation
  - Missing scenarios for behavior that emerged during implementation
  - Scenario language that doesn't match the updated glossary
  - Anything you had to build that wasn't specified
  Also update your persona memory at .storyline/personas/developer-amigo.md
  Work from: [project directory]
</agent-dispatch>

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  The feature is built. Review .storyline/features/ for completeness.
  Write refinement notes to .storyline/workbench/amigo-notes/testing.md:
  - Edge cases tested in code but missing from feature files
  - Sad paths discovered during implementation
  - Scenarios too vague given what we know about actual behavior
  Also update your persona memory at .storyline/personas/testing-amigo.md
  Work from: [project directory]
</agent-dispatch>

<agent-dispatch subagent_type="storyline:product-amigo">
prompt: |
  The feature is built. Review .storyline/features/ from the user's perspective.
  Write refinement notes to .storyline/workbench/amigo-notes/product.md:
  - Scenarios where described behavior doesn't match user expectations
  - Missing user-facing scenarios
  - Scope changes that happened during implementation
  Also update your persona memory at .storyline/personas/product-amigo.md
  Work from: [project directory]
</agent-dispatch>

(Include frontend-amigo if they were active in this session.)

### Synthesize and act

Read all refinement notes. Fix now (scenarios wrong/missing) → dispatch Mister Gherkin + validate + stamp. New ideas → `.storyline/backlog/`. Gaps → `storyline add-gap`.

### Archive the session

<bash-commands>
```bash
storyline archive --feature "<feature name>"
git add .storyline/sessions/ .storyline/
git commit -m "refine: scenario refinement + session archive for [feature name]"
storyline housekeeping --cleanup
git add .storyline/
git commit -m "chore: workbench cleanup after [feature name]"
```
</bash-commands>

> "Building's done, specs are updated, session's archived. Ready for the next job."
