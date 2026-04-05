@must-have @context:BlueprintManagement
Feature: Blueprint views — smart reading for large blueprints
  The blueprint grows with real projects (2500+ lines). Agents need
  compact views to understand the system without reading everything.
  The CLI provides summary and context-view commands so agents read
  only what they need, while the full file stays as single source of truth.

  Background:
    Given a project with a blueprint containing 6 bounded contexts
    And the blueprint is 2500 lines

  Rule: A compact summary gives agents a system-level mental model

    @command:GenerateSummary
    Scenario: Agent reads summary for orientation
      When the agent runs "blueprint summary"
      Then the output contains the meta section
      And each bounded context is listed with its name, description, and aggregate names
      And relationships between contexts are shown
      And glossary terms are listed
      And the output does not contain commands, events, policies, gaps, or questions
      And the output is under 150 lines

    @command:GenerateSummary
    Scenario: Summary for a fresh project with one context
      Given a project with a blueprint containing 1 bounded context
      When the agent runs "blueprint summary"
      Then the summary is under 30 lines
      And the structure is identical to a large project summary

    @command:GenerateSummary
    Scenario: Summary includes event and command counts per aggregate
      When the agent runs "blueprint summary"
      Then each aggregate shows the number of commands and events
      But the individual command and event names are not listed

  Rule: A context view gives agents full detail for targeted work

    @command:GenerateContextView
    Scenario: Agent reads a single context for targeted work
      When the agent runs "blueprint view --context Payment"
      Then the output contains the full Payment bounded context
      And relationship targets from Payment are listed by name
      And glossary terms defined in the Payment context are included
      And bounded contexts other than Payment are not included

    @command:GenerateContextView
    Scenario: Context view includes cross-referenced glossary terms
      Given the glossary term "Invoice" is defined in the Payment context
      When the agent runs "blueprint view --context Payment"
      Then the glossary section contains the "Invoice" term with its definition

    @sad-path @command:GenerateContextView
    Scenario: View for a non-existent context
      When the agent runs "blueprint view --context NonExistent"
      Then the command fails with exit code 1
      And the error message lists the available context names

  Rule: Skills follow a decision tree for blueprint reads

    @command:GenerateSummary
    Scenario: The Foreman uses summary for pipeline detection
      Given The Foreman starts a pipeline run
      When it reads the blueprint
      Then it uses "blueprint summary" for orientation
      And it does not read the full blueprint file

    @command:GenerateContextView
    Scenario: Agent escalates from summary to context view
      Given an agent has read the blueprint summary
      When it needs to work on the Payment context specifically
      Then it reads "blueprint view --context Payment" for detail

    Scenario: Cross-context agent reads full blueprint
      Given Sticky Storm needs to enforce event uniqueness across all contexts
      When it reads the blueprint
      Then it reads the full .storyline/blueprint.yaml file
      Because event uniqueness is a cross-context invariant
