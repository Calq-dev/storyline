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

## Code Quality Rules (apply while writing, not after)

- **Reuse** — check for existing utilities/helpers before writing. No duplicates, no hand-rolled logic where abstractions exist.
- **Quality** — no redundant state, no parameter sprawl (≤3 params), no copy-paste (extract it), no raw strings where enums belong.
- **Efficiency** — no unnecessary computation, use concurrency for independent ops, no expensive logic in tight loops, no TOCTOU, clean up listeners/subscriptions/timers.

## The Double Loop
```
OUTER (Acceptance Test from Gherkin)
│   ❌ Failing acceptance test
│   │   INNER (Unit Test per component)
│   │   │   ❌ Failing unit → ✅ Pass (simplest) → 🔄 Refactor → ↺ Next
│   ✅ Acceptance green → commit → next scenario
```
Outer = what to build (behavior). Inner = how (design). Outer stays red during inner cycles.

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

### 1d: Crew Review
Dispatch in parallel:

| Amigo | Reviews |
|---|---|
| `storyline:developer-amigo` | Build order, dependencies, tech approach |
| `storyline:testing-amigo` | Scenario coverage, invariants as test cases, test strategy completeness |
| `storyline:product-amigo` | Must-have priority, walking skeleton scope, nothing unplanned |
| `storyline:security-amigo` | (if active in session) |
| `storyline:frontend-amigo` | (if active in session) |

All report back directly (no files). Flags → adjust changeset. All approve → proceed.

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
```bash
git add .
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

## Phase 3: As-Built Survey

When all scenarios green, dispatch `storyline:surveyor`:
- Incremental survey, trigger `post_implementation`
- Focus on changeset modules
- Compare planned vs built, update `blueprint.yaml`, re-run gap analysis

```bash
git add .storyline/ src/ tests/
git commit -m "feat: [feature name] — pipeline complete, blueprint updated"
```
Dispatch `Skill: storyline:the-foreman` for final inspection.