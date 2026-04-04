# Framework: Bottom-Up WBS (Work Breakdown Structure) Estimation

## Overview

Bottom-Up WBS estimation decomposes the project into its smallest manageable work packages, then
estimates each individually and rolls everything up. It's the most thorough framework — it forces
you to think about every piece of work, which surfaces hidden scope and dependencies. The
trade-off is that it takes longer and requires more detailed understanding of the work.

## How It Works

### The 100% Rule
The WBS must capture 100% of the project scope. Every piece of work belongs somewhere in the
tree. If it's not in the WBS, it's not in the estimate — and it will surprise you later.

### The 8/80 Rule
Work packages (the leaf nodes) should require between 8 and 80 hours of effort. Smaller than 8
hours means you've over-decomposed. Larger than 80 hours means the package is too vague to
estimate reliably.

### Decomposition Levels

```
Level 0: Project
  Level 1: Phase / Major Deliverable
    Level 2: Feature / Component
      Level 3: Work Package (estimable unit)
```

Aim for 3–4 levels of depth. Going deeper adds precision but also time and complexity.

## Process for the Sub-Agent

1. **Identify all deliverables** the project must produce. Think outputs, not activities:
   "User authentication module" not "Write code". Include non-obvious deliverables:
   documentation, testing, deployment, training, data migration, etc.

2. **Decompose each deliverable** into work packages following the 8/80 rule. For each work
   package, capture:
   - A clear description of what "done" means
   - Estimated effort (in the user's preferred unit)
   - Required skills / role (e.g., backend developer, designer, QA)
   - Dependencies on other packages
   - Any known risks or unknowns

3. **Apply a WBS numbering scheme**: `1.0`, `1.1`, `1.1.1`, etc. This makes cross-referencing
   easy.

4. **Add overhead and buffer categories**. Real projects have work that doesn't map to
   deliverables:
   - **Project management**: Meetings, status reporting, stakeholder communication
   - **Technical overhead**: Environment setup, CI/CD, code reviews, documentation
   - **Risk buffer**: Typically 10–25% of total effort depending on uncertainty
   - **Ramp-up**: New team members, learning new tech, onboarding

5. **Roll up the numbers**. Sum work packages into features, features into phases, phases into
   the project total. At each level, sanity-check: does the sum feel right for that
   deliverable?

6. **Identify the critical path** — the longest chain of dependent work packages. This
   determines the minimum calendar duration regardless of team size.

7. **Map resources**. For each work package, note what role is needed and how many people could
   work on it in parallel. This converts effort (person-days) into calendar duration.

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
              "risks": ["Risk or unknown"],
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
    "by_role": {
      "Backend Developer": 60,
      "Frontend Developer": 40,
      "QA Engineer": 20,
      "Designer": 10
    },
    "by_phase": {
      "1.0 Discovery": 15,
      "2.0 Development": 90,
      "3.0 Testing": 20,
      "4.0 Deployment": 5
    }
  },
  "critical_path": {
    "items": ["1.1.1", "2.1.1", "2.1.3", "3.1.1", "4.1.1"],
    "calendar_duration": "8 weeks",
    "notes": "Assumes 2 backend developers working in parallel"
  },
  "assumptions": ["List of assumptions"],
  "scope_exclusions": ["What is explicitly NOT included"]
}
```

## Common Pitfalls to Avoid

- **Forgetting non-functional work**: Testing, deployment, documentation, security reviews,
  performance optimization. These can easily add 30–50% to a naive "just coding" estimate.
- **Ignoring dependencies**: If Task B can't start until Task A finishes, parallel resources
  don't help. Identify the critical path.
- **Underestimating integration**: Individual components may be simple, but making them work
  together is where dragons live. Add explicit integration work packages.
- **No buffer**: Every project has surprises. A 0% buffer is an aggressive fantasy, not a plan.
  Use 10–15% for well-understood work, 20–25% for novel work.
- **Scope exclusions**: Be explicit about what's NOT included. A missing scope exclusion is a
  future scope creep argument.
