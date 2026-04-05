# Testing Amigo — Project Notes

## Blueprint Architecture & Risks
- Blueprint.yaml is a single file. 690 lines for this meta-project, 2500+ for real projects.
- Referential integrity crosses bounded context boundaries: events, policies, relationships, glossary all have cross-references.
- The PostToolUse hook only validates Edit/Write operations, NOT Bash-based `blueprint add-*` CLI calls. This is a significant validation gap — most structural mutations go through Bash.
- The CLI commands (add-event, add-command, etc.) do validate internally before writing, so there IS a safety net, but there is no external vangnet if the CLI call itself fails or is malformed.

## Housekeeping & Cleanup Risks
- No mechanism currently enforces validate+stamp+cleanup at phase boundaries.
- PostToolUse validates after Edit/Write but does not stamp. There is no PreCommit hook in Claude Code.
- Workbench files are declared "transient" but nothing enforces cleanup. No scenario specifies when cleanup happens.
- Key invariant I proposed: commit-before-cleanup ordering must be enforced. Otherwise git history cannot serve as the archive.
- Estimation reports (workbench) should NEVER be auto-cleaned — they are user-facing artifacts.

## Blueprint Views (Summary/View Approach)
- Agreed direction: `blueprint summary` + `blueprint view --context X` is safer than splitting the file.
- Summary reduces READ tokens but not EDIT tokens. Agent must still read full file (or use CLI) for mutations.
- Estimated real-world token reduction: 40-60%, not the 80% the Developer estimated.
- Critical gap: `view --context X` does not include dependency contexts. Needs a `--with-deps` flag.
- Core design tension: views are a read optimization; validation must remain global (whole-file).

## Implementation Priority (My Position)
1. Fix validation gap (PostToolUse for Bash calls) — without this, views are dangerous
2. Add summary/view CLI commands — token reduction
3. Add housekeeping command — defensive design, idempotent, refuses cleanup without commit

## Missing Test Coverage
- No sad-path scenarios for: blueprint size thresholds, corrupted YAML, concurrent edits, empty feature files
- No scenarios for workbench cleanup lifecycle at all
- No scenarios for agent failure mid-build in Crew mode
- No scenarios for housekeeping command (does not exist yet)

## Session Patterns
- Three Amigos Ronde 1 dispatches persona agents in parallel (write to separate files, no shared-resource contention)
- Ronde 2 is sequential read-react — no concurrency risk here
- Crew mode is sequential (Developer then Testing) — but blueprint could change between the two

## scaffold.ts Port (CS-2026-04-05-scaffold-ts-port)

- Phase-1 complete (2026-04-05): `scripts/scaffold.ts` exports all 9 functions — toSnakeCase, toKebabCase, extractEventNames, extractCommandNames, loadModel, generateTypescript, generatePython, printSummary, main
- Phase-2 RED tests committed (2026-04-05): 14 new tests in `scripts/test-scaffold.ts` (tests 18-31), all failing with "not yet implemented (phase-2)"; phase-1 tests (1-17) remain green
- Phase-2/3 stubs throw `Error("...not yet implemented (phase-N)")` — correct, non-fatal for test runner
- `root_entity` fallback is implemented at the caller level (`aggregate.root_entity ?? aggregate.name`), NOT inside `loadModel` — `loadModel` is a plain deserialiser
- Original 16 tests passed; I added test 17 for the missing root_entity fallback acceptance criterion
- Pattern to watch: acceptance criteria that say "falls back to X when absent" are commonly skipped. Always cross-check each criterion against the test list explicitly
- `toSnakeCase('InvoiceID')` → `'invoice_i_d'` — actual behaviour documented, not normalised; this is a known rough edge, not a bug
- `printSummary` stdout capture pattern: reassign `process.stdout.write` in try/finally, restore in finally; collects string chunks; works even if printSummary throws (finally block restores)
- Intentional Python divergence: generatePython always creates application/ (Python convention); generateTypescript skips it when aggregate has no commands — tested explicitly with a `!existsSync` assertion
- Fixture pattern used: in-memory JS objects (not YAML strings) for generateTypescript/generatePython tests — no file I/O for the model, only for the output dir
- Phase-2 review (2026-04-05): Developer's 31 tests covered all acceptance criteria EXCEPT value objects — both generators have a `value_objects` loop that was untested; added tests 32-33 (FIXTURE_PAYMENT_INVOICE_WITH_VO with `value_objects: ["Money"]`); suite now 33/33 green
- Pattern confirmed: acceptance criteria that say "generates X for each Y" are commonly tested only for the happy-path list; sub-lists (value_objects inside aggregates) are skipped. Always fixture-stub sub-lists explicitly.

## CLI Subprocess Testing Patterns

- `spawnSync(BIN, args, { encoding: "utf-8" })` is the correct pattern for CLI end-to-end tests — matches how `test-blueprint.ts` wraps `spawnSync("npx", ["tsx", SCRIPT, ...args])`.
- `bin/storyline` is a bash wrapper; pass it directly as the binary, not via `npx tsx`.
- BIN path: `join(fileURLToPath(import.meta.url), "..", "..", "bin", "storyline")` (two dirs up from scripts/).
- `result.status ?? 1` for exit code (spawnSync returns null on spawn failure, not 0).
- `result.stdout + result.stderr` for combined output checks — `bin/storyline` writes usage to stderr.
- The `find` binary via spawnSync is a safe way to enumerate generated files without shell glob expansion.
- Each CLI test that writes output gets its own `tmp()` dir cleaned up in `afterEach`.
- CLI happy-path test uses the real `.storyline/blueprint.yaml` as a model file — this means the test is sensitive to blueprint schema changes. Flag as integration risk if blueprint context count changes dramatically (generates many files, slower test).
- The no-args usage test: exit code must be non-zero AND output must contain `scaffold --model`. Checking only the string without the exit code is insufficient — a bug could write the right text and still exit 0.

## Things To Watch Out For
- Any solution that relies on agent discipline (prompt instructions alone) will fail in long sessions. Already proven by the housekeeping problem.
- String matching on Bash command content for PostToolUse is fragile — commands can be chained with `&&`, wrapped in subshells, etc.
- Phase names are not formally defined as an enum anywhere. Any CLI that accepts `--phase` must validate strictly or agents will pass inconsistent values.
- When reviewing multi-phase changesets: phase stubs (throw-on-call exports) are valid for phase-1 — do NOT flag them as missing coverage unless the phase that implements them has been completed.
