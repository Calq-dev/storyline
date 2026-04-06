@must-have @context:Orchestration @context:Discovery
Feature: Technical task entry point
  As a plugin contributor
  I want a technical task entry point in the pipeline
  So that I can start a structured implementation without forcing my change into a user story format

  As described in Three Amigos session (2026-04-06)

  Background:
    Given a project with an initialized blueprint

  Rule: The Foreman routes technical tasks and user-facing features to different pipeline paths

    @command:StartTechnicalTask
    Scenario: Contributor signals a technical task at intake
      Given a plugin contributor with a technical change to make
      When they declare it is a technical or internal change
      Then the Foreman opens The Brief
      And the Three Amigos session is not started

    Scenario: Contributor signals a user-facing feature at intake
      Given a plugin contributor with a user-facing feature to add
      When they declare it is a user-facing feature
      Then the Foreman opens Three Amigos

    @sad-path
    Scenario: Ambiguous input defaults to Three Amigos
      Given a plugin contributor with an ambiguous change description
      When they do not declare a task type
      Then the Foreman routes to Three Amigos
      And the contributor can re-route to The Brief after confirming their intent

  Rule: The Brief runs a structured intake session and detects the task subtype without asking the contributor to label it

    @command:RunTechnicalBrief
    Scenario: Scoped technical task is detected from intake answers
      Given a plugin contributor in a Brief session
      When their answers indicate the change has observable or interface-affecting behavior
      Then The Brief includes NFR probing and MoSCoW prioritization
      And a validated specification artifact is produced with structured acceptance criteria

    @command:RunTechnicalBrief
    Scenario: Pure internal change is detected from intake answers
      Given a plugin contributor in a Brief session
      When their answers indicate the change has no observable behavior and no public interface impact
      Then The Brief uses a lightweight intake covering what changes, why, risks, and done criteria
      And a validated specification artifact is produced

    @sad-path
    Scenario: Brief blocks when acceptance criteria are absent
      Given a plugin contributor completing a Brief session
      When they provide a task description but no acceptance criteria
      Then The Brief does not proceed to implementation planning
      And the contributor is informed that acceptance criteria are required before continuing

  Rule: The Brief produces a schema-validated specification artifact that is linked to the blueprint

    @command:RunTechnicalBrief
    Scenario: Technical task with a new pipeline command is linked to its specification artifact
      Given a completed Brief for a task that introduces a new pipeline command
      When the specification artifact is saved and the blueprint is updated
      Then the new command references the brief as its specification
      And blueprint validation passes

    @sad-path
    Scenario: Brief with missing required fields fails blueprint validation
      Given a specification artifact that is missing acceptance criteria
      When blueprint validation runs
      Then validation reports the artifact is incomplete
      And the pipeline does not proceed to implementation planning

    @edge-case
    Scenario: Pure internal task does not add new commands to the blueprint
      Given a completed Brief for a pure internal change
      When the specification artifact is saved
      Then the blueprint is unchanged
      And blueprint validation passes

  Rule: Technical Brief is a recognized phase in the pipeline phase sequence

    Scenario: Pipeline tracks Technical Brief as the active phase
      Given a technical task in progress
      When the pipeline records the current phase as "Technical Brief"
      Then the phase is accepted as valid
      And exactly one phase is active at a time

    @sad-path
    Scenario: Unrecognized phase names are rejected by the pipeline
      Given a pipeline session in progress
      When an agent reports a phase name that is not in the recognized list
      Then the pipeline rejects the phase update
      And the active phase remains unchanged

  Rule: Blueprint commands declare whether their specification is a Gherkin feature file or a brief artifact

    Scenario: Command with brief specification type accepts a brief artifact reference
      Given a blueprint command whose specification type is set to "brief"
      When blueprint validation runs
      Then the brief artifact reference is accepted as a valid specification

    @sad-path
    Scenario: Command with Gherkin specification type rejects a brief artifact reference
      Given a blueprint command whose specification type is set to "gherkin"
      When it references a brief artifact instead of a feature file
      Then blueprint validation reports a specification type mismatch
