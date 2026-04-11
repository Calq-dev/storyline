# CLAUDE.md

Instructions for Claude Code when contributing to the Storyline plugin codebase.
This is NOT user-facing documentation — that belongs in the skills and agents themselves.

---


## Agent Workflow

After editing the blueprint:
```
Edit blueprint (Edit tool for scalar updates, CLI helpers for list insertions)
  -> storyline validate
  -> fix errors if any, re-validate
  -> storyline stamp
  -> git commit
```

## Important Rule For Writing or Editing Skill & Agent Instructions
When writing or editing skills, agents, or any agent-facing instructions: only include what the LLM cannot know from training. Delete explanations of well-known concepts, patterns, syntax, or best practices. Keep only project-specific conventions, CLI commands, file paths, routing logic, gates, and deviations from default LLM behavior.

## Blueprint Read Convention

1. `storyline summary` for orientation
2. `storyline view --context X` for targeted work
3. Full blueprint read only for cross-context agents (Sticky Storm, Doctor Context)

## Build Brief Convention

Each dispatched subagent is a cold start — no memory between dispatches. To minimize context rebuild, Phase 0 of the build (Testing Amigo) writes two artifacts:

1. The failing test suite (`tests/acceptance/`, `tests/integration/`).
2. One `.storyline/workbench/build-briefs/<task-id>.yaml` per changeset task.

**Downstream dispatched agents (GREEN, VERIFY, parallel dev) read ONLY their brief + the test files the brief names.** They do NOT re-read the changeset, feature files, `storyline summary`, `storyline view`, amigo-notes, or tech-choices.md. If a skill prompt tells a downstream agent to read any of those, that's a regression — the missing info belongs in the brief instead.

Brief schema lives in `skills/the-foreman/crew-build-loop.md` Phase 0. Any skill or agent edit that adds a read to a downstream dispatch prompt should either (a) add the missing field to the brief schema, or (b) be rejected.

**VERIFY conditionality:** if a brief's `deferred_edge_cases` is empty (or every item has a reason prefixed with "not for VERIFY"), the VERIFY dispatch is skipped entirely. Code review catches gaps.

**Small-changeset fast path:** crew-build-loop.md allows the Foreman main agent to write Phase 0 inline for ≤3 tasks, avoiding the heaviest cold start. Keep this threshold in one place (crew-build-loop.md) — don't duplicate.

## Plugin Versioning

Bump `.claude-plugin/plugin.json` version with every feature commit. Users won't get updates via `/plugin upgrade` until the version changes. Use semver: `MAJOR.MINOR.PATCH`.

## Git Commits

- Do NOT add `Co-Authored-By` lines
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`
