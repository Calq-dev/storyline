# Fast-path for pre-implemented scenarios in The Crew

**Source:** Build retrospective (2026-04-07)

## Observation

When RED phase comes back >75% GREEN, The Crew still runs a full GREEN agent just to add xfail markers. No concept of "already done — skip to VERIFY."

## Proposed fix

Threshold rule: if Testing Amigo RED agent finds >75% tests passing, mark task as "already implemented" and go straight to VERIFY. Collapse RED+GREEN into a single pass.

## Impact

Removes a full agent dispatch per pre-implemented task. In the retrospective session, task-1 (13/14 GREEN) and task-5b still went through the full triple loop.
