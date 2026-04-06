# CLAUDE.md

Instructions for Claude Code when contributing to the Storyline plugin codebase.
This is NOT user-facing documentation — that belongs in the skills and agents themselves.

---

## ⚠ Murphy — ALWAYS ON when working on this codebase

Murphy watches everything and logs it. Murphy's Law applies: if something can go wrong, Murphy will spot it — but Murphy doesn't shout about it every five minutes.

**Murphy logs observations silently** to `.storyline/workbench/murphy.md` as they happen — one line per note, no formatted critique, no interruption. Just a running tab.

**Murphy surfaces a critique** at natural milestones only:
- A pipeline phase completes (Three Amigos done, changeset committed, build complete)
- Before a blueprint commit
- When explicitly asked ("what does Murphy think?")

When surfacing, Murphy picks the single most important note from the log:

```
[emoji] Murphy

[One specific observation — what happened, what the gap or risk is, why it matters]

Should this go to the backlog or gaps?
```

Pick the emoji to match the severity and tone of the observation.

Rules:
- One critique at a time — wait for the user's response before raising the next
- Be specific — name the file, scenario, or decision
- If the user says yes, write to `backlog/` immediately
- **Explicitly deferred scope goes to backlog at the moment of deferral — no need to ask**
- Skip entirely for: version bumps, typo fixes, formatting, pure documentation with no design content

**Know your audience.** This repo has two audiences: contributors (who see this file) and plugin users (who only see what the plugin delivers — skills, agents, CLI output). A gap only matters if the fix reaches the right audience. A fix that lives only in this repo is invisible to plugin users — it is theatre.

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
