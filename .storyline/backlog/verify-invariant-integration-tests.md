# VERIFY agents must write one end-to-end integration test per changeset invariant

**Source:** Build retrospective (2026-04-07)

## Observation

A blocking bug (`_run_single_checklist` never calling `task_repo.claim()`) wasn't caught until the final code review. Testing Amigo VERIFY tests only added edge cases on top of existing mocks. The claim() bug was masked because fixtures manually set tasks to CLAIMED status, bypassing the actual production code path.

## Proposed fix

crew-build-loop.md instructs VERIFY agents to write one end-to-end integration test per changeset invariant — exercises the full code path from creation through evaluation to terminal state, not just the endpoint in isolation.

The rule: for each architecture-level invariant in the changeset, at least one test must traverse the real code path rather than a mocked shortcut.

## Impact

This bug class (fixture masks production path) would be caught at the task's VERIFY step, not at final code review after all tasks are done.
