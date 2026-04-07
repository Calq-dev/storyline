# Mister Gherkin needs implementation constraints before writing scenarios

**Source:** Build retrospective (2026-04-07)

## Observation

Testing Amigo pre-scan in The Onion flagged `tokens_used vs cost_usd` mismatch after Mister Gherkin had already written scenarios — requiring edits. Implementation constraints (e.g. "orchestrator tracks USD, not tokens") were in `codebase_state` but Mister Gherkin had no access to them.

## Proposed fix

Give Mister Gherkin explicit access to `codebase_state` section of the changeset (or technical brief) before writing scenarios. Implementation constraints baked in from the start, not caught in QA.
