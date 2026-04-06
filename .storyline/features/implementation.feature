@surveyed
Feature: Outside-in TDD Implementation
  The Onion plans and executes implementation from acceptance tests
  inward through the domain model. Scaffold.py generates code skeletons.

  @command:CreateImplementationPlan
  Rule: The Onion creates a persistent dated implementation plan

    Scenario: Creating an implementation plan from the blueprint
      Given bounded contexts have aggregates with commands and events
      And feature files are linked to commands
      When The Onion creates the implementation plan
      Then it writes a plan to .storyline/plans/YYYY-MM-DD-feature.md
      And lists tasks with files to create or modify
      And hands off to The Foreman for build choice

    @as-built
    Scenario: Multiple plans can coexist for different features
      Given a plan already exists for "shopping-cart"
      When The Onion creates a plan for "payment-refunds"
      Then both plans exist in .storyline/plans/ as separate dated files
      And The Foreman can list and select between them

  @command:ExecuteTask
  Rule: Implementation follows the outside-in double loop

    Scenario: Executing a task with outside-in TDD
      Given an implementation plan task exists
      When the task is executed
      Then a failing acceptance test is written first from the Gherkin scenario
      And inner loop cycles of unit test, implement, refactor drive the design
      And the acceptance test goes green when the feature works end-to-end
      And the task is committed

    Scenario: The Crew builds task by task
      Given The Foreman selected Crew mode
      And persona agents exist from the discovery session
      When a task is assigned
      Then Developer Amigo builds using outside-in TDD
      And Testing Amigo reviews the tests for edge case coverage
      And Product Amigo validates behavior matches intent

    Scenario: Parallel build dispatches independent tasks simultaneously
      Given The Foreman selected Parallel build mode
      And the changeset has tasks with independent file scopes
      When The Foreman groups tasks into parallel batches
      Then the walking skeleton task runs first as a sequential batch
      And independent tasks are dispatched to separate agents in parallel
      And each agent receives blueprint context, changeset, and their specific task scope
      And sequential tasks run after their dependencies complete
      And an integration check runs the full test suite after all batches

  @command:ScaffoldFromBlueprint
  Rule: Scaffold generates code skeletons from the blueprint

    Scenario: Generating TypeScript scaffold
      Given a blueprint with bounded contexts and aggregates
      When scaffold.ts runs with --lang typescript
      Then it generates domain/, application/, and infrastructure/ directories
      And creates aggregate root classes with invariant comments
      And creates event interfaces with payload fields
      And creates command handler classes with feature file references
      And creates repository interfaces and in-memory implementations

    Scenario: Generating Python scaffold
      Given a blueprint with bounded contexts and aggregates
      When scaffold.ts runs with --lang python
      Then it generates the same layered structure using Python conventions
      And uses dataclasses for aggregates, events, and value objects
      And creates __init__.py files for proper module structure
