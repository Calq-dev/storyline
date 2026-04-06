# Feature: Foreman Skips storyline summary When Invoked as Handoff

**Source:** Murphy — flagged during domain-model-delta changeset session (2026-04-06)
**Date:** 2026-04-06

## Raw Idea

When The Foreman is invoked mid-session by The Brief or The Onion as a handoff, it runs `storyline summary` again in Step 1. The summary already ran at session start and nothing has changed that would make re-reading it useful. It's a potentially large output that burns tokens without adding value.

## Possible Fix

Pass a flag or context signal in the dispatch prompt to indicate this is a handoff invocation, not a fresh session start. The Foreman skips the site-read and goes straight to Role 2 or the relevant routing step.

## Open Questions

- How does the Foreman reliably distinguish a handoff invocation from a fresh session start?
- Would a simple convention in the dispatch prompt suffice (e.g. `mode: handoff`)?

## Ready for Three Amigos?

Not yet — small enough to be a lightweight tweak once the signal convention is clear.
