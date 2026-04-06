---
name: the-scout
description: Use when the user wants to capture new feature ideas into the backlog, scan the project for gaps, or analyze the codebase for opportunities — before starting a Three Amigos discovery session.
---

# The Scout

<todo-actions>
- Scout: checking for the blueprint
- Scout: surveying the terrain — filling tech_stack if needed
- Scout: validating and stamping the blueprint
- Scout: cataloguing the backlog targets
- Scout: briefing the team on what's out there
</todo-actions>

**Pipeline:** The Foreman (`/storyline:the-foreman`) → **The Scout (this)** → Three Amigos (`/storyline:three-amigos`) → Mister Gherkin (`/storyline:mister-gherkin`) → Foreman orchestrates [Sticky Storm + Doctor Context agents if needed] → The Onion (`/storyline:the-onion`) → The Foreman

## What You Do

### 0. Check for the Blueprint First

<bash-commands>
```bash
storyline summary 2>/dev/null || echo "no blueprint yet"
```
</bash-commands>

**If `blueprint.yaml` exists**: Full project picture available — tech stack, bounded contexts, domain model, gaps, open questions. **Skip the full codebase scan.** Orient the team on blueprint contents, capture new ideas into the backlog, suggest next pipeline phase.

**If `blueprint.yaml` does not exist**: Initialize one.

<bash-commands>
```bash
storyline init --project "Project Name"
```
</bash-commands>

Ask the user for the project name if it isn't obvious. This creates a minimal `blueprint.yaml` with `meta` fields set. Then fill in the `tech_stack` section (Step 1 below).

The key principle: **The Scout no longer explores the codebase from scratch.** The blueprint is the single source of truth. Read it, fill gaps, capture ideas.

### 1. Fill the `tech_stack` Section

If the blueprint's `tech_stack` section is empty or missing, use an Explore subagent to gather what's needed, then fill it in via Edit on `blueprint.yaml`:

<agent-dispatch subagent_type="Explore" thoroughness="very thorough">
prompt: |
  Analyze this project and report:
  1. TECH STACK: Languages, frameworks, package managers, key dependencies
  2. ARCHITECTURE: Project structure, module organization, entry points
  3. PATTERNS: Design patterns used (MVC, DDD, event-driven, CQRS, etc.)
  4. EXISTING DOMAIN: Models/types/entities found, their relationships
  5. APIs: Existing endpoints, routes, controllers
  6. DATA: Database schemas, migrations, seed data
  7. TESTS: Test framework, test organization, coverage patterns
  8. CI/CD: Build tools, deployment config, pipeline files
  9. EXISTING BDD: Any .feature files, step definitions, BDD-related code
  10. KEY FILES: The 10-15 most important files to understand the project
</agent-dispatch>

Then edit `blueprint.yaml` directly to populate `tech_stack`. Follow the schema in `templates/blueprint-schema.yaml`:

```yaml
tech_stack:
  language: "TypeScript"
  framework: "NestJS"
  runtime: "Node.js 20"
  package_manager: "npm"
  test_framework: "Jest"
  key_dependencies:
    - name: "@nestjs/core"
      version: "10.x"
      purpose: "Application framework"
    - name: "typeorm"
      version: "0.3.x"
      purpose: "Database ORM"
    - name: "jest"
      version: "29.x"
      purpose: "Test framework"
```

**Do not write a separate `project-context.json` or `project-context.md`.** All context lives in `blueprint.yaml`.

### 2. Validate and Stamp the Blueprint

<bash-commands>
```bash
storyline validate
```
</bash-commands>

Fix errors in `blueprint.yaml` and re-validate until clean. Then:

<bash-commands>
```bash
storyline stamp
```
</bash-commands>

This updates `meta.updated_at` and increments `meta.version` — do not skip it.

### 3. Capture Ideas into the Backlog

Read the blueprint, then capture what the user wants to build. Ideas come from many sources:
- Direct request: "I want to add a shopping cart"
- Bug reports: "Users are losing their cart when they log out"
- Strategic goals: "We need to support multi-language"
- Technical debt: "The payment code is a mess, needs restructuring"

For each idea, create a file in `.storyline/backlog/<slug>.md`:

```markdown
# Feature: <title>

**Source:** <user request | bug report | strategic goal | technical debt>
**Date:** <ISO date>

## Raw Idea
<description>

## Initial Context (from blueprint)
- <relevant existing entities, storage, relationships>

## Open Questions (pre-Three Amigos)
- <questions that need answering before the session>

## Ready for Three Amigos?
<Yes / Not yet — reason>
```

One file per backlog item. Flat directory.

### 4. Pipeline Initialization

When `.storyline/` doesn't exist yet, create the structure:

<bash-commands>
```bash
mkdir -p .storyline/{features,workbench,backlog}
```
</bash-commands>

The simplified structure:

```
.storyline/
├── features/       # Finalized .feature files (input to The Onion)
├── workbench/      # In-progress BDD work for the current feature
└── backlog/        # One .md file per backlog idea
blueprint.yaml      # Single source of truth for the project
```

If it's a new project that needs BDD tooling, suggest the appropriate Cucumber/BDD package for the detected `tech_stack`.

## When to Re-Orient

Suggest refreshing `tech_stack` (via Surveyor) when:
- `meta.updated_at` is more than a week old
- A major feature was completed
- User switches to a different part of the codebase

## After Intake

Report how many backlog items exist and which are ready for Three Amigos. Guide the user to next step:
- Backlog items ready → suggest `/storyline:three-amigos`
- Open questions remain → surface them before proceeding
- Brand new project → invite feature description, then create backlog item
- Overall status → suggest `/storyline:the-foreman`

### Commit Convention

<bash-commands>
```bash
git add blueprint.yaml .storyline/
git commit -m "scout: fill tech_stack and capture initial backlog"
```
</bash-commands>
