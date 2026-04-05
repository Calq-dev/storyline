# Storyline — From Idea to Working Code

A Claude Code plugin that applies BDD principles to guide software development from discovery through implementation. You describe what you want to build, and a crew of specialized AI agents takes it from exploration through working code.

> **A note on BDD:** Storyline applies BDD-inspired principles to enforce methodical thinking before implementation — it is not a BDD framework. It does not replace the human conversations and executable specifications that real BDD requires. The loop is not fully closed without a BDD framework (Cucumber, SpecFlow, etc.) running Gherkin scenarios as automated tests in your project — that integration is intentionally out of scope for this plugin.

## What It Does

You say "I want to add shopping cart persistence" and the pipeline:

1. **The Foreman** assesses the project, checks the blueprint, starts the right process
2. **Three Amigos** explore the feature from three perspectives (Product, Developer, Testing) — writing shared notes and challenging each other
3. **Mister Gherkin** formalizes the rules into concrete Gherkin scenarios, pushing back on anything vague
4. **The Quartermaster** researches packages and libraries for what needs to be built — before anyone writes code
5. **Sticky Storm** discovers the domain events hiding inside the scenarios (dispatched only if needed)
6. **Doctor Context** refines bounded contexts, invariants, and the domain glossary (dispatched only if needed)
7. **The Onion** plans the implementation layer by layer, outside-in
8. **The Foreman** returns as Build Director — lets you choose how to build: continue here, new session, or **The Crew** (the amigos who discovered the feature now build it)

Everything flows automatically. The pipeline pauses only when human input is needed — vague rules, blocking questions, build approach decisions.

## The Blueprint

All project knowledge lives in one file: `.storyline/blueprint.yaml`. Agents read this instead of exploring the codebase every time. It contains:

- Tech stack
- Bounded contexts with aggregates, commands, events, policies
- Glossary (ubiquitous language)
- Gaps and open questions

Feature files (`.feature`) contain the detailed behavioral specs. The blueprint points to them.

A validation script (`storyline`) enforces schema and referential integrity — agents can't corrupt the structure.

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
| The Quartermaster | Agent | Package/library research before implementation — build vs. buy decisions |
| Sticky Storm | Agent | Event Storming (dispatched when needed) |
| Doctor Context | Agent | DDD modeling (dispatched when needed) |
| Product Amigo | Agent | Business perspective persona |
| Developer Amigo | Agent | Technical perspective persona |
| Testing Amigo | Agent | Quality/risk perspective persona |
| Frontend Amigo | Agent | UI/UX perspective persona (optional) |
| Security Amigo | Agent | Post-implementation security audit (optional) |

## Storyline CLI

```bash
storyline init --project "Name"
storyline validate [--strict]
storyline stamp
storyline add-context "Payment"
storyline add-aggregate --context "Payment" --name "Invoice"
storyline add-event --context "Payment" --aggregate "Invoice" --name "InvoiceSent" --payload "invoiceId,amount"
storyline add-command --context "Payment" --aggregate "Invoice" --name "SendInvoice" --feature-files "invoicing.feature"
storyline add-glossary --term "Invoice" --context "Payment" --meaning "A request for payment"
storyline add-gap --description "Missing tests" --severity "important" --affects "Payment"
storyline add-question --question "How do refunds work?" --severity "important" --raised-during "Three Amigos" --affects "Payment"
```

## Roadmap

- [ ] **Living Documentation** — generate readable project documentation from feature files + blueprint
- [ ] **Continuous Validation** — CI/CD integration to run Gherkin scenarios on every commit
- [ ] **Executable specs bridge** — guidance for wiring `.feature` files to a BDD framework (Cucumber, SpecFlow, Behave) in the target project, closing the feedback loop between specification and running tests
- [ ] **Refactoring support** — use the pipeline for restructuring existing code (currently focused on new features)
- [ ] **Greenfield projects** — full project scaffolding from scratch (currently focused on existing codebases)

## License

MIT

## Author

Jan Krikken — [Calq](https://calq.nl)
