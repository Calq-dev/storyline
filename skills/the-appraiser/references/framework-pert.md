# Framework: PERT / Three-Point Estimation

For each work item, produce three estimates and apply:

```
E = (O + 4M + P) / 6
σ = (P - O) / 6
Var = σ²

E_total = Σ E_i
σ_total = √(Σ Var_i)

68% confidence: E_total ± σ_total
95% confidence: E_total ± 2σ_total
```

## Process

1. Decompose into 5–15 estimable phases or major deliverables.
2. For each item, produce O, M, P in the user's preferred unit. Document assumptions and risks per item.
3. Calculate E, σ, confidence intervals.
4. Flag high-variance items where `(P - O)` is large relative to `M`.

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
      "assumptions": ["Assumption 1"],
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
