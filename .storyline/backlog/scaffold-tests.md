# Feature: Test coverage for scaffold.py

**Source:** Surveyor gap analysis (GAP-001)
**Date:** 2026-04-04
**Priority:** Important

## Description

`skills/the-onion/scripts/scaffold.py` generates code scaffolding from the blueprint
but has zero test coverage. `scripts/blueprint.py` has 18 tests — scaffold.py should
have similar coverage.

## What to Test

- TypeScript scaffold generation from a sample blueprint
- Python scaffold generation from a sample blueprint
- Handling of both YAML (blueprint) and JSON (legacy) input
- Correct extraction of event names and command names from object format
- Directory structure creation
- Edge cases: empty bounded contexts, aggregates with no events, etc.
