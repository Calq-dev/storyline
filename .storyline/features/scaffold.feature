@must-have @aggregate:ImplementationPlan @context:Implementation
Feature: Scaffold from Blueprint
  As a plugin-contributor
  I want to generate code scaffolding from a blueprint
  So that I can bootstrap new projects without manually creating the directory structure

  Background:
    Given a blueprint with context "Payment" containing aggregate "Invoice" with:
      | field         | value       |
      | root_entity   | Invoice     |
      | events        | InvoiceSent |
      | commands      | SendInvoice |
      | value_objects | Money       |
    And the "InvoiceSent" event has payload fields "invoiceId" and "amount"

  Rule: scaffold generates TypeScript directory structure from blueprint

    @command:ScaffoldFromBlueprint
    Scenario: TypeScript aggregate root is generated
      When the scaffold runs for TypeScript output
      Then a file exists at "payment/domain/invoice.ts"
      And the file contains "export class Invoice"

    @command:ScaffoldFromBlueprint
    Scenario: TypeScript event file is generated with payload fields
      When the scaffold runs for TypeScript output
      Then a file exists at "payment/domain/events/invoice-sent.ts"
      And the file contains "interface InvoiceSent"
      And the file contains "readonly invoiceId"
      And the file contains "readonly amount"

    @command:ScaffoldFromBlueprint
    Scenario: TypeScript command handler is generated
      When the scaffold runs for TypeScript output
      Then a file exists at "payment/application/send-invoice-handler.ts"
      And the file contains "class SendInvoiceHandler"

    @command:ScaffoldFromBlueprint
    Scenario: TypeScript repository interface is generated
      When the scaffold runs for TypeScript output
      Then a file exists at "payment/domain/invoice-repository.ts"
      And the file contains "interface InvoiceRepository"

    @command:ScaffoldFromBlueprint
    Scenario: TypeScript in-memory repository is generated for testing
      When the scaffold runs for TypeScript output
      Then a file exists at "payment/infrastructure/in-memory-invoice-repository.ts"
      And the file contains "class InMemoryInvoiceRepository"

    @edge-case @command:ScaffoldFromBlueprint
    Scenario: Aggregate with no events or commands generates only root and repository
      Given a blueprint with context "Billing" containing aggregate "Receipt" with no events or commands
      When the scaffold runs for TypeScript output
      Then a file exists at "billing/domain/receipt.ts"
      And a file exists at "billing/domain/receipt-repository.ts"
      But no files exist under "billing/application/"

  Rule: scaffold generates Python directory structure from blueprint

    @command:ScaffoldFromBlueprint
    Scenario: Python aggregate root is generated
      When the scaffold runs for Python output
      Then a file exists at "payment/domain/invoice.py"
      And the file contains "class Invoice"

    @command:ScaffoldFromBlueprint
    Scenario: Python context includes __init__.py files in all layers
      When the scaffold runs for Python output
      Then a file exists at "payment/__init__.py"
      And a file exists at "payment/domain/__init__.py"
      And a file exists at "payment/application/__init__.py"
      And a file exists at "payment/infrastructure/__init__.py"

  Rule: scaffold loads both YAML and JSON model formats

    @command:ScaffoldFromBlueprint
    Scenario: Scaffold loads a YAML model file
      Given a YAML model file with exactly one bounded context
      When the scaffold runs for TypeScript output
      Then the scaffold completes successfully
      And the summary reports "Bounded contexts: 1"

    @command:ScaffoldFromBlueprint
    Scenario: Scaffold loads a legacy JSON model
      Given a domain-model.json file with at least one bounded context
      When the scaffold runs for TypeScript output
      Then the scaffold completes successfully

  Rule: scaffold CLI provides clear feedback and errors

    @command:ScaffoldFromBlueprint
    Scenario: Scaffold prints a summary after generation
      When the scaffold runs for TypeScript output
      Then the output contains "Scaffold generated"
      And the output contains "Bounded contexts: 1"
      And the output contains "Aggregates: 1"
      And the output contains "Next step: write your first acceptance test!"

    @sad-path @command:ScaffoldFromBlueprint
    Scenario: Missing model file gives a clear error message
      Given no model file exists at "missing.yaml"
      When the scaffold runs with model "missing.yaml"
      Then the scaffold exits with a non-zero code
      And the error output contains "Model file not found: missing.yaml"

  Rule: scaffold.ts replaces scaffold.py

    @command:ScaffoldFromBlueprint
    Scenario: scaffold.ts exists at scripts/scaffold.ts
      Then a file exists at "scripts/scaffold.ts"

    @command:ScaffoldFromBlueprint
    Scenario: scaffold.py no longer exists after the port
      Then "skills/the-onion/scripts/scaffold.py" does not exist

  @should-have @aggregate:ImplementationPlan @context:Implementation
  Rule: scaffold is accessible via the storyline CLI

    @command:ScaffoldFromBlueprint
    Scenario: scaffold command appears in storyline usage output
      When the storyline CLI is invoked with no arguments
      Then the usage output includes "scaffold --model"
