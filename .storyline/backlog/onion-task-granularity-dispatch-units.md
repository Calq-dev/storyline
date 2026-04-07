# Changeset task structure should reflect dispatch units, not scenario units

**Source:** Build retrospective (2026-04-07)

## Observation

Changeset had 10 tasks but actual implementation required ~5 developer dispatches. test tasks (require dedicated agent) and implementation tasks (group by natural implementation boundary) were mixed — requiring manual collapsing of triple groups after the fact.

## Proposed fix

The Onion distinguishes task types at changeset-write time:
- Test tasks → dedicated agent dispatch
- Implementation tasks → grouped by natural implementation boundary (not by scenario)

Task structure in the changeset reflects what will actually be dispatched, not the scenario count.
