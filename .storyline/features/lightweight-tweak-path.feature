@must-have @aggregate:PipelineSession @context:Orchestration
Feature: Lightweight tweak path
  As a plugin user
  When I describe a minor adjustment to an existing feature
  I want The Foreman to recognize it as a small tweak and offer a lighter path
  So that I skip the full discovery pipeline for trivial changes
  But still see any implications for existing scenarios and the blueprint before proceeding

  Rule: Foreman classifies a request as a minor tweak from observable signals

    @command:IdentifyMinorTweak
    Scenario: Scoped change is recognized as a minor tweak
      Given a project with an existing feature in the blueprint
      When the user describes a bounded change to that feature using scoping language
      Then the Foreman presents a minor tweak classification with its rationale
      And offers the user a choice to proceed with the lightweight path or run the full pipeline

    @sad-path
    Scenario: Broad change routes to full pipeline
      Given a project with existing bounded contexts
      When the user describes a change that introduces new behavior or actors
      Then the Foreman routes to the full discovery pipeline

    @edge-case
    Scenario: Ambiguous description triggers clarification
      Given a project with existing features
      When the user describes a change without enough scope detail to classify
      Then the Foreman presents a clarification question before classifying

  Rule: User must confirm before the pipeline is bypassed

    @command:IdentifyMinorTweak
    Scenario: User confirms the lightweight path
      Given the Foreman has classified a change as a minor tweak and shown the rationale
      When the user confirms the lightweight path
      Then the implication scan is initiated

    @sad-path
    Scenario: User overrides the classification and runs the full pipeline
      Given the Foreman has classified a change as a minor tweak
      When the user selects the full pipeline option
      Then the Foreman routes to the Three Amigos discovery session

  Rule: Implication scan runs before the bypass is finalized

    @command:ScanTweakImplications
    Scenario: Scan finds no affected scenarios or blueprint structures
      Given the user has confirmed the lightweight path
      And no existing scenarios reference the area being changed
      When the implication scan runs
      Then the Foreman reports no implications found and offers to proceed

    @command:ScanTweakImplications
    Scenario: Scan surfaces affected scenarios
      Given the user has confirmed the lightweight path
      And existing scenarios reference the rule being changed
      When the implication scan runs
      Then the Foreman lists the affected feature files and scenario names

  Rule: Cross-context implication blocks the lightweight path

    @command:ScanTweakImplications
    Scenario: Single-context implications allow lightweight path with update option
      Given the implication scan found affected scenarios within one bounded context
      When the user reviews the implications
      Then the Foreman offers to proceed lightly with scenario updates, or run the full pipeline

    @sad-path
    Scenario: Cross-context implications block the lightweight path
      Given the implication scan found implications spanning multiple bounded contexts
      When the scan completes
      Then the Foreman blocks the lightweight path and recommends the full pipeline

  Rule: Lightweight execution delegates and reconciles artifacts post-commit

    @command:ExecuteTweakPath
    Scenario: Developer Amigo executes the tweak and updates artifacts
      Given the implication scan passed within a single context
      And the user confirmed the lightweight path
      When the Foreman initiates lightweight execution
      Then the Developer Amigo receives the tweak details and implication scan results
      And after the change is committed the affected feature files and blueprint are updated

    @command:ExecuteTweakPath
    Scenario: Inline execution when the session already has context
      Given the implication scan passed
      And the current session has already explored the affected area
      When the Foreman determines inline execution is appropriate
      Then the change is made and committed directly
      And the affected feature files and blueprint are updated
