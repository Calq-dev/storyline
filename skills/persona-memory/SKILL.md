---
name: persona-memory
description: |
  Shared conventions for how Three Amigos personas read and write their persistent memory files in .storyline/personas/. Used by product-amigo, developer-amigo, testing-amigo, frontend-amigo, and security-amigo agents. Do not invoke directly — this skill is referenced by persona agents.
user-invocable: false
---

# Persona Memory Conventions

This skill defines how Three Amigos persona agents manage their persistent memory files.

## Memory Location

Each persona has a markdown file at `.storyline/personas/<name>.md`:
- `.storyline/personas/product-amigo.md`
- `.storyline/personas/developer-amigo.md`
- `.storyline/personas/testing-amigo.md`
- `.storyline/personas/frontend-amigo.md`
- `.storyline/personas/security-amigo.md`

## File Structure

Organize by topic, not by date. Use headings for each domain area you've learned about:

```markdown
# Product Amigo — Project Notes

## Users & Stakeholders
- Primary users are warehouse operators, not end consumers
- Product Owner is very focused on mobile-first experience

## Business Rules I've Learned
- Discount codes are single-use per customer (confirmed session 2026-04-01)
- Free shipping threshold is €100 but may change per market

## Scope Patterns
- Payment integration is always treated as a separate feature
- The team prefers to ship auth changes separately from business logic

## Things To Watch Out For
- The legacy billing API is unreliable — always flag integration risk
```

## What To Remember

Save insights that will be valuable in future sessions:
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

When updating your memory file:
1. **Read** the current file first
2. **Merge** new insights into existing sections (don't just append)
3. **Update** facts that have changed (cross out old info, add new)
4. **Prune** anything that's no longer relevant
5. Keep the file under 200 lines — if it grows too large, consolidate

## When Memory Doesn't Exist Yet

If `.storyline/personas/<your-name>.md` doesn't exist or is empty, that's fine — this is your first session on this project. Start fresh and build your notes as you go.
