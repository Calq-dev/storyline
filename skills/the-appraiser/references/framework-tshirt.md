# Framework: T-Shirt Sizing with Relative Mapping

## Size Scale (calibrate ranges to project scale)

| Size | Typical Range | Complexity | Unknowns |
|------|--------------|------------|----------|
| XS | 1–2 days | Known solution | None |
| S | 3–5 days | Straightforward | Few |
| M | 1–2 weeks | Some complexity | Some |
| L | 2–4 weeks | Significant | Several |
| XL | 1–2 months | High complexity | Many |
| XXL | 2+ months | Should be decomposed | Too many |

Size = maximum of effort, complexity, and uncertainty dimensions.

## Process

1. Identify 8–20 major work items.
2. Establish 2–3 reference anchors (one clearly S, one M, one L).
3. Size each item relative to anchors. Document reasoning.
4. Map sizes to effort ranges appropriate for this project.
5. Any XXL → recommend decomposition.
6. Calculate totals: optimistic (low end), midpoint, conservative (high end).

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
    { "name": "Reference item", "size": "M", "rationale": "Why this is the M anchor" }
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
      "decomposition_needed": false
    }
  ],
  "size_distribution": { "XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0, "XXL": 0 },
  "totals": {
    "optimistic": 85,
    "midpoint": 130,
    "conservative": 195,
    "item_count": 15
  },
  "items_needing_decomposition": [],
  "observations": []
}
```
