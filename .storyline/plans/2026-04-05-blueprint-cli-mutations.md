# Implementation Plan: Blueprint CLI — Structural Mutation Commands

Generated from blueprint.yaml v6 on 2026-04-05

---

## Feature

**As a** pipeline agent or skill author  
**I want** CLI commands for `add-relationship`, `add-invariant`, `add-policy`, and `resolve-question`  
**So that** structured blueprint mutations are safe and consistent without risking YAML corruption from manual edits

---

## Context

All four commands are additions to `scripts/blueprint.ts`. No new packages are needed — the existing
`yaml` npm package handles YAML round-trip mutations. All commands follow the established pattern
from `cmdAddGap`, `cmdAddEvent`, and `cmdAddCommand`:

1. `requireBlueprint()` — load and parse blueprint
2. Entity lookup with `findContext()` / `findAggregate()` — `process.exit(1)` on not-found
3. `loadDocument()` — load YAML AST for round-trip safe mutation
4. Navigate to the target node using `findDocNode()` / `findDocContextIndex()` / `findDocAggregateIndex()`
5. Create and append the new node
6. `saveDocument()` — write back
7. `console.log()` confirmation message

`resolve-question` is the exception: it's an **update**, not an insert. It finds an existing node
and mutates scalar fields on it rather than appending to a list.

---

## Scenario Execution Order

### Task 1 — Walking skeleton: `add-relationship` (happy path)
**Priority:** must-have | **Scenario:** "Adding a relationship between two contexts"  
**Why first:** simplest insert pattern; establishes the context-level list-append pattern used by `add-policy` too  
**Files touched:** `scripts/blueprint.ts`, `scripts/test-blueprint.ts`

CLI signature:
```
storyline add-relationship --context X --type T --target Y [--via 'description']
```

Logic:
- Look up source context (error naming the context if not found)
- Validate `--type` is in `ALLOWED_RELATIONSHIP_TYPES` (error listing allowed values)
- Validate `--target` is a known bounded context name (error listing known names)
- Navigate to `bounded_contexts[n].relationships[]`, create if absent
- Append `{ type, target, via? }` node

### Task 2 — Sad path: `add-relationship` context not found
**Priority:** must-have | **Scenario:** "Adding a relationship to a context that does not exist"  
Tests the `process.exit(1)` path and that the error message names the unknown context.

### Task 3 — Walking skeleton: `add-invariant` (happy path)
**Priority:** must-have | **Scenario:** "Adding an invariant to an existing aggregate"

CLI signature:
```
storyline add-invariant --context X --aggregate Y --invariant 'rule text'
```

Logic:
- Look up context (error naming context if not found)
- Look up aggregate in context (error naming both aggregate and context if not found)
- Navigate to `bounded_contexts[n].aggregates[m].invariants[]`, create if absent
- Append the invariant string directly (invariants are a list of strings, not objects)

### Task 4 — Sad path: `add-invariant` aggregate not found
**Priority:** must-have | **Scenario:** "Adding an invariant to an aggregate that does not exist in the context"  
Error message must name both the aggregate name and the context name.

### Task 5 — Walking skeleton: `add-policy` (happy path)
**Priority:** must-have | **Scenario:** "Adding a policy with a valid event and command"

CLI signature:
```
storyline add-policy --context X --name Y --triggered-by Z --issues-command W
```

Logic:
- Look up context (error naming context if not found)
- Build event set for that context by scanning `aggregates[*].events[*].name`
- Validate `--triggered-by` is in that event set (error naming the event)
- Build all-commands set across all contexts from `bounded_contexts[*].aggregates[*].commands[*].name`
- Validate `--issues-command` is in that set (error naming the command)
- Navigate to `bounded_contexts[n].policies[]`, create if absent
- Append `{ name, triggered_by, issues_command }` node

### Task 6 — Sad path: `add-policy` triggered-by event not found
**Priority:** must-have | **Scenario:** "Adding a policy with a triggered-by event that does not exist in the context"

### Task 7 — Sad path: `add-policy` issues-command not found in any context
**Priority:** must-have | **Scenario:** "Adding a policy with an issues-command that does not exist in any context"

