# Feature: Tests for Foreman Status Inspector Phase Detection

**Source:** Murphy — flagged during domain-model-delta brief (2026-04-06)
**Date:** 2026-04-06

## Raw Idea

`agents/foreman.md` (the status inspector) has a fixed phase detection table driven entirely by blueprint content. The existing 60 tests in `scripts/test-blueprint.ts` test blueprint structure — none test the inspector's phase detection logic. When the domain-model-delta change removes events/invariants/relationships from the blueprint (pre-build), the inspector's detection rules will need to change. Without tests, this can silently regress.

## Ready for Three Amigos?

Not yet — depends on domain-model-delta-in-changeset.md being implemented first. Address as part of that changeset or as a follow-up.
