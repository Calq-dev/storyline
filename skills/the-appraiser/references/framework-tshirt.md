# Framework: T-Shirt Sizing with Relative Mapping

## Overview

T-Shirt sizing is a fast, intuitive estimation technique that uses relative comparisons rather
than absolute numbers. Items are categorized as XS, S, M, L, XL, or XXL based on their
complexity, effort, and uncertainty relative to each other. It originated in Agile/Scrum but
works for any kind of work estimation.

The power of T-shirt sizing is its speed and accessibility. Non-technical stakeholders instantly
understand "this is an XL" in a way they don't understand "this is 89 person-days". It also
sidesteps the false precision trap — nobody argues whether something is 12 or 13 days when the
choices are "M or L".

## How It Works

### The Size Scale

| Size | Relative Effort | Typical Range* | Complexity | Unknowns |
|------|----------------|----------------|------------|----------|
| XS | Trivial | 1–2 days | Known solution, done before | None |
| S | Small | 3–5 days | Straightforward, minor unknowns | Few |
| M | Medium | 1–2 weeks | Some complexity, manageable risk | Some |
| L | Large | 2–4 weeks | Significant complexity, multiple parts | Several |
| XL | Very Large | 1–2 months | High complexity, cross-cutting concerns | Many |
| XXL | Enormous | 2+ months | Should probably be broken down further | Too many |

*These ranges are defaults and should be calibrated to the team/organization. The sub-agent
should propose ranges appropriate to the project's scale.

### Sizing Dimensions

When assigning a size, consider three dimensions:

1. **Effort**: How much raw work is there? Lines of code, pages of documentation, number of
   integrations, etc.
2. **Complexity**: How hard is the problem? Simple CRUD vs. distributed systems vs. novel
   algorithms.
3. **Uncertainty**: How much do we not know? Clear requirements vs. exploratory work vs.
   "we've never done this before".

The size should reflect the **maximum** of these three dimensions. An item that's low-effort
but high-uncertainty is still a Large.

## Process for the Sub-Agent

1. **Identify all major work items** at a natural grouping level — features, epics, phases,
   or workstreams. Aim for 8–20 items. Too few and you lose resolution; too many and you've
   basically done a WBS.

2. **Establish reference points**. Pick 2–3 items that are clearly small, medium, and large to
   anchor the scale. All other items are sized relative to these anchors.

3. **Size each item** by asking for each:
   - "Is this bigger or smaller than our M reference?"
   - "How does it compare to other items of similar size?"
   - Document the reasoning — why is this an L and not an M?

4. **Map sizes to effort ranges**. Based on the project's context, propose a mapping table
   from sizes to approximate effort ranges. These should be ranges, not point estimates.

5. **Identify items that need breaking down**. Any XXL item is a red flag — it's too big to
   estimate meaningfully. Recommend decomposing into smaller items.

6. **Calculate totals** using the midpoint of each size's range, and also provide a
   conservative total (using the high end) and an optimistic total (using the low end).

7. **Produce a relative sizing map** — a visual representation of how items compare. Group
   items by size bucket so the user can quickly see the distribution.

## Output Schema

```json
{
  "framework": "tshirt",
  "size_mapping": {
    "XS": { "min_days": 1, "max_days": 2, "midpoint": 1.5 },
    "S":  { "min_days": 3, "max_days": 5, "midpoint": 4 },
    "M":  { "min_days": 5, "max_days": 10, "midpoint": 7.5 },
    "L":  { "min_days": 10, "max_days": 20, "midpoint": 15 },
    "XL": { "min_days": 20, "max_days": 40, "midpoint": 30 },
    "XXL": { "min_days": 40, "max_days": 80, "midpoint": 60 }
  },
  "reference_items": [
    {
      "name": "Reference item name",
      "size": "M",
      "rationale": "Why this is the M anchor"
    }
  ],
  "items": [
    {
      "id": "TS-001",
      "name": "Work item name",
      "description": "What this covers",
      "size": "L",
      "effort_dimension": "medium",
      "complexity_dimension": "high",
      "uncertainty_dimension": "medium",
      "rationale": "Why this size was chosen",
      "decomposition_needed": false,
      "notes": "Any relevant context"
    }
  ],
  "size_distribution": {
    "XS": 2,
    "S": 4,
    "M": 5,
    "L": 3,
    "XL": 1,
    "XXL": 0
  },
  "totals": {
    "optimistic": 85,
    "midpoint": 130,
    "conservative": 195,
    "item_count": 15
  },
  "items_needing_decomposition": ["TS-012"],
  "observations": [
    "Most items cluster around S–M, suggesting a well-understood project",
    "The single XL item (TS-010: Data Migration) dominates the estimate"
  ]
}
```

## When T-Shirt Sizing Shines

- **Early-stage estimation**: When requirements are still fuzzy and detailed WBS isn't feasible
- **Stakeholder communication**: Business leaders grasp sizes intuitively
- **Comparative prioritization**: "Do we want 3 Mediums or 1 Large this sprint?"
- **Portfolio-level planning**: Sizing dozens of initiatives quickly to build a roadmap
- **Cross-team calibration**: When multiple teams need a shared vocabulary for effort

## When It Struggles

- **Contract negotiations**: Clients want numbers, not T-shirt sizes
- **Detailed resource planning**: You can't staff a project with "3 Larges"
- **Tracking progress**: Hard to say you're "60% through a Large"

That's why we combine it with PERT and WBS — T-shirt sizing provides the intuitive calibration
layer that keeps the numbers honest.
