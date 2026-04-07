---
name: mister-gherkin
description: Use when an example map exists and needs to be formalized into Gherkin .feature files — or when the user asks to write scenarios, define acceptance criteria, turn requirements into Gherkin, or produce Given/When/Then specs for a feature.
---

# Mister Gherkin

**Pipeline:** Foreman → Scout → Three Amigos → **Mister Gherkin** → [Sticky Storm + Doctor Context] → The Onion → Foreman

## Hard Rules
- NEVER explore codebase. `storyline summary` + example map = your input.
- ALWAYS TodoWrite upfront (prefix: "Mister Gherkin:").
- ALWAYS AskUserQuestion (MCQ) for vague rules. Never plain text.
- No implementation details in step text. Only in traceability tags.
- Vague rules are a GATE — resolve before writing any scenario.
- Skip any read/fetch whose output is already in this session's context.

## Inputs
```bash
storyline summary
cat .storyline/workbench/example-map.yaml
grep -r "@mister-gherkin" .storyline/workbench/amigo-notes/
```
No example map → AskUserQuestion to explore the feature first.

## Example Map → Gherkin
| Map | Gherkin |
|---|---|
| Rules | `Rule:` blocks |
| Examples | `Scenario:` (context→Given, action→When, outcome→Then) |
| MoSCoW | `@must-have` `@should-have` `@could-have` `@wont-have` |
| Questions | Comments or blockers |

## Tagging
Feature-level: `@aggregate:X @context:X`
Scenario-level: `@command:X`, `@sad-path`, `@edge-case`

## Quality Gate (mandatory before handoff)
Fix directly: imperative steps, multiple When-steps, >7 steps, implementation leakage, rules missing sad-path coverage. Report what was corrected.

## Blueprint Update
```bash
# Link feature files to commands
storyline add-command --context <Ctx> --aggregate <Agg> --name <Cmd> --feature-files "<file.feature>"

# Merge confirmed glossary terms
storyline add-glossary --term "<Term>" --context "<Ctx>" --meaning "<def>"

# Always before commit
storyline validate
storyline stamp
```

## Commit & Handoff
```bash
git add .storyline/features/ blueprint.yaml
git commit -m "specify: gherkin scenarios for [feature name]"
```
Dispatch `Skill: storyline:the-foreman`.