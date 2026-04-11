# Parallel Build

The Foreman divides independent tasks across multiple agents for faster development. Every agent is a cold start — no shared memory between dispatches. The suite + per-task build briefs from Phase 0 are the only handoff.

---

## When to use

Recommend parallel build when:
- 5+ tasks in the changeset
- Tasks have independent file scopes (different modules, contexts, or aggregates)
- No strict sequential dependency between most tasks

Do NOT use when:
- Tasks share the same files or have tight ordering dependencies
- Walking skeleton exposes risk the Foreman hasn't seen yet (run crew mode first, then switch)

---

## Step 0: Initialize build board + brief folder

```bash
echo "# Build Board\n" > .storyline/workbench/build-board.md
mkdir -p .storyline/workbench/build-briefs
```

## Step 1: Dependency analysis

Read the changeset. Classify each task:

| Classification | Meaning |
|---|---|
| **Independent** | Touches files no other task touches. Can run in parallel. |
| **Sequential** | Depends on output of another task (shared aggregate, event contract, etc.). Must wait. |
| **Walking skeleton** | First end-to-end happy path. Fused into Batch 1 as the sequential head (see Step 3). |

Group independent tasks into parallel batches. Sequential tasks run after their dependencies complete.

Present the execution plan to user via MCQ:
```
Phase 0  (sequential): Testing Amigo writes failing suite + per-task build briefs
Batch 1  (sequential head): [walking skeleton task]
Batch 1  (parallel tail):   [task A] + [task B] + [task C]   # starts after skeleton commits
Batch 2  (parallel):        [task D] + [task E]
Batch 3  (sequential):      [integration task depending on batch 1+2]
```

---

## Step 2: Phase 0 — suite + build briefs

Dispatch exactly as defined in `crew-build-loop.md` → "Phase 0: Upfront failing test suite + build briefs". One Testing Amigo writes the whole suite AND one brief per task. Dispatch inline (not background) — every later batch depends on this commit.

**Fast path:** if the changeset has ≤3 tasks, parallel build is the wrong mode — switch to the crew-build-loop fast path where the Foreman writes the suite itself.

After commit: surface one Murphy critique, then continue.

---

## Step 3: Batch 1 — walking skeleton + parallel tail

Batch 1 is split into two phases that share the same brief-based dev dispatch template:

**3a. Sequential head — walking skeleton task.** Dispatch one dev agent, inline. Wait for commit. This establishes the end-to-end bedrading other tasks build on.

**3b. Parallel tail — remaining independent tasks whose dependencies are satisfied by the skeleton.** Dispatch simultaneously with `run_in_background: true`.

Both use the dev dispatch template below.

---

## Step 4: Later parallel batches

For each remaining batch, dispatch independent tasks simultaneously with `run_in_background: true`. Wait for all agents in the batch, then check for conflicts:

```bash
git status
```

If conflicts between agents → resolve, re-run tests, commit the merge.

---

## Dev agent dispatch template (used by Step 3 and Step 4)

<agent-dispatch-template subagent_type="storyline:developer-amigo">
prompt: |
  Read persona memory: .storyline/personas/developer-amigo.md
  Read your brief: .storyline/workbench/build-briefs/<task-id>.yaml
  Read only the test files listed in `green_when`.
  Read .storyline/workbench/build-board.md (short — scan for entries affecting your task id).

  Do NOT read: changeset, feature files, blueprint summary, amigo-notes, tech-choices.md. Everything you need is in the brief. If something critical is missing from the brief, post on the build board as "brief-gap" and stop — do NOT guess.

  ## How to build
  - All tests in `green_when` are currently RED. Drive them to GREEN.
  - Inner loop TDD for components you create: failing unit test → simplest pass → refactor. Unit tests go next to the code, not in `tests/acceptance/` or `tests/integration/`.
  - Stay inside `files_in_scope`. Never touch `files_off_limits`.
  - Use exact `glossary_terms` in identifiers.
  - Use context7 for framework/library docs (see `framework_notes`).

  ## Parallel boundaries
  - You may be running alongside other dev agents. Assume any file NOT in your `files_in_scope` is owned by another agent.
  - If you discover you need something from another task's scope, post on the build board as "needs: <what>" and move on. Do not reach across.
  - Commit: `git commit -m "feat: [feature] — [task name] green"`

  Report back: which tests in green_when are now passing, any brief-gaps or needs posted, files touched.
  Work from: [project directory]
</agent-dispatch-template>

---

## Step 5: Sequential tail tasks

Tasks with dependencies run after their prerequisite batch completes. Same dev dispatch template, dispatched one at a time.

---

## Step 6: Integration check

After all batches complete:
```bash
# Run full test suite
[test command from tech_stack]
```

If tests fail → dispatch a fix agent with the failure context + the brief of the task whose tests are failing. Do not re-run the whole build.

---

## Step 7: VERIFY sweep (conditional)

After all GREEN batches pass, scan every brief for non-empty `deferred_edge_cases` (skipping items whose reason starts with "not for VERIFY"). If any remain: dispatch one Testing Amigo per task (parallel, background) using the VERIFY prompt from `crew-build-loop.md`. If none: skip entirely — the code review pass will catch gaps.

---

## After all tasks complete

Continue to the code review and as-built update from `crew-build-loop.md` → "After All Tasks Complete".