### Task 8 — Walking skeleton: `resolve-question` (happy path)
**Priority:** must-have | **Scenario:** "Resolving an open question with an answer"

CLI signature:
```
storyline resolve-question --id Q-001 --answer 'answer text'
```

Logic:
- Look up question by ID in `questions[]` (error naming the ID if not found)
- Check status: if already `"resolved"`, print a warning to stderr including the value of `resolved_at`
  (e.g. `Warning: Q-001 was already resolved at 2026-04-05T17:19:00+01:00. Updating the answer.`)
- Set `status: "resolved"`, `answer: <answer text>`, `resolved_at: <ISO timestamp>`
- `saveDocument()` — write back
- `console.log()` confirmation

Note: `resolved_at` is stored as an ISO 8601 string. The existing schema validator is permissive —
it checks known fields on questions but does not reject unknown ones, so `resolved_at` and `answer`
pass validation without schema changes.

### Task 9 — Sad path: `resolve-question` question not found
**Priority:** must-have | **Scenario:** "Resolving a question that does not exist"

### Task 10 — Edge case: re-resolving an already-resolved question
**Priority:** should-have | **Scenario:** "Resolving a question that is already resolved updates the answer with a warning"  
Warning to stderr must include the `resolved_at` timestamp from the first resolution.

---

## Component Inventory

All work is in two files:

| File | Change type | What changes |
|---|---|---|
| `scripts/blueprint.ts` | Modify | Add 4 new `cmdXxx()` functions + 4 `case` blocks in `main()` + update `printUsage()` |
| `scripts/test-blueprint.ts` | Modify | Add 10 new test functions (one per scenario) |

No new files. No new packages. No changes to YAML schema validation (new fields `answer`, `resolved_at` on questions are already tolerated by the permissive validator).

### New functions in `scripts/blueprint.ts`

```
cmdAddRelationship(args: { context, type, target, via }, cwd)
cmdAddInvariant(args: { context, aggregate, invariant }, cwd)
cmdAddPolicy(args: { context, name, triggeredBy, issuesCommand }, cwd)
cmdResolveQuestion(args: { id, answer }, cwd)
```

Placement: after `cmdAddQuestion()` (line ~1025), before the `// summary` section comment.

### Dispatch blocks in `main()` switch

Four new `case` blocks after `"add-question"`:
- `"add-relationship"` — parse `--context`, `--type`, `--target`, optional `--via`
- `"add-invariant"` — parse `--context`, `--aggregate`, `--invariant`
- `"add-policy"` — parse `--context`, `--name`, `--triggered-by`, `--issues-command`
- `"resolve-question"` — parse `--id`, `--answer`

### `printUsage()` additions
```
add-relationship --context X --type T --target Y [--via 'description']
add-invariant --context X --aggregate Y --invariant 'rule text'
add-policy --context X --name Y --triggered-by Z --issues-command W
resolve-question --id Q-001 --answer 'answer text'
```

---

## Dependency Graph

```
All 4 commands:
  requireBlueprint() ─── exists already
  findContext()      ─── exists already
  findAggregate()    ─── exists already (add-invariant, add-policy validation)
  loadDocument()     ─── exists already
  findDocNode()      ─── exists already
  findDocContextIndex() ── exists already
  saveDocument()     ─── exists already

add-policy only:
  needs inline event-set and all-commands-set building
  (same logic already in validateReferentialIntegrity() — replicate, don't extract)
```

Build order per task is: function body → dispatch case → tests. All four commands are independent
of each other and can be implemented in any order, but the walking skeleton (Task 1) goes first
to establish the context-level insert pattern for Task 5.

---

## Integration Points

No cross-context integration. These are pure CLI commands that mutate a local YAML file.
All validation is self-contained within `blueprint.ts`.

The `resolve-question` command only operates on `questions[]` at the top level — not on
`bounded_contexts` — matching the existing pattern in `cmdAddQuestion`.

---

## Test Strategy

Test file: `scripts/test-blueprint.ts` — uses `node:test` + `node:assert/strict`.  
All tests follow the existing pattern: create a temp dir, write a minimal blueprint fixture,
run the CLI via `execFileSync`, assert on exit code and YAML output.

