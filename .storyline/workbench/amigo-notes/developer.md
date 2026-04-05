# Developer Amigo — Scaffold Feature: Spec vs. Implementation Review

Post-implementation review of `.storyline/features/scaffold.feature` against
`scripts/scaffold.ts` and `scripts/test-scaffold.ts`.

---

## Scenarios that no longer match implementation

### "Python context includes __init__.py files" — under-specified

The scenario only checks `payment/__init__.py`, `payment/domain/__init__.py`, and
`payment/application/__init__.py`. The implementation always creates a fourth:
`payment/infrastructure/__init__.py`. The spec is not wrong, but it leaves one of
four guaranteed files unmentioned.

### "Aggregate with no events or commands generates only root and repository" — missing Python counterpart

The scenario lives in the TypeScript rule only. The implementation has an intentional
divergence: `generatePython` always creates `application/` and `infrastructure/` (and
their `__init__.py` files) even when there are no commands. There is no scenario that
specifies or documents this divergence for Python.

### "TypeScript command handler is generated" — feature-file references not covered

The scenario checks `class SendInvoiceHandler` exists. The implementation also embeds
feature file references in the handler docblock (`Implements behavior from: features/invoicing.feature`).
The scenario says nothing about this, even though the feature-file linkage is a visible
output that callers would inspect.

### "scaffold CLI provides clear feedback" — `printSummary` fourth line missing

The scenario checks:
- "Scaffold generated"
- "Bounded contexts: 1"
- "Aggregates: 1"

The implementation emits a fourth line: `Next step: write your first acceptance test!`
This is tested in `test-scaffold.ts` (test 36) but absent from the Gherkin spec.

---

## Missing scenarios for behavior that emerged during implementation

### Value object file generation (TypeScript)

No scenario covers TypeScript value object files. The implementation generates
`payment/domain/money.ts` containing `export class Money` with `equals()` and
`toString()` stubs. The test suite covers this (test 27), the spec does not.

### Value object file generation (Python)

Same gap on the Python side. `payment/domain/money.py` is generated as a frozen
dataclass. Tested, not specified.

### Python command handler file generation

No Gherkin scenario covers `payment/application/send_invoice_handler.py` (with
`class SendInvoiceHandler` and `class SendInvoiceCommand`). Tested directly in
`test-scaffold.ts` indirectly (CLI smoke test creates it), but no explicit scenario.

### Python event file generation

No scenario covers `payment/domain/events/invoice_sent.py` containing `class InvoiceSent`
with `occurred_at` field. The TypeScript event scenario exists; the Python equivalent does not.

### Unsupported `--lang` argument gives a clear error

The implementation exits non-zero and writes to stderr:
`scaffold: unsupported --lang 'X'. Supported values: typescript, python`
There is no sad-path scenario for this case.

### Missing `--model`, `--output`, or `--lang` gives usage error

`main()` exits 1 with a usage line when any required argument is absent. Not specified.

### `events_produced` / `commands_handled` alias fields

`generateTypescript` and `generatePython` both accept `aggregate.events_produced` and
`aggregate.commands_handled` as aliases for `events` and `commands` (backwards compatibility
with legacy JSON models). No scenario covers this.

---

## Behavior built that was not in the spec at all

### Invariant comments in aggregate root files

Both `generateTypescript` and `generatePython` embed aggregate invariants as docblock
comments inside the generated aggregate root file. Not specified anywhere in the feature.

### Commented-out imports in TypeScript files

The TypeScript generator emits commented-out `import` lines at the top of each file
(value object imports, event imports, repository imports). Serves as scaffolding guidance
for the developer who fills in the implementation. Not mentioned in the spec.

### `--lang` validation before model loading

`main()` validates `--lang` before calling `loadModel`. If the lang is invalid, the
process exits before touching the filesystem. This ordering is a deliberate UX choice
not captured in any scenario.

### `fileURLToPath` guard on `main()` invocation

The ESM guard `if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])`
prevents `main()` from firing when `scaffold.ts` is imported by tests. This is a runtime
correctness constraint, not user-visible behavior, but it was the trickiest part of the
implementation and has no scenario.

---

## Summary verdict

The spec covers the happy path well for TypeScript and partially for Python. The main
gaps are:

1. Value object generation (both languages) — tested but unspecified
2. Python divergence from TypeScript on empty-aggregate behavior — not documented in Gherkin
3. Sad-path: invalid `--lang` — not covered
4. `printSummary` fourth output line — tested but not in Gherkin
5. Feature-file references in handler docblocks — implementation detail worth one scenario
