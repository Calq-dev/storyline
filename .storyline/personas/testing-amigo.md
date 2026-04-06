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

## scaffold.ts Port (CS-2026-04-05-scaffold-ts-port) — COMPLETE

- Port complete (2026-04-05): 35 tests green, scaffold.py deleted, bin/storyline scaffold live
- `root_entity` fallback is at the caller level (`aggregate.root_entity ?? aggregate.name`), NOT inside `loadModel` — loadModel is a plain deserialiser
- `toSnakeCase('InvoiceID')` → `'invoice_i_d'` — documented rough edge, not a bug
- Intentional Python divergence: generatePython always creates application/ AND infrastructure/; generateTypescript skips both when aggregate has no commands
- `printSummary` outputs 4 lines; stdout capture via process.stdout.write reassignment in try/finally
- Fixture pattern: in-memory JS objects for generator tests (no file I/O for model), mkdtemp dirs for output (cleaned in afterEach)
- CLI end-to-end uses real `.storyline/blueprint.yaml` as model — integration-risk if blueprint grows significantly

## scaffold.feature Gaps Logged (2026-04-05)

Post-port review found 12 gaps between feature file and implementation:
1. Value object scenarios missing for both TypeScript and Python (Background declares it, no scenario asserts the file)
2. root_entity fallback not specified in any scenario
3. `billing/infrastructure/` skip not asserted in the no-commands TypeScript scenario (only application/ is checked)
4. Python always-creates-infrastructure/ divergence has no scenario (opposite of TS behaviour)
5. printSummary scenario missing 4th output line ("Next step: write your first acceptance test!")
6. No sad-path scenario for invalid --lang value
7. No sad-path scenario for missing --output argument
8. No sad-path scenario for malformed YAML model
9. "Scaffold loads a YAML blueprint" scenario uses real blueprint — count assertion is non-deterministic
10. Python __init__.py scenario missing infrastructure/__init__.py
11. toSnakeCase acronym behaviour undocumented in feature file
12. No idempotency scenario (running scaffold twice on same output dir)

Full notes at `.storyline/workbench/amigo-notes/testing.md`.

## CLI Subprocess Testing Patterns

- `spawnSync(BIN, args, { encoding: "utf-8" })` is the correct pattern for CLI end-to-end tests — matches how `test-blueprint.ts` wraps `spawnSync("npx", ["tsx", SCRIPT, ...args])`.
- `bin/storyline` is a bash wrapper; pass it directly as the binary, not via `npx tsx`.
- BIN path: `join(fileURLToPath(import.meta.url), "..", "..", "bin", "storyline")` (two dirs up from scripts/).
- `result.status ?? 1` for exit code (spawnSync returns null on spawn failure, not 0).
- `result.stdout + result.stderr` for combined output checks — `bin/storyline` writes usage to stderr.
- The `find` binary via spawnSync is a safe way to enumerate generated files without shell glob expansion.
- Each CLI test that writes output gets its own `tmp()` dir cleaned up in `afterEach`.
- CLI happy-path test uses the real `.storyline/blueprint.yaml` as a model file — integration risk if blueprint context count changes dramatically (more files generated, slower test; count assertions become non-deterministic).
- The no-args usage test: always assert exit code non-zero AND expected string. Checking only the string is insufficient — a bug could write the right text and exit 0.
- `main()` uses `parseArgs` with `strict: false` — unknown flags are silently ignored, NOT rejected. This is a design choice that prevents the "unexpected flag" failure mode but also means flag typos (e.g. `--modle`) produce no error, just a missing-value usage error.

## Technical Task Entry Point (Session 2026-04-06) — DECISIONS REACHED

- The new entry point bypasses Discovery and Specification entirely. Primary risk: security-triage and scope-review that normally happen in Three Amigos are never triggered.
- Phase-tracking invariant ("exactly one phase in_progress") is immediately at risk — the phase sequence for a technical task is not defined. Pre-condition for implementation: enumerate valid phase names as a closed list in Orchestration invariants. Phase sequence for technical path: Technical Brief → (Optional Specification) → Implementation.
- Blueprint referential integrity: Option 2 agreed as preference — `technical-brief.yaml` IS the specification artifact that satisfies `feature_files` reference check. Add `spec_type: gherkin | brief` to blueprint commands rather than a `type: technical` changeset override. The traceability invariant must hold; only the file type is relaxed.
- "Who decides a change is technical?" — two-gate model agreed: (1) MCQ at intake as routing signal, (2) required `public_interface_change: yes/no` field in the brief as a catch-for-mistakes gate. If `public_interface_change: yes`, pipeline surfaces a routing warning before proceeding.
- Security triage: `security_surface` field must be required, non-defaultable, and carry a hard branch consequence. If anything other than `none`, `security_review_requested: true` must be set, Security Amigo must be dispatched before The Onion starts, and the changeset may not begin until a review artifact exists.
- Developer Amigo proposes Gherkin optional — agreed, but the brief facilitator must explicitly ask "observable behavior?" and record the answer as a structured field, not just skip silently.
- Option B (`the-brief` as standalone skill) accepted by all. Foreman must auto-route there via MCQ, preserving the single-entry-point promise.
- Two-codepath risk in The Onion: if The Brief feeds The Onion directly, The Onion's step-1 ("read feature files for acceptance tests") may fail. The Onion needs a guard: "if no feature files exist, use acceptance criteria from the technical brief."

## Things To Watch Out For
- Any solution that relies on agent discipline (prompt instructions alone) will fail in long sessions. Already proven by the housekeeping problem.
- String matching on Bash command content for PostToolUse is fragile — commands can be chained with `&&`, wrapped in subshells, etc.
- Phase names are not formally defined as an enum anywhere. Any CLI that accepts `--phase` must validate strictly or agents will pass inconsistent values.
- When reviewing multi-phase changesets: phase stubs (throw-on-call exports) are valid for phase-1 — do NOT flag them as missing coverage unless the phase that implements them has been completed.
