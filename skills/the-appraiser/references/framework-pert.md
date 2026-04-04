# Framework: PERT / Three-Point Estimation

## Overview

PERT (Program Evaluation and Review Technique) uses three scenarios per work item to produce a
statistically weighted estimate with built-in uncertainty modeling. It's the most mathematically
rigorous of the three frameworks and produces confidence intervals.

## How It Works

For each identifiable work item or phase, produce three estimates:

- **O** (Optimistic): Best-case duration if everything goes smoothly. No major blockers, team
  is experienced, requirements are crystal clear.
- **M** (Most Likely): The realistic estimate. Some friction, some unknowns, normal pace.
- **P** (Pessimistic): Worst-case duration. Key person gets sick, requirements change, a
  dependency breaks, a technology doesn't work as expected.

### Formulas

**PERT Expected Duration (weighted mean):**
```
E = (O + 4M + P) / 6
```

The "4" weight on M means the most-likely scenario dominates, but the tails still pull the
estimate if there's high uncertainty.

**Standard Deviation (per item):**
```
σ = (P - O) / 6
```

**Variance:**
```
Var = σ²
```

**Project-level aggregation** (for independent items):
```
E_total = Σ E_i
σ_total = √(Σ Var_i)
```

**Confidence intervals:**
- 68% confidence: E_total ± σ_total
- 95% confidence: E_total ± 2σ_total
- 99.7% confidence: E_total ± 3σ_total

## Process for the Sub-Agent

1. **Decompose** the project into 5–15 estimable phases or major work items. Don't go as
   granular as WBS — think phases, epics, or major deliverables.

2. **For each item**, produce O, M, P estimates in the user's preferred unit (person-days,
   hours, etc.). Think carefully:
   - O: "What if we get lucky and everything clicks?"
   - M: "What usually happens on projects like this?"
   - P: "What if we hit every pothole along the way?"

3. **Document assumptions** for each item. Every estimate rests on assumptions — make them
   explicit. Examples: "Assumes API documentation exists", "Assumes team has React experience",
   "Assumes no regulatory approval needed".

4. **Identify risks** that could push items toward their pessimistic bound. For each risk,
   note what would trigger it and how it would affect the estimate.

5. **Calculate** E, σ, and confidence intervals for each item and the total.

6. **Flag high-variance items** — items where (P - O) is large relative to M. These are the
   biggest sources of estimation risk and deserve attention.

## Output Schema

```json
{
  "framework": "pert",
  "unit": "person-days | hours | story-points | weeks",
  "items": [
    {
      "id": "PERT-001",
      "name": "Phase or work item name",
      "description": "What this covers",
      "optimistic": 5,
      "most_likely": 8,
      "pessimistic": 20,
      "expected": 9.17,
      "std_dev": 2.5,
      "variance": 6.25,
      "assumptions": ["Assumption 1", "Assumption 2"],
      "risks": [
        {
          "description": "Risk description",
          "trigger": "What would cause this",
          "impact_days": 5
        }
      ]
    }
  ],
  "totals": {
    "expected": 45.5,
    "std_dev": 5.2,
    "confidence_68": [40.3, 50.7],
    "confidence_95": [35.1, 55.9],
    "optimistic_total": 30,
    "pessimistic_total": 75
  },
  "high_variance_items": ["PERT-003", "PERT-007"],
  "overall_assumptions": ["Global assumptions that apply to all items"],
  "methodology_notes": "Any notes on how estimates were derived"
}
```

## Tips for Good PERT Estimates

- The pessimistic estimate should NOT be the apocalypse scenario. It's the "things go badly but
  the project still finishes" scenario. Don't include "the company shuts down" in your P.
- If O and M are very close but P is 5x larger, that's a sign the item has a hidden risk that
  needs investigation — flag it.
- Items with σ > 0.5 × E are very uncertain. Consider whether they can be decomposed further
  or if a spike/proof-of-concept is needed before estimating.
- PERT works best when items are roughly independent. If items have strong dependencies, note
  this and adjust the confidence interval upward (more uncertainty).
