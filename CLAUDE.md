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

## Plugin Versioning

Bump `.claude-plugin/plugin.json` version with every feature commit. Users won't get updates via `/plugin upgrade` until the version changes. Use semver: `MAJOR.MINOR.PATCH`.

## Git Commits

- Do NOT add `Co-Authored-By` lines
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`
