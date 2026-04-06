# Framework: Bottom-Up WBS (Work Breakdown Structure) Estimation

## Process

1. Identify all deliverables including non-obvious ones (testing, deployment, docs, data migration).
2. Decompose each into work packages (8–80 hours each). Per package: description of done, effort, role, dependencies, risks.
3. Apply WBS numbering: `1.0`, `1.1`, `1.1.1`.
4. Add overhead categories: project management, technical overhead, risk buffer (10–25%), ramp-up.
5. Roll up numbers. Identify critical path (longest chain of dependencies).
6. Map resources: role per package, parallelism possibilities.

## Output Schema

```json
{
  "framework": "wbs",
  "unit": "person-days | hours | story-points",
  "wbs": [
    {
      "id": "1.0",
      "name": "Phase name",
      "type": "phase",
      "children": [
        {
          "id": "1.1",
          "name": "Feature or component",
          "type": "feature",
          "children": [
            {
              "id": "1.1.1",
              "name": "Work package",
              "type": "work_package",
              "effort": 5,
              "role": "Backend Developer",
              "dependencies": ["1.2.1"],
              "definition_of_done": "Clear description of completion criteria",
              "risks": [],
              "children": []
            }
          ]
        }
      ]
    }
  ],
  "overhead": {
    "project_management": { "effort": 15, "percentage": "10%" },
    "technical_overhead": { "effort": 12, "percentage": "8%" },
    "risk_buffer": { "effort": 20, "percentage": "15%" },
    "ramp_up": { "effort": 5, "note": "One new team member onboarding" }
  },
  "totals": {
    "raw_effort": 130,
    "with_overhead": 182,
    "by_role": { "Backend Developer": 60 },
    "by_phase": { "1.0 Discovery": 15 }
  },
  "critical_path": {
    "items": ["1.1.1", "2.1.1"],
    "calendar_duration": "8 weeks",
    "notes": ""
  },
  "assumptions": [],
  "scope_exclusions": []
}
```
