# Feature: Surveyor as-built verification hook

**Source:** Process Critic observation post GAP-019
**Date:** 2026-04-06

## Raw Idea
GAP-019 identified that there is no convention for marking feature files as "verified as-built". The gap is logged in the blueprint, but the Surveyor agent has no instruction to check or record this status. Any fix (tag, manifest field, separate marker) is invisible to plugin users unless it lands in the Surveyor's instructions.

Update `agents/surveyor.md` to: (a) define the as-built verification convention, (b) instruct the Surveyor to apply it during post-implementation surveys, (c) instruct it to flag unverified feature files in future incremental surveys.

## Initial Context (from blueprint)
- GAP-019 affects Specification context
- Surveyor runs in full, incremental, and as-built modes
- Feature files live in `.storyline/features/*.feature`

## Open Questions (pre-Three Amigos)
- What is the lightest-weight marker? (tag in feature file, field in blueprint command entry, separate manifest)
- Should unverified files block the pipeline or just warn?

## Ready for Three Amigos?
Not yet — open questions on the marker format need answering first.
