@surveyed
Feature: Blueprint Management
  The blueprint.py CLI manages the lifecycle of blueprint.yaml,
  providing initialization, validation, stamping, and structural mutations.

  @command:InitializeBlueprint
  Rule: Blueprint initialization creates a valid starting point

    Scenario: Initializing a new blueprint
      Given no .storyline/blueprint.yaml exists
      When blueprint init is run with a project name
      Then a valid blueprint.yaml is created with meta fields
      And .storyline/features/, workbench/, plans/, and backlog/ directories are created
      And the blueprint passes validation

    Scenario: Refusing to initialize when blueprint already exists
      Given .storyline/blueprint.yaml already exists
      When blueprint init is run
      Then it exits with an error containing "already exists"

  @command:ValidateBlueprint
  Rule: Validation checks schema and referential integrity

    Scenario: Validating a fresh empty blueprint
      Given a freshly initialized blueprint
      When blueprint validate is run
      Then it passes with "Blueprint is valid"

    Scenario: Detecting missing meta.project
      Given a blueprint without meta.project
      When blueprint validate is run
      Then it reports a schema error for meta.project

    Scenario: Detecting unknown top-level keys
      Given a blueprint with an extra key "foo: bar"
      When blueprint validate is run
      Then it reports a schema error for the unknown key

    Scenario: Detecting missing feature files on disk
      Given a command references a feature file that does not exist
      When blueprint validate is run
      Then it reports a file-not-found error with the checked path

    Scenario: Detecting broken policy references
      Given a policy references a non-existent event
      When blueprint validate is run
      Then it reports a referential integrity error

    Scenario: Detecting broken relationship targets
      Given a relationship targets a non-existent bounded context
      When blueprint validate is run
      Then it reports a referential integrity error

    Scenario: Detecting duplicate event names
      Given two aggregates define an event with the same name
      When blueprint validate is run
      Then it reports a referential integrity error about the duplicate

    Scenario: Strict mode requires all sections and non-empty bounded_contexts
      Given a blueprint with empty bounded_contexts
      When blueprint validate is run with --strict
      Then it reports that bounded_contexts must be non-empty

  @command:StampBlueprint
  Rule: Stamping validates first, then increments version

    Scenario: Stamping a valid blueprint
      Given a valid blueprint at version 1
      When blueprint stamp is run
      Then meta.version is incremented to 2
      And meta.updated_at is set to today's date

    Scenario: Refusing to stamp an invalid blueprint
      Given an invalid blueprint with schema errors
      When blueprint stamp is run
      Then it exits with errors and does not update version

  @command:AddContext @command:AddAggregate @command:AddEvent @command:AddCommand
  Rule: CLI helpers add structural elements safely

    Scenario: Adding a bounded context
      Given a valid blueprint
      When add-context is run with a name
      Then the context is added to bounded_contexts
      And the blueprint remains valid

    Scenario: Refusing duplicate context names
      Given a blueprint with context "Payment"
      When add-context "Payment" is run again
      Then it exits with "already exists"

    Scenario: Adding an aggregate to a context
      Given a blueprint with context "Payment"
      When add-aggregate is run for "Invoice" in "Payment"
      Then the aggregate is added with empty commands, events, and invariants

    Scenario: Adding an event with payload fields
      Given an aggregate "Invoice" in context "Payment"
      When add-event is run with name "InvoiceSent" and payload "invoiceId,amount"
      Then the event is added with payload_fields as a list

    Scenario: Adding a command with feature files
      Given an aggregate "Invoice" in context "Payment"
      And the feature file "invoicing.feature" exists on disk
      When add-command is run with name "SendInvoice" and feature-files "invoicing.feature"
      Then the command is added with feature_files as a list

  @command:AddGlossaryTerm @command:AddGap @command:AddQuestion
  Rule: CLI helpers add glossary, gaps, and questions safely

    Scenario: Adding a glossary term
      Given a blueprint with context "Payment"
      When add-glossary is run for term "Invoice" in context "Payment"
      Then the glossary entry is added with the definition

    Scenario: Adding a gap
      Given a blueprint with context "Payment"
      When add-gap is run with severity "important" affecting "Payment"
      Then a gap is added with an auto-generated ID like GAP-001

    Scenario: Adding a question
      Given a blueprint with context "Payment"
      When add-question is run with severity "important"
      Then a question is added with status "open" and auto-generated ID
