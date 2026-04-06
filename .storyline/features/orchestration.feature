@surveyed
Feature: Pipeline Orchestration
  The Foreman is the entry point and build director for the BDD pipeline.
  It detects project state, dispatches the right phase, and coordinates builds.

  @command:StartPipeline @command:DetectProjectState
  Rule: The Foreman auto-detects project state on entry

    Scenario: Empty project with no blueprint and no source code
      Given a project with no .storyline/blueprint.yaml
      And no source code files exist
      When The Foreman is invoked
      Then it asks the user what they want to build
      And initializes a new blueprint after receiving the project name

    Scenario: Existing source code but no blueprint
      Given a project with source code files
      And no .storyline/blueprint.yaml exists
      When The Foreman is invoked
      Then it dispatches the Surveyor subagent in full survey mode
      And waits for the survey to complete before proceeding

    Scenario: Blueprint exists and is current
      Given a valid .storyline/blueprint.yaml exists
      And no commits have been made since meta.updated_at
      When The Foreman is invoked
      Then it reads the blueprint for gaps and open questions
      And asks what feature the user wants to add

    Scenario: Blueprint exists but is stale
      Given a valid .storyline/blueprint.yaml exists
      And commits have been made to src/ since meta.updated_at
      When The Foreman is invoked
      Then it reports the staleness with date and changed module count
      And asks whether to refresh the survey before continuing

  @command:PresentBuildChoice
  Rule: The Foreman presents build choices after The Onion writes a plan

    Scenario: Small plan after quick scan mode
      Given an implementation plan exists with fewer than 5 tasks
      And Three Amigos ran in quick scan mode
      When The Foreman presents the build choice
      Then it recommends "Continue here"
      And offers "Continue here" and "New session" as options

    Scenario: Large plan after full session mode
      Given an implementation plan exists with 5 or more tasks
      And Three Amigos ran in full session mode with persona agents
      When The Foreman presents the build choice
      Then it recommends "The Crew" or "Parallel build"
      And offers "Continue here", "New session", "The Crew", and "Parallel build" as options

    Scenario: Large plan with independent tasks
      Given an implementation plan exists with 5 or more tasks
      And most tasks have independent file scopes
      When The Foreman presents the build choice
      Then it recommends "Parallel build"

  @command:ReportStatus
  Rule: The Foreman can report pipeline status at any time

    Scenario: Status report shows phase progress
      Given a blueprint with bounded contexts and some feature files
      When the user asks for pipeline status
      Then The Foreman shows each phase with its completion state
      And highlights any gaps or open questions

  @command:DispatchSurveyor
  Rule: The Surveyor maps the codebase into the blueprint

    Scenario: Full survey on an existing codebase
      Given source code exists but no blueprint
      When the Surveyor runs a full survey
      Then it populates tech_stack in the blueprint
      And adds bounded contexts, aggregates, events, and commands
      And writes @surveyed feature files to .storyline/features/
      And validates and stamps the blueprint

    Scenario: Incremental survey after code changes
      Given a blueprint exists with bounded_contexts
      And code has changed since meta.updated_at
      When the Surveyor runs an incremental survey
      Then it only re-scans the affected modules
      And merges new findings into the existing blueprint

    Scenario: As-built survey after implementation
      Given implementation is complete and tests are green
      When the Surveyor runs an as-built survey
      Then it compares the plan with what was actually built
      And updates the blueprint to match reality
      And records gaps for any planned items not implemented

  @command:DispatchAppraiser @as-built
  Rule: The Appraiser produces triangulated estimates after a plan is written

    Scenario: Estimation with three frameworks
      Given an implementation plan exists in .storyline/plans/
      When The Foreman dispatches The Appraiser
      Then three sub-agents run in parallel (PERT, WBS, T-Shirt Sizing)
      And a consolidated estimation report is written to .storyline/workbench/estimation-report.md

  @command:RunCodeReview @as-built
  Rule: Code review runs after build completes

    Scenario: Post-build code review by a fresh agent
      Given all implementation tasks are complete and tests are green
      When The Foreman dispatches a code review agent with changeset, diff, features, and blueprint context
      Then the review covers correctness, invariants, cross-file impact, security, test completeness, and glossary
      And blocking findings are fixed before proceeding
      And the security pass is mandatory when the feature touches auth, user input, sensitive data, or external APIs

  @command:RunAsBuiltUpdate @as-built
  Rule: Blueprint is updated to match what was actually built

    Scenario: As-built blueprint reconciliation
      Given the code review is complete
      When The Foreman compares the changeset plan with the actual diff
      Then blueprint.yaml is updated to match reality
      And planned-but-not-built items become gaps
      And drifted scenarios are updated by Mister Gherkin
