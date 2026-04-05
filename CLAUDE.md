# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code plugin (`storyline`) that provides a complete Behavior-Driven Development pipeline as a set of interconnected skills. It guides teams from requirements discovery through Gherkin scenarios, Event Storming, and DDD modeling to outside-in implementation. The primary use case is onboarding an existing codebase and adding features through the BDD phases.

## Plugin Structure

```
.claude-plugin/plugin.json        <- Plugin manifest (name, version, author)
scripts/
  blueprint.ts                    <- Blueprint CLI (TypeScript) — validate, stamp, summary, view, housekeeping, add-*
  test-blueprint.ts               <- Tests for the CLI (node:test, 30 tests)
templates/
  blueprint-schema.yaml           <- Full example blueprint showing all fields and types
skills/
  the-foreman/SKILL.md            <- The Foreman — pipeline entry point and build director
  the-scout/SKILL.md              <- Phase 0: Project scanning + backlog capture
  three-amigos/SKILL.md           <- Phase 1: Discovery sessions (Example Mapping)
  persona-memory/SKILL.md         <- Shared conventions for persona memory files
  mister-gherkin/SKILL.md         <- Phase 2: Gherkin scenario formalization
  the-appraiser/SKILL.md           <- Triangulated estimation — The Appraiser (PERT, WBS, T-Shirt)
  the-onion/SKILL.md              <- Phase 5: Outside-in TDD implementation
scripts/
  scaffold.ts                     <- Code scaffolding from blueprint (TypeScript port)
agents/
  foreman.md                      <- Subagent: The Foreman's site inspector
  surveyor.md                     <- Subagent: reverse-engineers codebase into blueprint
  sticky-storm.md                 <- Agent: Event Storming — discovers events from scenarios
  doctor-context.md               <- Agent: DDD modeling — refines contexts, invariants, glossary
  product-amigo.md                <- Persona: business perspective for Three Amigos
  developer-amigo.md              <- Persona: technical perspective for Three Amigos
  testing-amigo.md                <- Persona: quality/risk perspective for Three Amigos
  frontend-amigo.md               <- Persona: UI/UX perspective (optional, when feature has frontend scope)
  security-amigo.md               <- Security audit after implementation (optional, when feature touches auth/input/data)
  quartermaster.md                <- Agent: researches packages/libraries before implementation — build vs. buy decisions
references/
  ddd-patterns.md                 <- DDD patterns quick reference (used by Doctor Context)
```

## Pipeline Flow

```
The Foreman -> The Scout -> Three Amigos -> Mister Gherkin -> Quartermaster -> The Foreman -> The Onion -> The Foreman
(Entry)       (Capture)    (Discover)       (Specify)         (Tech Research)  (Orchestrate)  (Build)     (Build Director)
                                                                                    |
                                                                            Sticky Storm (agent, if needed)
                                                                            Doctor Context (agent, if needed)
```

## The Blueprint

All pipeline state lives in a single file: `.storyline/blueprint.yaml` in the target project. It contains tech stack, bounded contexts (with aggregates, commands, events, policies, relationships), glossary, gaps, and open questions. Feature files (`.feature`) are the detailed behavioral specs the blueprint points to.

Target project directory structure:
```
.storyline/
  blueprint.yaml              <- Single source of truth for the app's architecture
  features/                   <- Gherkin scenarios (permanent)
  changesets/                 <- Structured YAML implementation plans (CS-YYYY-MM-DD-<slug>.yaml)
  workbench/                  <- Transient phase docs (example-map.yaml, events-raw.md, estimation-report.md, tech-choices.md)
  sessions/                   <- Completed session archives (one per feature: example-map, amigo-notes, tech-choices, manifest)
  personas/                   <- Persona memory (accumulated project knowledge per amigo)
  backlog/                    <- Feature ideas waiting to enter the pipeline
```

## Blueprint CLI (`bin/storyline`)

Requires: Node.js 18+, dependencies installed via `npm install` (yaml, tsx)

