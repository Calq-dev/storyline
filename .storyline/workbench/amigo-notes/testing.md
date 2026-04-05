# Testing Amigo — scaffold.feature Refinement Notes

Reviewing `scaffold.feature` against the actual implementation in `scripts/scaffold.ts`
and the 35-test suite in `scripts/test-scaffold.ts`. Identified after the port is complete.

---

## Edge cases tested in code but missing from feature file

### 1. Value objects generate a file per object (TypeScript and Python)

Tests 32-33 (`generateTypescript: value object file exists...`, `generatePython: value object
file exists...`) explicitly assert that a `value_objects: ["Money"]` entry produces
`payment/domain/money.ts` with `export class Money` and `payment/domain/money.py` with
`class Money`.

The Background already declares `value_objects | Money` but none of the scenarios under
"TypeScript directory structure" or "Python directory structure" assert the value object file.
There is no scenario like "TypeScript value object file is generated" or "Python value object
file is generated".

**Gap**: add a scenario per language asserting the value object file exists and contains
the correct class declaration.

### 2. root_entity fallback — aggregate.name is used when root_entity is absent

Test 17 (`root_entity fallback: aggregate without root_entity falls back to aggregate.name`)
asserts that when `root_entity` is absent from the YAML, the caller pattern
`aggregate.root_entity ?? aggregate.name` returns the aggregate name.

No scenario in the feature file covers this. The current "Aggregate with no events or commands"
scenario uses the Billing/Receipt fixture — but the fixture in the test has `root_entity:
"Receipt"` explicitly. The missing-root_entity case is tested in code but not specified in
the feature file.

**Gap**: add an explicit scenario or a Background variant where `root_entity` is absent,
asserting the generated file is still named correctly and the class declaration uses the
aggregate name.

### 3. infrastructure/ is skipped for TypeScript when aggregate has no commands

Test `generateTypescript: empty aggregate — application/ dir does NOT exist` explicitly
asserts `!existsSync(appDir)` for a commands-empty aggregate.

The feature file scenario (line 51-56) covers the happy path of this divergence:
`But no files exist under "billing/application/"` — that is good. However the scenario
only checks `application/`, not `infrastructure/`. The code also skips `infrastructure/`
for TypeScript (the `if (commands.length > 0)` block wraps both). The scenario is
therefore incomplete: it should also assert no file exists under `billing/infrastructure/`.

**Gap**: the existing scenario should be extended with:
`And no files exist under "billing/infrastructure/"`

### 4. Python always creates infrastructure/ even for empty aggregates

The test suite does not assert this gap explicitly, but `generatePython` unconditionally
calls `mkdirSync(infraDir)` before the aggregate loop, regardless of commands. This is an
intentional divergence from TypeScript (Python convention). There is no Python
counterpart to the "no application/" scenario for TypeScript.

**Gap**: add a Python scenario: "Python always creates infrastructure/ even when aggregate
has no commands" — so the intentional divergence is documented in the feature file, not
just in a test comment.

### 5. printSummary line 4 — "Next step: write your first acceptance test!"

Test `printSummary: output contains all four expected lines` asserts four lines including
`Next step: write your first acceptance test!`. The feature file scenario (line 91-95) only
checks three output lines: "Scaffold generated", "Bounded contexts: 1", "Aggregates: 1".
The fourth line is absent.

**Gap**: add `And the output contains "Next step: write your first acceptance test!"` to the
"Scaffold prints a summary after generation" scenario.

---

## Sad paths discovered during implementation that are not in the feature file

### 6. Unsupported --lang value gives a clear error message

`main()` explicitly handles an invalid `--lang` value:
```
`scaffold: unsupported --lang '${lang}'. Supported values: typescript, python`
```
There is no sad-path scenario for this. Users could easily pass `--lang js` or
`--lang ts` and get a cryptic exit without the feature file specifying what they
should see.

**Gap**: add scenario:
```gherkin
@sad-path @command:ScaffoldFromBlueprint
Scenario: Invalid --lang value gives a clear error message
  When the scaffold runs with lang "ruby"
  Then the scaffold exits with a non-zero code
  And the error output contains "unsupported --lang"
  And the error output contains "typescript, python"
```

