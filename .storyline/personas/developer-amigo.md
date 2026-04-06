# Developer Amigo -- Project Notes

## Architecture & Code Patterns

- Single blueprint.yaml is the core contract -- every skill/agent starts by reading it
- CLI (`scripts/blueprint.ts`, wrapped by `bin/storyline`) handles all structural mutations via yaml library
- Hooks in `hooks/hooks.json`: SessionStart (3 hooks), PostToolUse (Edit|Write matcher for blueprint auto-validate), SubagentStop (amigo memory check)
- Agent frontmatter supports: name, description, tools, skills, model, permissionMode
- Skills are markdown files with YAML frontmatter; agents are similar but dispatched as subagents
- Skills total 1,897 lines across 8 files; only YAML frontmatter is parsed by tooling -- rest is LLM prompt context
- XML tag conventions in skills: `<HARD-GATE>`, `<todo-actions>`, `<bash-commands>`, `<user-question>`, `<agent-dispatch>`, `<branch-todos>`

## Skills vs Feature Files — Spec Layer Architecture

- 11 `.feature` files in `.storyline/features/` already specify pipeline/skill behavior (all tagged `@surveyed` — generated from observed behavior, not spec-first)
- Skills contain categories that have no Gherkin equivalent: persona establishment, hard gates, tool requirements, bash command blocks, agent dispatch templates
- Skills cannot be automatically tested against Gherkin — LLM behavior is non-deterministic, no test runner exists
- "Skills as Gherkin" viable interpretations: (A) replace SKILL.md = unsafe; (B) parallel spec files = duplication risk; (C) embed Gherkin at decision points = lowest risk
- Two levels of feature files conceptually: Level 1 (target project features) and Level 2 (plugin's own behavior specs) — currently conflated in `.storyline/features/`
- SETTLED (Round 2, 2026-04-06): real pain is authoring discipline (no spec-first rule for skill edits), not format change

## Skills as Gherkin — Settled Conclusions (2026-04-06)

- The `@surveyed` tag on all feature files is a confession: this pipeline enforces BDD discipline on users but not on itself
- Minimum viable fix: add spec-first convention to `skills/CONVENTIONS.md` + fill missing scenario gaps in existing `.feature` files
- No Gherkin goes inside SKILL.md files — convention update + coverage extension is the correct deliverable
- Fenced Gherkin in SKILL.md is only safe with explicit prose framing before the fence ("for reference," "this illustrates")
- Bare (unfenced) Gherkin in prose sections of any skill is unsafe — LLM may treat as instruction
- Mister Gherkin's existing Gherkin fences are safe because surrounding prose makes intent clear (examples, not instructions)
- Priority coverage gaps: Foreman Scenario 3 (current blueprint), Foreman hard gate respected, Three Amigos mode branching, Mister Gherkin quality gate sad path
- New spec-first scenarios should be distinguishable from `@surveyed` surveys — either no tag or a `@spec-first` tag convention
- Level 1 / Level 2 feature file collision (user features vs. plugin specs sharing `.storyline/features/`) is a real structural problem — flag as future feature, out of scope for this session

## Technical Constraints I've Learned

- PostToolUse hooks run AFTER the tool completes -- they cannot block or prevent actions
- Hook stdout is returned to the LLM as a system message (hint, not blocker)
- PostToolUse matcher `Edit|Write` does NOT catch blueprint mutations via `blueprint add-*` Bash commands
- There is no PreCommit or PhaseComplete hook type in Claude Code
- Blueprint validate runs ~200ms -- fast enough for PostToolUse hooks
- The Edit tool requires old_string to be unique in the file -- large blueprints make this harder and more token-expensive

## Blueprint Size Analysis

- This plugin's own blueprint is ~690 lines (6 contexts, 7 aggregates, 20+ glossary terms)
- Real production projects hit 2500+ lines easily
- Every pipeline phase reads the full blueprint -- major token multiplier
- Summary/view CLI approach can reduce token consumption 80%+ for most reads without schema changes

## Housekeeping Gaps

- No mechanism enforces stamp before commit
- No mechanism cleans up workbench/ after phases
- PostToolUse doesn't catch CLI mutations (only Edit/Write)
- Agent discipline degrades in long sessions -- prompt instructions are not enforcement

## Solution Directions (refined after Ronde 2, 2026-04-04)

- Do NOT split blueprint into multiple files -- Testing Amigo's referential integrity argument confirms this would be too complex
- `blueprint summary` CLI: meta + tech_stack + per-context names/descriptions/counts. Target: 80-120 lines for a 2500-line blueprint
- `blueprint view --context X [--with-deps]` CLI: full context detail + relationship target names. Target: 300-500 lines per context
- `blueprint view --section glossary|gaps|questions` CLI: section extraction
- Skills get rewritten to read summary by default, view on demand -- 70-85% token reduction
- `blueprint housekeeping [--cleanup]`: validate + stamp, optional cleanup. Cleanup REFUSES to run with uncommitted workbench changes (commit-before-cleanup ordering)
- PostToolUse extended to match Bash calls containing `blueprint` for auto-validation
- estimation-report.md should move from workbench/ to plans/ (it's a user artifact, not transient)

## Key Insight: Read vs. Validate Separation

The view does NOT need to be referentially complete -- it's a read-aid for context. Referential integrity is ensured by `blueprint validate` running on the full file (PostToolUse hook, CLI). This means agents can safely work with partial views: they get enough context to make good decisions, and the validation layer catches cross-reference errors. This insight resolves the Testing Amigo's concern that splitting would require 60-80% of the blueprint.

## Per-Agent Context Needs (mapped in Ronde 2)

- Foreman, Scout: summary only (meta + names + counts)
- Product/Testing Amigo: summary + relevant context detail + gaps/questions
- Developer Amigo, The Onion: tech_stack + full target context + relationship names
- Mister Gherkin: specific aggregate/command detail only
- Sticky Storm: all events/commands/aggregates across all contexts (event uniqueness invariant)
- Doctor Context: full blueprint (refines context boundaries) + open changeset (writes invariants and relationships to domain_model_delta, not to blueprint)

Only Sticky Storm and Doctor Context truly need the complete blueprint.

## scaffold.ts Port (CS-2026-04-05-scaffold-ts-port) — COMPLETE

- All 36 tests green; `scaffold.py` deleted; `bin/storyline scaffold` dispatcher live
- `loadModel` uses `yaml` npm package (`parse` from `"yaml"`) — same dep as `blueprint.ts`
- `toSnakeCase` inserts `_` before every uppercase letter at position > 0: `InvoiceID` → `invoice_i_d`
- `loadModel` throws `Error` (never `process.exit`) — unit tests call it directly safely
- Key TS divergence: `generateTypescript` skips `application/` + `infrastructure/` when aggregate has no commands; `generatePython` always creates all four layers — intentional and tested
- `printSummary` uses `process.stdout.write`, not `console.log` — test suite intercepts at that level
- Both generators accept `events_produced`/`commands_handled` as aliases for `events`/`commands` (legacy JSON backwards compatibility)
- Both generators embed invariant comments and commented-out import stubs in generated files
- `--lang` is validated before `loadModel` is called — prevents filesystem side-effects on bad input

### Spec gaps found during post-implementation review (see workbench/amigo-notes/developer.md)

- Value object generation (TS + Python) — tested in test-scaffold.ts, not in scaffold.feature
- Python divergence on empty-aggregate behavior — no Gherkin scenario documents it
- Sad-path: invalid `--lang` argument — not in the spec
- `printSummary` fourth line ("Next step: write your first acceptance test!") — tested, not specified
- Python event and command handler file generation — no Gherkin scenarios
- Feature-file references in TS handler docblocks — implementation detail, not specified

### ESM/tsx module execution pattern (critical for this codebase)

- tsx loads scripts via `node --import tsx/dist/esm/index.mjs` — ESM mode
- Calling `main()` unconditionally at module bottom breaks test imports (test runner imports the module, main() fires with wrong argv)
- The correct guard: `if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) { main(); }`
- `fileURLToPath` must be imported at the top level with `import { fileURLToPath } from "node:url"`
- `blueprint.ts` and `changeset.ts` call `main()` unconditionally — they are never imported by test files (tests use spawnSync), so no guard is needed there
- `scaffold.ts` IS imported by `test-scaffold.ts` directly — guard is essential

### bin/storyline dispatcher pattern

- No-args case must be handled BEFORE any `elif` branching: check `[ -z "$FIRST_ARG" ]` first, print usage, exit 1
- Adding a new sub-command: add `elif [ "$FIRST_ARG" = "X" ]; then shift; exec node --import ... scripts/X.ts "$@"`
- Usage block lives in bin/storyline for cross-script commands; individual scripts print their own detailed usage on bad args

## Technical Entry Point Feature (2026-04-06)

### The problem being solved
The pipeline always routes through Three Amigos → Mister Gherkin, which forces a user story framing. Technical tasks (migrations, refactors, dependency replacements, CLI additions) don't fit this frame.

### Key code locations
- The forced reframe is in `skills/the-foreman/SKILL.md` Scenario 4: "If not already a user story, reframe it..."
- Three Amigos `skills/three-amigos/SKILL.md` Step 2 hardwires the user story structure
- Example map format (`skills/three-amigos/example-map-format.yaml`) has top-level `story:` field

### Architecture decision (settled after Ronde 2)
**Option B (new `the-brief` skill) is the correct architecture.** The Foreman is a coordinator, not a facilitator — intake logic for a new work type belongs in a dedicated agent, not inside the Foreman's decision tree. The brief-facilitator is one agent (not a multi-persona session).

### How the user signals "technical task"
Must be explicit — MCQ at Foreman intake, not auto-detection. Heuristics will misclassify ambiguous inputs ("add CLI command for X" could go either way).

### feature_files referential integrity — the hard constraint (from Testing Amigo)
`storyline validate` enforces referential integrity on `feature_files`. Two paths forward:
- **Option 1 (preferred long-term)**: add `technical_task: true` flag to blueprint commands; validation exempts `feature_files` requirement for those commands. Requires schema + validation code changes.
- **Option 2 (preferred for MVP)**: require `the-brief` to always produce at least one lightweight feature file (technical acceptance criteria in minimal Gherkin). No schema changes, preserves existing validation invariant unchanged.
- **Do not let technical tasks create dangling references.** This is a hard constraint, not a preference.

### Phase enumeration gap
Phase names are not formally enumerated anywhere. Technical path adds "Technical Brief" as a valid phase. Must be added to Orchestration invariants before implementation or phase tracker will reject the sequence: Orchestration → Technical Brief → (optional Specification) → Implementation.

### Required fields in technical-brief.yaml
- `task:` — what changes and why (replaces `story:`)
- `criteria[]` — acceptance criteria (replaces `rules[]`)
- `security_surface: none | input-handling | auth | external-api | data-storage` — explicit triage; if not `none`, dispatch Security Amigo
- `public_interface_change: yes | no` — forces contributor to declare backward-compatibility impact
- `scope: single-context | cross-cutting` — feeds changeset `touches[]`

### Blueprint domain objects needed
- `StartTechnicalTask` command in Orchestration/PipelineSession
- `RunTechnicalBrief` in Discovery/DiscoverySession (or new context — open question)
- `TechnicalBriefProduced` event

### Changeset metadata `type:` field — does not exist yet
The changeset `meta:` block has no `type:` field. Each phase has `type: addition|removal|modification`, but the changeset itself is untyped at the meta level. Adding `type: technical` requires a schema change in the YAML template and a corresponding check in `changeset validate` logic in `scripts/blueprint.ts`. Small but must be deliberate — do not add silently or the validator will ignore it.

### Foreman routing: new Scenario 5, not a branch inside Scenario 4
Scenario 4 is "blueprint exists AND user specifies a feature." A technical task must be Scenario 5 — "blueprint exists AND user specifies a technical task." Adding a conditional inside Scenario 4 would make it two-headed. The MCQ clarifying question fires before scenario routing; the answer determines which scenario fires.

### The Onion reads feature files directly — not only via changeset
Confirmed from SKILL.md: The Onion's Step 0 explicitly reads `.storyline/features/*.feature` alongside the blueprint. If a technical task produces no feature files, The Onion has no acceptance tests to start from. Option 2 (technical-brief.yaml listed as a feature_files reference) resolves this. The Onion needs one guard: "If feature files are absent but technical-brief.yaml exists, use its `criteria[]` as acceptance test inputs."

### Testing Amigo's three options — Option 2 is the right fit for Option B
Option 1 (conditional feature_files exemption): cleanest long-term but requires schema + validation code changes.
Option 2 (brief as specification artifact, listed in feature_files): no schema changes, preserves validation invariant — start here.
Option 3 (technical_task: true flag on commands): most invasive, creates two-tier command model — avoid.

### Changeset scope note
Cross-cutting vs. single-context: the changeset `touches[]` format already handles this. No new data structure needed for The Onion.

## Sticky Storm — Changeset delta pattern (2026-04-06)

- Sticky Storm no longer calls `storyline add-event` or `storyline add-command`
- Discoveries go into `domain_model_delta` in the open changeset YAML (`.storyline/changesets/`)
- `applied: false` on all entries — The Onion or a later phase applies them to blueprint.yaml
- Precondition gate: no open changeset (`draft` or `in_progress`) → Sticky Storm stops and tells Foreman
- Commit includes only the changeset file unless glossary terms were written (blueprint stays clean)

## Workbench Lifecycle Rules

| Artifact | Safe to clean after | Notes |
|---|---|---|
| example-map.yaml | Mister Gherkin completes | Created by Three Amigos |
| events-raw.md | Doctor Context completes | Created by Sticky Storm |
| amigo-notes/*.md | Build completes | Used by Foreman synthesis + Crew |
| estimation-report.md | NEVER auto-clean | Move to plans/ -- it's a stakeholder artifact |