```bash
# Core commands
storyline init --project "Name"     # Initialize empty blueprint
storyline validate [--strict]        # Validate schema + referential integrity (read-only)
storyline stamp                      # Update timestamp + increment version
storyline summary                    # Compact overview (~80-120 lines for large blueprints)
storyline view --context "Payment"   # Full detail for a single bounded context
storyline housekeeping               # Validate + stamp (skip if up to date)
storyline housekeeping --cleanup     # + remove committed workbench artifacts
storyline housekeeping --cleanup --phase three-amigos  # Phase-specific cleanup

# Structural mutations (agents use these instead of Edit for list insertions)
storyline add-context "Payment"
storyline add-aggregate --context "Payment" --name "Invoice"
storyline add-event --context "Payment" --aggregate "Invoice" --name "InvoiceSent" --payload "invoiceId,amount"
storyline add-command --context "Payment" --aggregate "Invoice" --name "SendInvoice" --feature-files "invoicing.feature"
storyline add-glossary --term "Invoice" --context "Payment" --meaning "A request for payment"
storyline add-gap --description "Missing tests" --severity "important" --affects "Payment"
storyline add-question --question "How do refunds work?" --severity "important" --raised-during "Three Amigos" --affects "Payment"
storyline archive --feature "Shopping Cart"   # Archive session artifacts → sessions/YYYY-MM-DD-shopping-cart/

# Changeset commands (storyline changeset <cmd>)
storyline changeset init --title "<title>"         # Scaffold a new changeset file
storyline changeset validate [--json] [<id>]       # Validate one or all changesets

# Run tests
npx tsx --test scripts/test-blueprint.ts
```

## Blueprint Read Convention (Decision Tree)

Skills follow this convention for reading the blueprint:
1. **Summary by default** — `storyline summary` for orientation (most agents)
2. **Context view for targeted work** — `storyline view --context X` when editing a specific context
3. **Full read only for cross-context agents** — Sticky Storm (event uniqueness) and Doctor Context (boundary modeling)

## Plugin Versioning

**Bump the version in `.claude-plugin/plugin.json` with every feature commit.** Claude Code's `/plugin upgrade` only triggers when the version changes — users won't get updates otherwise. Use semver: `MAJOR.MINOR.PATCH`.

## Git Commits

- Do NOT add `Co-Authored-By` lines to commit messages
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`

## Agent Workflow

After editing the blueprint, every skill follows this workflow:
```
Edit blueprint (Edit tool for scalar updates, CLI helpers for list insertions)
  -> storyline validate
  -> fix errors if any, re-validate
  -> storyline stamp
  -> git commit
```

## Key Design Decisions

- Single `blueprint.yaml` replaces 9+ scattered artifact files — agents read one file to understand the app
- Feature files are referenced at the command level (`feature_files` list), with `@command:X` tags in `.feature` files for reverse traceability
- The validation script is the guardrail against agent drift — schema validation, referential integrity checks, and structured error reporting for agent consumption
- CLI helpers handle YAML list insertions to avoid Edit tool formatting risks; Edit is used for updating existing scalar values
- Pipeline progress is tracked via TodoWrite with exactly one phase `in_progress` at a time
- Skills support non-linear usage — users can skip phases or start at any point
- The Foreman is the entry point — auto-detects what's needed (onboarding, feature, as-built survey) and starts the right phase
- The Foreman returns at the end as Build Director — presents implementation choice (continue here, new session, or "The Crew" with amigos as implementers)
- In "The Crew" mode, Developer Amigo builds and Testing Amigo reviews tests, reusing their context from the discovery session
- Surveyed (baseline) artifacts are tagged `@surveyed` to distinguish from new pipeline-produced work
- Three Amigos supports two modes: quick scan (single AI, all perspectives) and full session (three parallel persona agents with persistent memory in `.storyline/personas/`)
- Working documents (example-map.yaml, events-raw.md) are transient — they live in `workbench/` during a pipeline run; implementation plans are structured YAML changesets in `changesets/` as `CS-YYYY-MM-DD-<slug>.yaml` files — validated against the blueprint, with phases, touches, and migration strategies
- `example-map.yaml` contains both `questions:` (unknowns) and `assumptions:` (things assumed known, with confidence level and consequence-if-wrong) — making hidden assumptions visible before they become bugs
- The Quartermaster runs after Mister Gherkin and writes `workbench/tech-choices.md` — package/library recommendations per technical capability, so The Onion starts with build-vs-buy decisions already made
- Completed sessions are archived to `sessions/YYYY-MM-DD-feature/` via `storyline archive` — workbench is then cleaned up
