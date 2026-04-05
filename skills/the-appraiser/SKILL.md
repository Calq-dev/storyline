---
name: the-appraiser
description: Use when an implementation plan exists and a stakeholder-facing estimation is needed — or when the user asks for a work estimate, sizing, or effort forecast before starting to build.
argument-hint: "[feature or plan description]"
---

# The Appraiser

Produces a **triangulated estimation** by dispatching three sub-agents in parallel, each using a different framework. Their results are consolidated into a single document with confidence ranges and risk analysis.

| Framework | Perspective | Strength |
|-----------|-------------|----------|
| **PERT / Three-Point** | Statistical | Confidence intervals, risk-weighted duration |
| **Bottom-Up WBS** | Analytical | Granular task decomposition, resource mapping |
| **T-Shirt Sizing** | Intuitive/Agile | Fast relative sizing, stakeholder-friendly |

When all three agree, confidence is high. When they diverge, the gaps tell you where risk lives.

## Pipeline Context

When invoked by The Foreman after an implementation plan is written, the estimation has rich context:
- The implementation plan passed via `$ARGUMENTS` (e.g. `2026-04-04-shopping-cart`) or the most recently modified file in `.storyline/plans/`
- The blueprint at `.storyline/blueprint.yaml`
- The feature files at `.storyline/features/`
- Amigo discovery notes at `.storyline/workbench/amigo-notes/`

**Resolving the plan file:** If `$ARGUMENTS` is provided, glob `.storyline/plans/*$ARGUMENTS*.md` to find the plan. If not provided, glob `.storyline/plans/*.md` and use the most recently modified file.

Use ALL of this as input — the more context, the better the estimate.

## Step 0: Gather Preferences

Ask the user via AskUserQuestion (or infer from context):

1. **Audience** — who reads this?
   - `executive` — high-level, visual, minimal jargon
   - `technical` — detailed, task breakdowns, dependencies
   - `hybrid` — executive summary + technical appendix (default)

2. **Detail level**:
   - `quick` — ~1 page, T-shirt sizes with PERT range
   - `standard` — 3-5 pages, all three frameworks (default)
   - `comprehensive` — 8+ pages, full WBS, risk analysis

3. **Units**: story points, person-days, person-hours, calendar weeks, cost

4. **Language**: default to conversation language

## Step 1: Dispatch Three Sub-Agents

Read the relevant reference file before each dispatch:

```
Read: skills/the-appraiser/references/framework-pert.md
Read: skills/the-appraiser/references/framework-wbs.md
Read: skills/the-appraiser/references/framework-tshirt.md
```

Dispatch all three in parallel:

```
Agent (description: "PERT estimation"):
  prompt: |
    You are an estimation specialist using the PERT/Three-Point framework.
    
    Read the framework guide: skills/the-appraiser/references/framework-pert.md
    Read the implementation plan: .storyline/plans/<plan-filename>.md
    Run `storyline summary` for project overview. Use `storyline view --context "<name>"` for relevant contexts.
    
    Apply PERT to estimate this work. Output structured JSON.
    Be honest about uncertainty — flag assumptions explicitly.
    
    Save to: .storyline/workbench/estimates/pert.json

Agent (description: "WBS estimation"):
  prompt: |
    You are an estimation specialist using the Bottom-Up WBS framework.
    
    Read the framework guide: skills/the-appraiser/references/framework-wbs.md
    Read the implementation plan: .storyline/plans/<plan-filename>.md
    Run `storyline summary` for project overview. Use `storyline view --context "<name>"` for relevant contexts.
    
    Apply WBS to estimate this work. Output structured JSON.
    Save to: .storyline/workbench/estimates/wbs.json

Agent (description: "T-Shirt estimation"):
  prompt: |
    You are an estimation specialist using T-Shirt Sizing.
    
    Read the framework guide: skills/the-appraiser/references/framework-tshirt.md
    Read the implementation plan: .storyline/plans/<plan-filename>.md
    Run `storyline summary` for project overview. Use `storyline view --context "<name>"` for relevant contexts.
    
    Apply T-Shirt sizing. Output structured JSON.
    Save to: .storyline/workbench/estimates/tshirt.json
```

## Step 2: Consolidate

Read `skills/the-appraiser/references/consolidation-guide.md` for the full methodology.

Key steps:
1. **Alignment** — all three within 20%? High confidence. One outlier? Investigate. All diverge? High uncertainty.
2. **Consolidate** — PERT as backbone, validate against WBS totals, calibrate with T-shirt intuition
3. **Produce range**: `[conservative, expected, optimistic]` with confidence score (0-100%)
4. **Risk register** — merge risks from all three, deduplicate, rank by probability × impact

## Step 3: Generate Document

Write to `.storyline/workbench/estimation-report.md` (markdown by default).

Include:
- Comparison table (3 frameworks side-by-side) — always
- Confidence gauge — for executive/hybrid
- Risk matrix — for standard+ detail
- Mermaid Gantt — for comprehensive/technical

## Step 4: Present

Highlight:
1. The **recommended range** (the headline)
2. Where frameworks **agreed** and **diverged**
3. Top 3 **risks** that could blow the estimate
4. **Key assumptions** — if wrong, the numbers change

## Reference Files

| File | When to Read |
|------|-------------|
| `references/framework-pert.md` | Before PERT agent |
| `references/framework-wbs.md` | Before WBS agent |
| `references/framework-tshirt.md` | Before T-shirt agent |
| `references/consolidation-guide.md` | Before consolidation |