### Fixture blueprint for mutation tests

```yaml
meta:
  project: "Test"
  created_at: "2026-01-01"
tech_stack:
  language: TypeScript
bounded_contexts:
  - name: Payments
    aggregates:
      - name: Invoice
        invariants: []
        commands: []
        events: []
    relationships: []
    policies: []
  - name: Orchestration
    aggregates:
      - name: Pipeline
        commands:
          - name: StartPipeline
            feature_files: []
        events:
          - name: PipelineStarted
            payload_fields: []
    relationships: []
    policies: []
questions:
  - id: "Q-001"
    question: "Should the Security Amigo run on every feature?"
    severity: "important"
    affects:
      - Payments
    status: "open"
```

### Test cases (10 new tests)

| # | Test name | Command | Assert |
|---|---|---|---|
| 31 | `test_add_relationship` | `add-relationship --context Payments --type customer-supplier --target Orchestration --via 'trigger'` | exit 0; `relationships[0].type == customer-supplier` |
| 32 | `test_add_relationship_context_not_found` | `add-relationship --context NonExistent --type customer-supplier --target Orchestration` | exit 1; stderr contains "NonExistent" |
| 33 | `test_add_invariant` | `add-invariant --context Payments --aggregate Invoice --invariant 'Amount > 0'` | exit 0; `invariants[0] == 'Amount > 0'` |
| 34 | `test_add_invariant_aggregate_not_found` | `add-invariant --context Payments --aggregate Order --invariant 'x'` | exit 1; stderr contains "Order" and "Payments" |
| 35 | `test_add_policy` | `add-policy --context Orchestration --name StartOnInit --triggered-by PipelineStarted --issues-command StartPipeline` | exit 0; `policies[0].name == StartOnInit` |
| 36 | `test_add_policy_event_not_found` | `add-policy --context Orchestration --name X --triggered-by OrderPlaced --issues-command StartPipeline` | exit 1; stderr contains "OrderPlaced" |
| 37 | `test_add_policy_command_not_found` | `add-policy --context Orchestration --name X --triggered-by PipelineStarted --issues-command SendEmail` | exit 1; stderr contains "SendEmail" |
| 38 | `test_resolve_question` | `resolve-question --id Q-001 --answer 'Only for auth features'` | exit 0; `status == resolved`; `answer` set; `resolved_at` set |
| 39 | `test_resolve_question_not_found` | `resolve-question --id Q-999 --answer 'x'` | exit 1; stderr contains "Q-999" |
| 40 | `test_resolve_question_already_resolved` | pre-resolve Q-001, then resolve again with new answer | exit 0; stderr contains "already resolved" and original `resolved_at` timestamp; answer updated |

---

## Risk Spots

