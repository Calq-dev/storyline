@must-have @context:BlueprintManagement @aggregate:Blueprint
Feature: Blueprint CLI — Structural Mutation Commands
  As a pipeline agent or skill author
  I want CLI commands for add-relationship, add-invariant, add-policy, and resolve-question
  So that structured blueprint mutations are safe and consistent without risking YAML corruption from manual edits

  Background:
    Given a valid blueprint with a "Payments" context and an "Invoice" aggregate
    And the "Orchestration" context has a "PipelineStarted" event and a "StartPipeline" command

  Rule: add-relationship appends a relationship entry to a bounded context

    @command:AddRelationship
    Scenario: Adding a relationship between two contexts
      Given the "Payments" context has no relationships
      When a relationship is added with type "customer-supplier", target "Orchestration", via "payment events trigger pipeline transitions"
      Then the "Payments" context has one relationship to "Orchestration" of type "customer-supplier"
      And the blueprint passes validation

    @command:AddRelationship @sad-path
    Scenario: Adding a relationship to a context that does not exist
      When a relationship is added to a context "NonExistent" with target "Orchestration"
      Then the command fails with an error message that names "NonExistent"
      And the blueprint is unchanged

  Rule: add-invariant appends a business rule to an aggregate's invariants list

    @command:AddInvariant
    Scenario: Adding an invariant to an existing aggregate
      Given the "Invoice" aggregate has no invariants
      When an invariant is added to the "Invoice" aggregate in "Payments": "An invoice amount must be greater than zero"
      Then the "Invoice" aggregate has the invariant "An invoice amount must be greater than zero"
      And the blueprint passes validation

    @command:AddInvariant @sad-path
    Scenario: Adding an invariant to an aggregate that does not exist in the context
      When an invariant is added to an aggregate "Order" in context "Payments"
      Then the command fails with an error message that names both "Order" and "Payments"
      And the blueprint is unchanged

  Rule: add-policy appends a policy entry to a bounded context, validating event and command references

    @command:AddPolicy
    Scenario: Adding a policy with a valid event and command
      Given the "Orchestration" context has no policies
      When a policy is added: name "StartOnInit", triggered by "PipelineStarted", issues command "StartPipeline", in context "Orchestration"
      Then the "Orchestration" context has a policy "StartOnInit"
      And the blueprint passes validation

    @command:AddPolicy @sad-path
    Scenario: Adding a policy with a triggered-by event that does not exist in the context
      When a policy is added triggered by "OrderPlaced" in context "Orchestration"
      Then the command fails with an error message that names "OrderPlaced"
      And the blueprint is unchanged

    @command:AddPolicy @sad-path
    Scenario: Adding a policy with an issues-command that does not exist in any context
      When a policy is added that issues command "SendEmail" in context "Orchestration"
      Then the command fails with an error message that names "SendEmail"
      And the blueprint is unchanged

  Rule: resolve-question sets a question's status to resolved and records the answer

    @command:ResolveQuestion
    Scenario: Resolving an open question with an answer
      Given the blueprint has an open question "Q-001": "Should the Security Amigo run on every feature?"
      When question "Q-001" is resolved with answer "Only when the feature touches auth, user input, or sensitive data"
      Then question "Q-001" has status "resolved"
      And question "Q-001" has the recorded answer
      And the blueprint passes validation

    @command:ResolveQuestion @sad-path
    Scenario: Resolving a question that does not exist
      When question "Q-999" is resolved with any answer
      Then the command fails with an error message that names "Q-999"
      And the blueprint is unchanged

    @command:ResolveQuestion @edge-case @should-have
    Scenario: Resolving a question that is already resolved updates the answer with a warning
      Given the blueprint has a resolved question "Q-001" with an existing answer
      When question "Q-001" is resolved again with a new answer
      Then a warning is shown that "Q-001" was already resolved
      And the warning includes when "Q-001" was first resolved
      And question "Q-001" has the new answer
      And the blueprint passes validation
