@surveyed
Feature: Gherkin Scenario Formalization
  Mister Gherkin converts Example Maps from discovery into structured
  .feature files with declarative Given/When/Then scenarios.

  @command:FormalizeScenarios
  Rule: Scenarios are formalized from the Example Map

    Scenario: Converting an Example Map into feature files
      Given a completed Example Map exists at .storyline/workbench/example-map.yaml
      When Mister Gherkin formalizes the scenarios
      Then .feature files are written to .storyline/features/
      And each scenario uses declarative style describing behavior
      And scenarios are grouped under Rule: blocks

    Scenario: Mister Gherkin probes before writing
      Given an Example Map is available
      When Mister Gherkin reads it
      Then it runs a clarification round before writing any Gherkin
      And asks questions about any vague rules

  @command:LinkFeatureToCommand
  Rule: Feature files are linked to commands in the blueprint

    Scenario: Linking a feature file to a blueprint command
      Given a feature file has been written
      And a matching command exists in the blueprint
      When the feature file is linked
      Then the command's feature_files list includes the filename
      And the feature file contains @command:X tags for reverse traceability

  @command:RefineScenarios
  Rule: Scenarios can be refined after implementation

    Scenario: Refining scenarios after as-built survey
      Given implementation is complete
      And the as-built survey revealed behavior changes
      When Mister Gherkin refines the scenarios
      Then scenarios are updated to match actual implementation
      And missing scenarios for emergent behavior are added
