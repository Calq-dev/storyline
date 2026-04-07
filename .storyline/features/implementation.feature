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

  @command:VerifyInvariantCoverage
  Rule: VERIFY agents write one integration test per in-scope changeset invariant

    @must-have
    Scenario: VERIFY identifies in-scope invariants from changeset touches
      Given a Crew build task has gone GREEN
      And the changeset touches "bounded_contexts[Implementation].aggregates[Changeset]"
      And the Changeset aggregate has 2 invariants defined in the blueprint
      When the VERIFY agent runs
      Then it reads the invariants for the Changeset aggregate via storyline view
      And writes one integration test per invariant to tests/integration/
      And all integration tests pass

    @must-have
    Scenario: Integration tests invoke the real code path without domain mocks
      Given an invariant "delta entries are applied incrementally per scenario as acceptance tests go green"
      When the VERIFY agent writes an integration test for this invariant
      Then the test invokes the real command handler against real files on disk
      And does not mock the aggregate or domain service
      And asserts the invariant holds on the resulting state or emitted events

    @must-have
    Scenario: Integration tests are placed in the designated directory
      Given the VERIFY agent writes a test for the Changeset aggregate in the Implementation context
      When it saves the test file
      Then the file is created at tests/integration/implementation_changeset_invariants_test.<ext>
      And the test is discoverable by the project's test runner as an integration suite

    @must-have
    Scenario: VERIFY reports invariant coverage in the commit message
      Given 3 invariants are in scope
      And 2 are assertable runtime invariants
      And 1 is a process discipline invariant
      When VERIFY commits the integration tests
      Then the commit message notes "2 written, 1 skipped (architectural)"

    @must-have @sad-path
    Scenario: VERIFY skips an invariant already covered by the acceptance test step definitions
      Given an invariant "acceptance test must be written before unit test"
      And the step definition "a failing acceptance test is written first" already asserts this end-to-end
      When the VERIFY agent checks for existing coverage
      Then it marks the invariant as "already covered" and writes no new test
      And reports "already covered by acceptance step definitions"

    @must-have @sad-path
    Scenario: VERIFY skips architectural invariants that are not programmatically assertable
      Given an invariant "outer loop stays red while inner loop cycles"
      When the VERIFY agent classifies it
      Then it identifies the invariant describes a process discipline with no observable state or event
      And skips it with reason "architectural"
      And includes it in the coverage report as skipped

    @must-have @edge-case
    Scenario: VERIFY flags when more than half of in-scope invariants were skipped
      Given 4 invariants are in scope for the touched aggregates
      And 3 are skipped as architectural or already covered
      When VERIFY completes
      Then it adds a note to the commit: "75% of invariants skipped — review invariant quality"

    @must-have @sad-path
    Scenario: Changeset with no touches produces no invariant tests
      Given a changeset with no phases[].touches[] entries
      When the VERIFY agent runs
      Then it reports "no aggregates touched — no invariant integration tests required"
      And writes no test files

    @must-have @sad-path
    Scenario: Touched aggregate has no invariants defined
      Given the changeset touches an aggregate that has no invariants[] in the blueprint
      When the VERIFY agent checks for in-scope invariants
      Then it reports "no invariants defined for <AggregateName>"
      And writes no test file for that aggregate

    @must-have @edge-case
    Scenario: Changeset with multiple phases touching different aggregates
      Given a changeset with two phases
      And phase 1 touches "bounded_contexts[Ordering].aggregates[Order]" with 3 invariants
      And phase 2 touches "bounded_contexts[Payment].aggregates[PaymentRequest]" with 2 invariants
      When the VERIFY agent runs
      Then it iterates all phases and all touched aggregates
      And writes integration tests for all 5 invariants across both contexts
      And produces a combined coverage report

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
