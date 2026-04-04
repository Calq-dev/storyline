# Storyline — From Idea to Working Code

A Claude Code plugin that guides software development through a complete Behavior-Driven Development pipeline. You describe what you want to build, and a crew of specialized AI agents takes it from discovery through implementation.

## What It Does

You say "I want to add shopping cart persistence" and the pipeline:

1. **The Foreman** assesses the project, checks the blueprint, starts the right process
2. **Three Amigos** explore the feature from three perspectives (Product, Developer, Testing) — writing shared notes and challenging each other
3. **Mister Gherkin** formalizes the rules into concrete Gherkin scenarios, pushing back on anything vague
4. **Sticky Storm** discovers the domain events hiding inside the scenarios (dispatched only if needed)
5. **Doctor Context** refines bounded contexts, invariants, and the domain glossary (dispatched only if needed)
6. **The Onion** plans the implementation layer by layer, outside-in
7. **The Foreman** returns as Build Director — lets you choose how to build: continue here, new session, or **The Crew** (the amigos who discovered the feature now build it)

Everything flows automatically. The pipeline pauses only when human input is needed — vague rules, blocking questions, build approach decisions.

## The Blueprint

All project knowledge lives in one file: `.storyline/blueprint.yaml`. Agents read this instead of exploring the codebase every time. It contains:

- Tech stack
- Bounded contexts with aggregates, commands, events, policies
- Glossary (ubiquitous language)
- Gaps and open questions

Feature files (`.feature`) contain the detailed behavioral specs. The blueprint points to them.

A validation script (`blueprint`) enforces schema and referential integrity — agents can't corrupt the structure.

## The Crew

The Three Amigos aren't just for discovery. In full session mode, they become implementation partners:

- **Developer Amigo** builds the code (with context from the discovery session)
- **Testing Amigo** reviews tests and adds edge cases (remembering the risks they flagged)
- **Frontend Amigo** handles UI work (optional — only when the feature has frontend scope)
- **Product Amigo** validates behavior matches intent

Each persona has **persistent memory** across sessions — they get smarter about your project over time.

## Install

```bash
# In Claude Code:
/plugin marketplace add https://github.com/Calq-dev/storyline.git
/plugin install storyline@calq
```

Requires Python 3.9+ (for blueprint validation). The plugin auto-installs its Python dependencies on first use.

## Usage

```bash
# Start the pipeline
/storyline:the-foreman

# Or with a feature description
/storyline:the-foreman add shopping cart persistence

# Check status anytime
/storyline:the-foreman where are we?
```

The Foreman auto-detects what's needed:
- No blueprint? He sends **The Surveyor** to map the codebase first
- Blueprint exists? He asks what feature to add
- Implementation plan ready? He presents build options

### The Surveyor

Before the pipeline can add features, it needs to understand what already exists. The Surveyor is a subagent that reverse-engineers your codebase into the blueprint — like a land surveyor mapping terrain before construction begins.

It runs in three modes:

- **Full survey** — first time on an existing project. Scans your entire codebase (tech stack, domain models, APIs, database schemas, event patterns) and populates `blueprint.yaml` from scratch. Also generates baseline `.feature` files tagged `@surveyed` to capture existing behavior.
- **Incremental survey** — the blueprint exists but code has changed. Re-scans only what's different and updates the blueprint accordingly.
- **As-built survey** — after The Onion finishes building a feature. Compares what was planned with what was actually built and updates the blueprint to match reality, like as-built drawings in construction.

The Foreman dispatches the Surveyor automatically — you don't invoke it directly.

## Project Structure (in your project)

```
.storyline/
  blueprint.yaml        # Single source of truth
  features/             # Gherkin scenarios (permanent)
  workbench/            # Transient docs (example map, event notes, estimation report)
  personas/             # Persona memory (grows across sessions)
  backlog/              # Feature ideas waiting to enter the pipeline
```

## Pipeline Skills & Agents

| Component | Type | Role |
|---|---|---|
| The Foreman | Skill | Entry point + build director |
| The Scout | Skill | Project scanning + backlog capture |
| Three Amigos | Skill | Discovery sessions with persona agents |
| Mister Gherkin | Skill | Gherkin scenario formalization |
| The Appraiser | Skill | Triangulated estimation (PERT + WBS + T-Shirt) |
| The Onion | Skill | Outside-in TDD implementation planning |
| Surveyor | Agent | Reverse-engineers codebase into blueprint (full, incremental, or as-built) |
| Sticky Storm | Agent | Event Storming (dispatched when needed) |
| Doctor Context | Agent | DDD modeling (dispatched when needed) |
| Product Amigo | Agent | Business perspective persona |
| Developer Amigo | Agent | Technical perspective persona |
| Testing Amigo | Agent | Quality/risk perspective persona |
| Frontend Amigo | Agent | UI/UX perspective persona (optional) |
| Security Amigo | Agent | Post-implementation security audit (optional) |

## Blueprint CLI

```bash
blueprint init --project "Name"
blueprint validate [--strict]
blueprint stamp
blueprint add-context "Payment"
blueprint add-aggregate --context "Payment" --name "Invoice"
blueprint add-event --context "Payment" --aggregate "Invoice" --name "InvoiceSent" --payload "invoiceId,amount"
blueprint add-command --context "Payment" --aggregate "Invoice" --name "SendInvoice" --feature-files "invoicing.feature"
blueprint add-glossary --term "Invoice" --context "Payment" --meaning "A request for payment"
blueprint add-gap --description "Missing tests" --severity "important" --affects "Payment"
blueprint add-question --question "How do refunds work?" --severity "important" --raised-during "Three Amigos" --affects "Payment"
```

## Roadmap

- [ ] **Living Documentation** — generate readable project documentation from feature files + blueprint
- [ ] **Continuous Validation** — CI/CD integration to run Gherkin scenarios on every commit
- [ ] **Refactoring support** — use the pipeline for restructuring existing code (currently focused on new features)
- [ ] **Greenfield projects** — full project scaffolding from scratch (currently focused on existing codebases)

## License

MIT

## Author

Jan Krikken — [Calq](https://calq.nl)
