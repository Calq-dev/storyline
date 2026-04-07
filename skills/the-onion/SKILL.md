---
name: the-onion
description: Use when Gherkin scenarios and a blueprint are ready and it's time to write an implementation changeset and build the feature using outside-in TDD — from acceptance test inward through the domain model.
---

# The Onion

Peel back layers outside-in, one test at a time. Tests tell you what to build next.

**Pipeline position:** Foreman → Scout → Three Amigos → Mister Gherkin → Quartermaster → [Sticky Storm + Doctor Context] → **The Onion** → The Foreman

## Hard Rules
- ALWAYS use TodoWrite (prefix: "The Onion:"). Write ALL todos upfront before work.
- ALWAYS use AskUserQuestion for decisions (MCQ). Never plain text questions.
- ALWAYS use context7 for framework/library API syntax. Never rely on training data.
- Use TaskCreate/TaskUpdate to organize work into tasks. Generate task names and descriptions dynamically from the actual feature context — never use template text.
- Generate all user-facing text dynamically from context. No canned messages.
- Skip any read/fetch whose output is already in this session's context.

## The Double Loop
```
OUTER (Acceptance Test from Gherkin)
│   ❌ Failing acceptance test
│   │   INNER (Unit Test per component)
│   │   │   ❌ Failing unit → ✅ Pass (simplest) → 🔄 Refactor → ↺ Next
│   ✅ Acceptance green → commit → next scenario
```

---

## Phase 1: Plan

### 1a: Load Blueprint
```bash
storyline summary
storyline view --context "<name>"    # for each context you'll implement
```
Also read: `.storyline/features/*.feature`, `.storyline/workbench/tech-choices.md` (if exists).

### 1b: Write Changeset
```bash
storyline changeset init --title "<feature-name>"
```
Changeset covers:
1. Scenario execution order — walking skeleton first (simplest happy path), then must-haves, then edge cases
2. Component inventory — classes, interfaces, types, files (from `bounded_contexts[].aggregates[]`)
3. Dependency graph (from `relationships[]`, command/event chains)
4. Integration points between bounded contexts
5. Test strategy — acceptance + unit per component + mock boundaries
6. Risk spots — blueprint `gaps[]` and `questions[]`

See `./implementation-plan-format.md` for changeset structure reference.

### 1c: Validate Assumptions
After writing changeset, targeted codebase exploration:
- Verify files/modules exist and current state
- Check exact interfaces of dependencies
- Match existing test style

Update changeset if anything unexpected.

### 1d: Review

**Self-check first:**
1. **Coverage** — every scenario in `.storyline/features/` has a task. No scenario left out.
2. **Invariants** — every `invariants[]` entry in the blueprint maps to a test assertion in the plan.
3. **Gaps** — blueprint `gaps[]` and `questions[]` acknowledged. Addressed or explicitly deferred.
4. **Walking skeleton** — first task is simplest happy path end-to-end. Not a partial slice.
5. **Dependencies** — build order respects `relationships[]`. Nothing depends on something built later.

Fix any holes found. Then dispatch Testing Amigo for a quick scan:

<agent-dispatch subagent_type="storyline:testing-amigo">
prompt: |
  Quick scan only — no rounds, no notes file. Report back directly.

  Read the changeset: `.storyline/changesets/<cs-filename>.yaml`
  Read the feature file(s) it covers: `.storyline/features/`
  Run `storyline summary` for invariants and glossary.

  Check:
  1. Sad paths — are the obvious failure scenarios covered?
  2. Edge cases — boundary conditions, empty states, concurrent actions?
  3. Invariant coverage — does the test strategy actually assert the blueprint invariants?
  4. Anything in the feature file that has no corresponding task in the changeset?

  Flag issues only. No praise. One sentence per finding.
  Work from: [project directory]
</agent-dispatch>

Flags → adjust changeset. No flags → proceed.

### 1e: Hand Off
```bash
storyline changeset validate
git add .storyline/changesets/
git commit -m "changeset: CS-YYYY-MM-DD-<feature-name>.yaml"
```
Dispatch `Skill: storyline:the-foreman` for build choice. Do NOT start implementing.

---

## Phase 2: Build (after Foreman gives go-ahead)

### 2a: Confirm Execution Order
Present recommended scenario order to user via MCQ. After confirmation, create a task per scenario using TaskCreate, chained with TaskUpdate addBlockedBy. Mark first in_progress.

### 2b: Step Definitions
Detect language + framework from `tech_stack`. Generate **declarative** step definitions (business actions, not UI). See `./step-definition-examples.md`. Write to: `tests/acceptance/steps/<feature>_steps.*`

### 2c: Failing Acceptance Test
Run scenario — it must fail. The failure tells you what to build first.

### 2d: Inner Loop TDD
Per component: failing unit test → simplest pass → refactor → check acceptance test.

**Blueprint-to-code mapping:**

| Blueprint | Code |
|---|---|
| `aggregates[].name` | Root class |
| `aggregates[].value_objects` | Immutable types (equals, toString, validation) |
| `aggregates[].invariants` | Unit test assertions |
| `aggregates[].events[].name` | Event classes |
| `aggregates[].commands[].name` | Command handler classes |
| `relationships` | Integration points (ACLs, event handlers) |
| `glossary` | Exact terms in code identifiers (ubiquitous language) |

Each invariant → unit test. Each command → verify `feature_files[]` traceability.

### 2e: Green
When acceptance test passes:

**Apply domain model delta** — if changeset has `domain_model_delta`, for each entry where `applied` is not `true`:
1. `storyline view --context <context>` — check if entry already exists (skip if yes)
2. Apply the missing entry:
   - Events: `storyline add-event --context X --aggregate Y --name Z`
   - Commands: `storyline add-command --context X --aggregate Y --name Z --feature-files ...`
   - Invariants/relationships: edit `blueprint.yaml` directly
3. Mark `applied: true` in the changeset YAML
4. `storyline validate && storyline stamp`

If `domain_model_delta` is absent, skip silently.

```bash
git add .storyline/ src/ tests/
git commit -m "feat: [feature name] — [scenario name] green"
```
TaskUpdate current → completed. TaskUpdate next → in_progress. Repeat 2b–2e.

### 2f: Outside-In Discipline Check
If implementation came before tests — write the missing test now.

---

## Pitfalls

| Pitfall | Rule |
|---|---|
| Step defs testing implementation | If renaming a class breaks a step def, too coupled. |
| Mocking everything | Mock at aggregate boundaries only. |
| Glossary drift | Code terms must match glossary exactly. |

---

## Phase 3: Hand Back

When all scenarios green, hand back to The Foreman for code review and as-built update.

```bash
git add .storyline/ src/ tests/
git commit -m "feat: [feature name] — all scenarios green"
```
Dispatch `Skill: storyline:the-foreman` for post-build review.
