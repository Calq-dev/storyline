@surveyed
Feature: BDD Discovery Sessions
  Three Amigos explore features from Product, Developer, and Testing
  perspectives before any code or Gherkin is written.

  @command:StartDiscoverySession
  Rule: Discovery sessions produce an Example Map

    Scenario: Starting a discovery session with a feature description
      Given a valid blueprint exists with tech stack and bounded contexts
      When a discovery session is started for a new feature
      Then the Three Amigos explore the feature from all three perspectives
      And produce an Example Map at .storyline/workbench/example-map.yaml

    Scenario: Starting a discovery session from the Foreman with arguments
      Given The Foreman is invoked with a feature description as argument
      When Three Amigos receives the feature description
      Then it skips the framing question
      And goes directly to Example Mapping

  @command:RunQuickScan
  Rule: Quick scan uses a single AI for all perspectives

    Scenario: Quick scan discovery
      Given a feature needs exploration
      And quick scan mode is selected
      When the discovery runs
      Then a single AI embodies all three perspectives
      And produces an Example Map with rules, examples, and questions

  @command:RunFullSession
  Rule: Full session dispatches parallel persona agents with a crew roster

    Scenario: Full session with core three persona agents
      Given a feature needs exploration
      And full session mode is selected
      When the discovery runs
      Then three persona agents are dispatched in parallel
      And each agent writes to their own notes file in .storyline/workbench/amigo-notes/
      And each agent reads the others' notes for async discussion
      And persona memory is updated at .storyline/personas/

    @as-built
    Scenario: Full session with Frontend Amigo when project has a frontend framework
      Given a feature needs exploration
      And the blueprint tech_stack includes a frontend framework
      When the crew roster is built
      Then the Frontend Amigo is added to the session
      And all agents receive the full crew roster in their prompt

    @as-built
    Scenario: Full session with Security Amigo when feature touches sensitive areas
      Given a feature touches auth, user input, or sensitive data
      When the crew roster is built
      Then the Security Amigo is added to the session
      And all agents receive the full crew roster in their prompt

    @as-built
    Scenario: Contextual questions during agent wait times
      Given persona agents are working in parallel
      When the facilitator is waiting for results
      Then it shares an insight and a contextual question with the user
      And the question is relevant to the feature being explored

  @command:UpdatePersonaMemory
  Rule: Persona agents maintain persistent memory across sessions

    Scenario: Persona memory is organized by topic
      Given a persona agent has completed a session
      When it updates its memory file
      Then insights are organized by topic headings
      And domain knowledge, patterns, and lessons are recorded

    Scenario: SubagentStop hook warns on missing memory update
      Given a persona agent finishes a session
      And its memory file was not updated within 30 seconds
      When the SubagentStop hook fires
      Then a warning is emitted about missing memory update

  @command:CaptureBacklogItem
  Rule: The Scout captures feature ideas into the backlog

    Scenario: Capturing a feature idea into the backlog
      Given the user describes a feature they want to build
      When The Scout processes the idea
      Then a markdown file is created in .storyline/backlog/
      And it contains the raw idea, initial context, and open questions
