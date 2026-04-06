# Technical task entry point — Story B: safety gates

Source: Three Amigos session (2026-04-06), deferred from Story A scope split.
Depends on: Story A (CS-2026-04-06-technical-task-entry-point.yaml) being complete.

## What Story B adds

Story A gives contributors a structured intake path (The Brief) that produces a
technical-brief.yaml spec artifact. Story B adds the safety gates that Story A
explicitly deferred:

### B1: security_surface required field + Security Amigo dispatch
The Brief must include a required `security_surface` field (none | input-handling |
auth | external-api | data-storage). If anything other than `none`, the pipeline
must dispatch the Security Amigo before The Onion starts. Field must be non-defaultable
— absent field blocks the brief, same as missing acceptance_criteria.

### B2: public_interface_change warning at intake
If the contributor answers Q5 ("observable behavior or interface impact?") with "yes",
The Brief must ask a follow-up: "Does this change affect any externally observable
interface (CLI flags, YAML output format, agent prompts, file paths)?" If yes, surface
a routing warning: "This may have user-visible impact — are you sure the technical
path is right?" Contributor must confirm to continue.

### B3: Optional Gherkin bridge via Mister Gherkin
For scoped_technical tasks with observable behavior, The Brief should offer:
"Are there observable behaviors we can specify as Gherkin scenarios?" If yes,
invoke Mister Gherkin with technical-brief.yaml as input (task_description replaces
story:, acceptance_criteria replaces rules[]). Mister Gherkin must handle this
structural variation without requiring a story: field.

### B4: The Onion guard for no-feature-files
The Onion's Step 0 reads .storyline/features/*.feature. If no feature files exist
but a technical-brief.yaml is present, The Onion must use the brief's
acceptance_criteria[] as its outermost acceptance test inputs instead of Gherkin
scenarios. Add one guard line to The Onion's Step 0.

### B5: technical-brief.yaml schema validation (machine-enforceable)
Currently the brief artifact format is only enforced by skill prose. Story B should
add a JSON/YAML schema or a validate-brief CLI command that checks required fields
(id, title, created_at, subtype, task_description, scope, acceptance_criteria,
risks, security_surface) and blocks the pipeline if validation fails. This closes
the R3-E2 gap from the Testing Amigo's review.

## Open questions carried from Story A
- Brief artifact housekeeping lifecycle: briefs in workbench/ must not be cleaned
  up while blueprint commands reference them. Story B should define the archival
  convention (e.g., brief is archived alongside the changeset via storyline archive).
- R1-E3 re-route: "contributor can re-route to The Brief after confirming intent"
  (ambiguous input scenario) — the re-route confirmation flow was not implemented
  in Story A.
