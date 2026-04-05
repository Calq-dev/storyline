# Storyline — From Idea to Working Code

A Claude Code plugin that combines **BDD**, **DDD**, and **TDD** to guide software development from discovery through implementation. You describe what you want to build, and a crew of specialized AI agents takes it from exploration through working code — each principle doing its job at the right moment.

> **BDD** surfaces shared understanding before anyone touches code. **DDD** gives that understanding a precise model: bounded contexts, aggregates, events, ubiquitous language. **TDD** closes the loop by building from the outside in, one failing test at a time. Storyline enforces this sequence — it's not possible to skip to implementation without first specifying behavior and modeling the domain.

> **Note:** Storyline applies these principles structurally — it is not a BDD framework. The loop is not fully closed without a framework like Cucumber, Behave, or SpecFlow running Gherkin scenarios as automated tests in your project. That integration is intentionally out of scope.

## What It Does

You say "I want to add shopping cart persistence" and the pipeline:

1. **The Foreman** assesses the project, checks the blueprint, starts the right process
2. **Three Amigos** explore the feature from three perspectives (Product, Developer, Testing) — writing shared notes and challenging each other *(BDD)*
3. **Mister Gherkin** formalizes the rules into concrete Gherkin scenarios, pushing back on anything vague *(BDD)*
4. **The Quartermaster** researches packages and libraries before anyone writes code
5. **Sticky Storm** discovers the domain events hiding inside the scenarios *(DDD, dispatched when needed)*
6. **Doctor Context** refines bounded contexts, invariants, relationships, and the ubiquitous language glossary *(DDD, dispatched when needed)*
7. **The Onion** plans the implementation layer by layer, outside-in — acceptance test first, then the inner loop *(TDD)*
8. **The Foreman** returns as Build Director — lets you choose how to build: continue here, new session, or **The Crew**

Everything flows automatically. The pipeline pauses only when human input is needed — vague rules, blocking questions, build approach decisions.

## The Blueprint

All project knowledge lives in one file: `.storyline/blueprint.yaml`. Agents read this instead of exploring the codebase every time. It contains:

- **Tech stack** — language, framework, test runner, package manager
- **Bounded contexts** with aggregates, commands, events, policies, relationships, and invariants *(DDD)*
- **Glossary** — ubiquitous language per context *(DDD)*
- **Gaps and open questions** — flagged during discovery, resolved before implementation

Feature files (`.feature`) contain the detailed behavioral specs. The blueprint points to them via `feature_files` links.

A CLI (`storyline`) enforces schema and referential integrity — agents can't corrupt the structure.

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

Requires Node.js 18+. The blueprint CLI runs via `tsx` (installed with `npm install`).

## Usage

```bash
# Start the pipeline
/storyline:the-foreman

# Or with a feature description
/storyline:the-foreman add shopping cart persistence

# Jump straight to an existing plan
/storyline:the-foreman build shopping-cart
```

The Foreman auto-detects what's needed:
- No blueprint? He sends **The Surveyor** to map the codebase first
- Blueprint exists? He asks what feature to add
- Implementation plan ready? He presents build options

### The Surveyor

Before the pipeline can add features, it needs to understand what already exists. The Surveyor reverse-engineers your codebase into the blueprint — like a land surveyor mapping terrain before construction begins.

It runs in three modes:

- **Full survey** — first time on an existing project. Scans your codebase (tech stack, domain models, APIs, schemas, event patterns) and populates `blueprint.yaml` from scratch.
- **Incremental survey** — blueprint exists but code has changed. Re-scans only what's different.
- **As-built survey** — after The Onion finishes. Compares what was planned with what was built and updates the blueprint to match reality.

The Foreman dispatches the Surveyor automatically.

## Project Structure (in your project)

```
.storyline/
  blueprint.yaml        # Single source of truth
  features/             # Gherkin scenarios (permanent)
  plans/                # Implementation plans (one per feature, dated)
  workbench/            # Transient docs (example map, event notes, tech choices)
  sessions/             # Completed session archives
  personas/             # Persona memory (grows across sessions)
  backlog/              # Feature ideas waiting to enter the pipeline
```

## Pipeline Skills & Agents

| Component | Type | Role |
|---|---|---|
| The Foreman | Skill | Entry point + build director |
| The Scout | Skill | Project scanning + backlog capture |
| Three Amigos | Skill | Discovery sessions with persona agents *(BDD)* |
| Mister Gherkin | Skill | Gherkin scenario formalization *(BDD)* |
| The Appraiser | Skill | Triangulated estimation (PERT + WBS + T-Shirt) |
| The Onion | Skill | Outside-in TDD implementation planning *(TDD)* |
| Surveyor | Agent | Reverse-engineers codebase into blueprint |
| The Quartermaster | Agent | Package/library research — build vs. buy decisions |
| Sticky Storm | Agent | Event Storming *(DDD)* |
| Doctor Context | Agent | Bounded context modeling *(DDD)* |
| Product Amigo | Agent | Business perspective persona |
| Developer Amigo | Agent | Technical perspective persona |
| Testing Amigo | Agent | Quality/risk perspective persona |
| Frontend Amigo | Agent | UI/UX perspective persona (optional) |
| Security Amigo | Agent | Post-implementation security audit (optional) |

## Blueprint CLI

The `storyline` CLI is a TypeScript script (`scripts/blueprint.ts`) that agents use for all blueprint mutations. This ensures YAML round-trip safety — no agent ever writes raw YAML by hand.

```bash
# Lifecycle
storyline init --project "Name"
storyline validate [--strict]
storyline stamp
storyline housekeeping [--cleanup]
storyline session-init          # generate session ID for traceability

# Read
storyline summary
storyline view --context "Payment"

# Add domain model elements
storyline add-context "Payment"
storyline add-aggregate --context "Payment" --name "Invoice"
storyline add-event     --context "Payment" --aggregate "Invoice" --name "InvoiceSent" --payload "invoiceId,amount"
storyline add-command   --context "Payment" --aggregate "Invoice" --name "SendInvoice" --feature-files "invoicing.feature"
storyline add-glossary  --term "Invoice" --context "Payment" --meaning "A request for payment"

# Structural mutations (safe list insertions)
storyline add-relationship --context "Payment" --type "customer-supplier" --target "Ordering" [--via "description"]
storyline add-invariant    --context "Payment" --aggregate "Invoice" --invariant "Amount must be greater than zero"
storyline add-policy       --context "Payment" --name "RefundOnCancel" --triggered-by "OrderCancelled" --issues-command "IssueRefund"
storyline resolve-question --id "Q-001" --answer "Only for auth-related features"

# Track gaps and open questions
storyline add-gap      --description "Missing retry logic" --severity "important" --affects "Payment"
storyline add-question --question "How do refunds work?" --severity "important" --raised-during "Three Amigos" --affects "Payment"

# Session management
storyline archive --feature "Shopping Cart"
```

All timestamps (created, updated, resolved) are stored as ISO 8601 datetimes. Mutation commands automatically record a `session_id` when one is set via `session-init` — giving you traceability across agent mutations.

## Roadmap

- [ ] **Executable specs bridge** — guidance for wiring `.feature` files to Cucumber, Behave, or SpecFlow, closing the feedback loop between specification and running tests
- [ ] **Living Documentation** — generate readable project docs from feature files + blueprint
- [ ] **Continuous Validation** — CI/CD integration to validate the blueprint on every commit
- [ ] **Refactoring support** — use the pipeline for restructuring existing code

## License

MIT

## Author

Jan Krikken — [Calq](https://calq.nl)