- **`resolve-question` is an update, not an insert** — rather than `doc.createNode()` + `.add()`, we need to navigate to the existing question node and call `.set()` on it. The `findDocNode()` helper + a loop over `doc.get("questions").items` is the approach.
- **`--via` is optional for `add-relationship`** — omit from the YAML node if not provided (don't write `via: ''`).
- **Invariants are strings, not objects** — `cmdAddInvariant` appends a plain string node, not a mapping. Contrast with events/commands which are objects.
- **Timestamp format for `resolved_at`** — use `new Date().toISOString()` (UTC). This is consistent with the existing `today()` helper pattern and unambiguous across time zones.

---

## Gherkin Update Required

The `should-have` scenario in `.storyline/features/blueprint-cli-mutations.feature` needs one update
to capture the timestamp requirement the user specified:

```gherkin
# Before:
Then a warning is shown that "Q-001" was already resolved

# After:
Then a warning is shown that "Q-001" was already resolved, including when it was first resolved
```

This ensures the test verifies that `resolved_at` is surfaced in the warning, not just the question ID.

---

## Task 11 — `stamp` uses ISO datetime (not just date)

**Priority:** should-have | Relates to user request for timestamps to include time of day

Currently `today()` in `blueprint.ts` returns `YYYY-MM-DD`. The user wants `meta.updated_at` to be
a full ISO 8601 datetime string including the local time and offset — e.g. `2026-04-05T17:19:00+01:00`.

Change:
- Rename or replace `today()` with a helper that returns `new Date().toISOString()` (UTC) — consistent,
  unambiguous, and matches the format used by `resolved_at` in `resolve-question`.
- The existing regex in `validateSchema()` for `meta.created_at` is `^\d{4}-\d{2}-\d{2}` — this already
  accepts ISO 8601 datetimes (they start with YYYY-MM-DD), so no schema change needed.
- The `today()` helper is also used for `meta.created_at` on init — update init to use the same
  full ISO format for consistency.

Test: add one test that stamps a blueprint and asserts `updated_at` contains a `T` (i.e. is not
just a date string). The existing `test_stamp_increments_version` can be extended.

---

## Amigo Review Flags

The Developer and Testing amigos reviewed the plan. The following must be addressed during implementation:

### Developer flags

**D1 — `cmdHousekeeping` `isUpToDate` check breaks with ISO datetime (MUST FIX)**  
`cmdHousekeeping` currently does `data?.meta?.updated_at === todayStr`. If `updated_at` becomes
a full ISO string, this comparison is always false — the "already up to date" short-circuit breaks.
Fix: compare only the date portion:
```typescript
data?.meta?.updated_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)
```

**D2 — Keep `today()` for archive/init; introduce `nowIso()` for updated_at and resolved_at**  
`cmdArchive` uses `today()` for session directory names (must remain `YYYY-MM-DD`).
`cmdInit` uses `today()` for `meta.created_at` (keep as date only for human readability).
Add a separate `nowIso()` helper returning `new Date().toISOString()` — use it only in `cmdStamp`
and `cmdResolveQuestion`.

**D3 — `resolve-question`: call `.set()` on the map node itself, not a field node**  
Walk `doc.get("questions").items`, find the item whose `get("id")` equals the target ID,
then call `.set("status", "resolved")` etc. on *that item*. Do not navigate to
`findDocNode(doc, ["questions", n, "status"])` — that returns a scalar node with no `.set()`.

### Testing flags

**T1 — Test 35: cross-context command lookup not exercised (MUST FIX)**  
The fixture puts `StartPipeline` in `Orchestration` — the same context where the policy is added.
If implementation only searches the local context, test 35 passes incorrectly.
Fix: move `StartPipeline` to the `Payments` context in the fixture, so the policy (`add-policy
--context Orchestration`) must find it via cross-context lookup.

**T2 — Test 40: capture `resolved_at` explicitly after first resolution**  
Sub-millisecond execution means both timestamps may be identical. The test must:
1. Pre-resolve Q-001 and read `resolved_at` from the YAML file
2. Re-resolve Q-001 with a new answer
3. Assert that the exact `resolved_at` string from step 1 appears literally in stderr

**T3 — Update the feature file before writing test 40**  
The Gherkin "already resolved" scenario currently only checks for the warning, not the timestamp.
Update `.storyline/features/blueprint-cli-mutations.feature` to add:
```gherkin
And the warning includes when "Q-001" was first resolved
```
Do this before writing test 40 — the test should confirm what the feature file specifies.

**T4 — Stamp `"T"` assertion: use a regex, not just `.includes("T")`**  
The test for ISO datetime in stamp should assert
`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(updatedAt)` rather than `updatedAt.includes("T")`.

---

## Outside-in Verification Checklist

- [ ] Feature file updated for re-resolve scenario (T3) — before test 40 is written
- [ ] Each test is written before its implementation function
- [ ] Test 35 fixture has `StartPipeline` in `Payments` context (T1)
- [ ] Test 40 captures first `resolved_at` before re-resolving (T2)
- [ ] `cmdHousekeeping` isUpToDate check uses `.slice(0, 10)` (D1)
- [ ] `nowIso()` added; `today()` kept for archive/init (D2)
- [ ] `bin/storyline validate` passes after all changes
- [ ] `bin/storyline stamp` succeeds
- [ ] `npx tsx --test scripts/test-blueprint.ts` shows 40 tests passing (30 existing + 10 new)
- [ ] Commit order: tests first (red), then implementation (green)
