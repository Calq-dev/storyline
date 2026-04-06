# Parallel Build

The Foreman divides independent tasks across multiple agents for faster development.
Each agent gets the same base context (blueprint + changeset + project conventions) plus their specific task scope.

---

## When to use

Recommend parallel build when:
- 5+ tasks in the changeset
- Tasks have independent file scopes (different modules, contexts, or aggregates)
- No strict sequential dependency between most tasks

Do NOT use when:
- Tasks share the same files or have tight ordering dependencies
- Walking skeleton must be built first before other tasks make sense

---

## Step 0: Initialize build board

```bash
echo "# Build Board\n" > .storyline/workbench/build-board.md
```

## Step 1: Dependency analysis

Read the changeset. Classify each task:

| Classification | Meaning |
|---|---|
| **Independent** | Touches files no other task touches. Can run in parallel. |
| **Sequential** | Depends on output of another task (shared aggregate, event contract, etc.). Must wait. |
| **Walking skeleton** | First end-to-end happy path. Always runs first, alone. |

Group independent tasks into parallel batches. Sequential tasks run after their dependencies complete.

Present the execution plan to user via MCQ:
```
Batch 1 (sequential): [walking skeleton task]
Batch 2 (parallel):   [task A] + [task B] + [task C]
Batch 3 (parallel):   [task D] + [task E]
Batch 4 (sequential): [integration task depending on batch 2+3]
```

---

## Step 2: Build the walking skeleton

First batch is always sequential — the walking skeleton task, using the same RED → GREEN → VERIFY loop from crew-build-loop.md.

This establishes the end-to-end structure other tasks build on.

---

## Step 3: Parallel batches

For each parallel batch, dispatch agents simultaneously using `run_in_background: true`.

Every agent gets the same base prompt plus their task-specific scope:

<agent-dispatch-template>
prompt: |
  ## Project context
  Read `.storyline/changesets/<cs-filename>.yaml` for the full plan.
  Run `storyline summary` for blueprint context.
  Read `.storyline/features/*.feature` for the behavior specifications.
  Read `.storyline/workbench/tech-choices.md` (if exists) for framework decisions.

  ## Your task
  You are building task [N]: [task name]
  Scope: [files to create/modify from changeset]
  Scenarios: [Gherkin scenario(s) this task implements]

  ## How to build
  1. Write a failing acceptance test from the Gherkin scenario
  2. Inner loop TDD: failing unit test → simplest pass → refactor
  3. Acceptance test green → commit
  4. Use context7 for framework/library API docs

  ## Code quality rules
  - Reuse: check for existing utilities before writing new ones
  - Quality: no redundant state, no parameter sprawl (3 max), no copy-paste
  - Efficiency: no unnecessary computation, clean up listeners/subscriptions

  ## Boundaries
  - ONLY touch files in your scope. Do not modify files outside your task.
  - If you discover you need something from another task's scope, note it and move on.
  - Commit your work with: `git commit -m "feat: [feature] — [task name] green"`

  ## Build board
  Read and update `.storyline/workbench/build-board.md` per build board conventions.

  Work from: [project directory]
</agent-dispatch-template>

Wait for all agents in the batch to complete. Check for conflicts:
```bash
git status
```

If conflicts between agents → resolve, re-run tests, commit the merge.

---

## Step 4: Sequential tasks

Tasks with dependencies run after their prerequisite batch completes. Same agent prompt template, dispatched one at a time.

---

## Step 5: Integration check

After all batches complete:
```bash
# Run full test suite
[test command from tech_stack]
```

If tests fail → dispatch a fix agent with the failure context. Do not re-run the whole build.

---

## After all tasks complete

Continue to the code review and as-built update from crew-build-loop.md "After All Tasks Complete" section.
