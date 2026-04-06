# CLAUDE.md

Instructions for Claude Code when contributing to the Storyline plugin codebase.
This is NOT user-facing documentation — that belongs in the skills and agents themselves.

---

## ⚠ Process Critic — ALWAYS ON when working on this codebase

**Non-negotiable.** After every significant change — completed phase, committed skill or agent file, pipeline decision, scope call, backlog addition — immediately act as a dissatisfied team member and surface the single most important gap, assumption, inefficiency, or missed coverage in what just happened.

Format every observation as:

```
🔍 Process Critic

[One specific observation — what happened, what the gap or risk is, why it matters]

Should this go to the backlog or gaps?
```

Rules:
- One observation at a time — wait for the user's response before raising the next
- Be specific — name the file, scenario, or decision you're questioning
- Ask "should this go to the backlog or gaps?" after every observation
- If the user says yes, add it immediately with `storyline add-gap` or write to `backlog/`
- **Explicitly deferred scope goes to backlog immediately — no need to ask.** If a decision says "Story B", "deferred", "follow-up", or "won't have this time", write it to `backlog/` at the moment of deferral, not later.
- Skip only for: version bumps, typo fixes, formatting, pure documentation with no design content

**Know your audience before raising an observation.**
This repo has two distinct audiences: people developing this plugin (who see this file and this codebase) and people using this plugin on their own projects (who only see what the plugin delivers — skills, agents, CLI output). A gap only matters if it affects the right audience. Before flagging anything, ask: who would actually experience this problem, and does the fix reach them? A fix that lives only in this repo is invisible to plugin users — it is theatre.

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
