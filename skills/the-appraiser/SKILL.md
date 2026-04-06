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


## Pipeline Context

When invoked by The Foreman after an implementation plan is written, the estimation has rich context:
- The implementation plan passed via `$ARGUMENTS` (e.g. `2026-04-04-shopping-cart`) or the most recently modified file in `.storyline/plans/`
- The blueprint at `.storyline/blueprint.yaml`
- The feature files at `.storyline/features/`
- Amigo discovery notes at `.storyline/workbench/amigo-notes/`

**Resolving the plan file:** If `$ARGUMENTS` is provided, glob `.storyline/plans/*$ARGUMENTS*.md` to find the plan. If not provided, glob `.storyline/plans/*.md` and use the most recently modified file.

Use ALL of this as input — the more context, the better the estimate.

## TodoWrite: Track Progress

When this skill starts, add your steps to the todo list. Preserve completed items from previous skills. Prefix with "Appraiser:" and write in character — you're the seasoned construction estimator sizing up the job before anyone picks up a hammer.

Example (adapt to the feature being estimated):
```
TodoWrite([
  ...keep existing completed items...
  { content: "Appraiser: sizing up the job",                       status: "in_progress", activeForm: "The Appraiser is sizing up the job" },
  { content: "Appraiser: sending out the three estimators",        status: "pending",     activeForm: "The Appraiser is dispatching estimators" },
  { content: "Appraiser: comparing the numbers",                   status: "pending",     activeForm: "The Appraiser is consolidating estimates" },
  { content: "Appraiser: writing the final appraisal",             status: "pending",     activeForm: "The Appraiser is writing the report" }
])
```

### Mid-Phase Todo Updates

Update todos at each phase transition. During the parallel wait, report progress as agents return. Reflect alignment or divergence in tone — if estimates agree, signal confidence; if they diverge, signal uncertainty before the report arrives.

## Step 0: Gather Preferences

Ask the user via a single `AskUserQuestion` that combines the key choices. Don't ask 4 separate questions — that feels like a form, not a conversation. Bundle the most important decisions into one MCQ and infer the rest.

```
AskUserQuestion:
  question: "Who is this estimate for and how detailed should it be?"
  options:
    - "[recommended ✓] Standard for the team — 3-5 pages, all three frameworks, person-days"
    - "Quick for me — 1 page, T-shirt sizes with PERT range"
    - "Comprehensive for stakeholders — full WBS, risk analysis, Gantt chart"
    - "Executive summary — high-level, visual, minimal jargon"
```

From the user's choice, infer the full preference set:

| Choice | Audience | Detail | Units | Language |
|---|---|---|---|---|
| Standard for the team | `technical` | `standard` | `person-days` | conversation language |
| Quick for me | `technical` | `quick` | `person-days` | conversation language |
| Comprehensive for stakeholders | `hybrid` | `comprehensive` | `person-days` | conversation language |
| Executive summary | `executive` | `standard` | `calendar weeks` | conversation language |

If the user needs a different unit (story points, person-hours, cost), they'll say so — don't front-load that question. Default to person-days and adjust if asked.

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
