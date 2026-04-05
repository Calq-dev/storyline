# Developer Amigo -- Project Notes

## Architecture & Code Patterns

- Single blueprint.yaml is the core contract -- every skill/agent starts by reading it
- CLI (`scripts/blueprint.ts`, wrapped by `bin/storyline`) handles all structural mutations via yaml library
- Hooks in `hooks/hooks.json`: SessionStart (3 hooks), PostToolUse (Edit|Write matcher for blueprint auto-validate), SubagentStop (amigo memory check)
- Agent frontmatter supports: name, description, tools, skills, model, permissionMode
- Skills are markdown files with YAML frontmatter; agents are similar but dispatched as subagents

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
- Doctor Context: full blueprint (refines context boundaries)

Only Sticky Storm and Doctor Context truly need the complete blueprint.

## Workbench Lifecycle Rules

| Artifact | Safe to clean after | Notes |
|---|---|---|
| example-map.yaml | Mister Gherkin completes | Created by Three Amigos |
| events-raw.md | Doctor Context completes | Created by Sticky Storm |
| amigo-notes/*.md | Build completes | Used by Foreman synthesis + Crew |
| estimation-report.md | NEVER auto-clean | Move to plans/ -- it's a stakeholder artifact |
