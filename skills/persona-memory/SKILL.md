---
name: persona-memory
description: |
  Shared conventions for how Three Amigos personas read and write their persistent memory files in .storyline/personas/. Used by product-amigo, developer-amigo, testing-amigo, frontend-amigo, and security-amigo agents. Do not invoke directly — this skill is referenced by persona agents.
user-invocable: false
---

# Persona Memory Conventions

## Memory Location

Each persona has a markdown file at `.storyline/personas/<name>.md`:
- `.storyline/personas/product-amigo.md`
- `.storyline/personas/developer-amigo.md`
- `.storyline/personas/testing-amigo.md`
- `.storyline/personas/frontend-amigo.md`
- `.storyline/personas/security-amigo.md`

## File Structure

Organize by topic, not by date. Suggested headings: `## Users & Stakeholders`, `## Business Rules I've Learned`, `## Scope Patterns`, `## Things To Watch Out For`.

## What To Remember

Save insights valuable in future sessions:
- **Domain knowledge**: business rules, user types, stakeholder preferences
- **Project patterns**: how the team works, what they care about, recurring themes
- **Lessons learned**: mistakes from previous sessions, assumptions that turned out wrong
- **Relationships**: how bounded contexts connect, which teams own what

## What NOT To Remember

Don't save things that belong elsewhere or go stale quickly:
- Code snippets or file paths (the code changes, the blueprint tracks structure)
- Specific scenario text (that's in the feature files)
- Current sprint status or deadlines (too ephemeral)
- Anything already in blueprint.yaml (don't duplicate)

## How To Update

Read first, merge into existing sections, prune stale entries. Keep under 200 lines.

## When Memory Doesn't Exist Yet

If `.storyline/personas/<your-name>.md` doesn't exist, start fresh.
