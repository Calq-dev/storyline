@surveyed
Feature: Domain Modeling
  Sticky Storm discovers events from scenarios.
  Doctor Context refines bounded context boundaries and relationships.

  @command:DiscoverEventsFromScenarios
  Rule: Sticky Storm discovers domain events from Gherkin scenarios

    Scenario: Discovering events from new feature scenarios
      Given new .feature files have been written by Mister Gherkin
      And the blueprint contains bounded contexts
      When Sticky Storm processes the scenarios
      Then domain events are added to the blueprint via add-event
      And commands are added via add-command
      And raw session notes are written to .storyline/workbench/events-raw.md

    Scenario: Events are discovered from behavior, not from code
      Given scenarios describe business behavior
      When Sticky Storm reads them
      Then events are derived from the Then-steps (outcomes)
      And commands are derived from the When-steps (actions)

  @command:RefineContextBoundaries
  Rule: Doctor Context refines bounded context structure

    Scenario: Refining context boundaries
      Given bounded contexts exist with events and commands
      When Doctor Context analyzes the blueprint
      Then it identifies where contexts should be split or merged
      And updates relationships between contexts using DDD patterns
      And references ddd-patterns.md for strategic pattern selection

  @command:AddInvariantsAndRelationships
  Rule: Doctor Context adds invariants and relationships

    Scenario: Adding invariants to aggregates
      Given aggregates exist in the blueprint
      When Doctor Context identifies business rules
      Then invariants are added to the relevant aggregates
      And relationship types are set from the allowed set

  @command:BuildGlossary
  Rule: Doctor Context builds the ubiquitous language glossary

    Scenario: Adding glossary terms from domain analysis
      Given domain terms are used across bounded contexts
      When Doctor Context builds the glossary
      Then each term gets a definition scoped to its context
      And terms that mean different things in different contexts get multiple definitions