### 7. Missing --output argument gives a usage error

`main()` guards `!modelPath || !outputDir || !lang` and writes usage to stderr then
exits 1. No scenario covers the case where `--output` is omitted while `--model` is
provided.

**Gap**: add scenario for missing required argument(s) — at minimum one representative case.

### 8. Corrupted YAML file gives a parse error (not a crash)

`loadModel` calls `parseYaml(content)` without a try/catch. If the YAML is malformed,
`parseYaml` will throw a YAMLParseError which propagates up through `main()`'s catch block
and is written to stderr as `scaffold: <yaml error message>`. This is recoverable behaviour
but there is no scenario testing it.

**Gap**: add scenario:
```gherkin
@sad-path @command:ScaffoldFromBlueprint
Scenario: Malformed YAML model gives a clear error message
  Given a model file "bad.yaml" with invalid YAML content
  When the scaffold runs with model "bad.yaml"
  Then the scaffold exits with a non-zero code
  And the error output contains a parse error indication
```

---

## Scenarios too vague given what we now know about actual behaviour

### 9. "Scaffold loads a YAML blueprint" — success condition is underspecified

Scenario (line 76-80): `Then the scaffold completes successfully / And the summary reports
the correct number of contexts`. "Completes successfully" and "correct number of contexts"
are vague. We now know:

- "completes successfully" means exit code 0
- "correct number of contexts" means the stdout line `Bounded contexts: N` where N is the
  actual count from the real blueprint

The test uses the real `.storyline/blueprint.yaml`. If the blueprint grows (new contexts
added), the assertion "correct number of contexts" becomes non-deterministic unless the
step reads the blueprint's context count at runtime.

**Refinement**: either pin the scenario to a controlled fixture YAML (not the real
blueprint), or make the success criterion explicit: `And the output contains "Bounded
contexts:"` (without a specific count). The current wording implies a count check that
is not tested.

### 10. "Python context includes __init__.py files" — missing infrastructure/__init__.py

Scenario (line 67-72) asserts `payment/__init__.py`, `payment/domain/__init__.py`, and
`payment/application/__init__.py`. But `generatePython` also creates
`payment/infrastructure/__init__.py` (line 350 in scaffold.ts). The scenario only covers
three of the four `__init__.py` files, making it look like infrastructure is optional
when it is not.

**Gap**: add `And a file exists at "payment/infrastructure/__init__.py"` to that scenario.

---

## Scenarios that are absent entirely

### 11. toSnakeCase acronym behaviour is documented in tests but not in feature file

Test 3 explicitly documents that `InvoiceID` → `invoice_i_d`. This is a "known rough edge"
(per my memory). The feature file has no scenario about case conversion behaviour. If
someone changes the algorithm later this breaks silently.

**Low priority** — this is a unit-level concern. But if the project ever writes a "utility
functions" rule in the feature file, this belongs there as an `@edge-case` scenario.

### 12. No scenario for what happens when output directory already exists (idempotency)

`generateTypescript` and `generatePython` use `mkdirSync(dir, { recursive: true })` and
`writeFileSync` (which overwrites without error). Running scaffold twice on the same
output dir is silently idempotent. There is no scenario asserting this is safe — or
alternatively flagging it as destructive.

---

## My top-3 questions for the session

1. Should the feature file cover `root_entity` fallback explicitly? Right now the
   Background sets `root_entity: Invoice` — anyone reading the feature file would not
   know that `root_entity` is optional and the tool still works without it. That is a
   significant usability guarantee with no specification coverage.

2. The "Python always creates infrastructure/" vs "TypeScript skips it when no commands"
   divergence is intentional — but it is only documented in a test comment. Should this
   intentional design choice be a first-class scenario so a future developer does not
   accidentally "fix" the TypeScript path to match Python?

3. The sad-path for invalid `--lang` is currently unspecified. Given that the CLI is
   the primary user-facing interface, is it acceptable to ship without a scenario for
   unsupported language values?
