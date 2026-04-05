@must-have @context:Orchestration @context:BlueprintManagement
Feature: Enforced housekeeping — validate, stamp, and clean up after every phase
  In longer sessions agents forget to validate, stamp, and clean up the
  workbench. Housekeeping is enforced through three layers: a CLI command,
  mandatory todo steps in every phase, and PostToolUse hooks that catch
  blueprint mutations via Bash.

  Rule: The housekeeping command validates and stamps in one step

    @command:RunHousekeeping
    Scenario: Housekeeping on a valid blueprint
      Given the blueprint has been edited during this phase
      And the blueprint is valid
      When the agent runs "blueprint housekeeping"
      Then the blueprint is validated
      And the blueprint version is incremented
      And the updated_at timestamp is set to today

    @sad-path @command:RunHousekeeping
    Scenario: Housekeeping finds validation errors
      Given the blueprint has a referential integrity error
      When the agent runs "blueprint housekeeping"
      Then validation errors are reported to stderr
      And the blueprint is not stamped
      And the exit code is non-zero

    @edge-case @command:RunHousekeeping
    Scenario: Housekeeping when nothing changed
      Given the blueprint was already validated and stamped
      And no edits were made since the last stamp
      When the agent runs "blueprint housekeeping"
      Then it reports "Blueprint already up to date"
      And the version is not incremented

    @edge-case @command:RunHousekeeping
    Scenario: Housekeeping is idempotent
      Given the agent just ran "blueprint housekeeping" successfully
      When the agent runs "blueprint housekeeping" again
      Then it reports "Blueprint already up to date"
      And no error occurs

  Rule: Every pipeline phase ends with a housekeeping todo step

    Scenario: Three Amigos phase includes housekeeping todo
      When the Three Amigos skill creates its todo list
      Then the last todo item is a housekeeping step
      And its description includes "blueprint housekeeping"

    Scenario: The Onion phase includes housekeeping todo
      When The Onion skill creates its todo list
      Then the last todo item is a housekeeping step
      And its description includes "blueprint housekeeping"

    Scenario: Mister Gherkin phase includes housekeeping todo
      When Mister Gherkin creates its todo list
      Then the last todo item is a housekeeping step
      And its description includes "blueprint housekeeping"

  Rule: PostToolUse hook catches Bash blueprint mutations for auto-validation

    @command:RunHousekeeping
    Scenario: CLI add-event triggers auto-validation via hook
      When an agent runs "blueprint add-event --context Payment --aggregate Invoice --name InvoiceSent" via Bash
      Then the PostToolUse hook detects a blueprint mutation
      And "blueprint validate" runs automatically
      And the validation result is shown to the agent

    @edge-case
    Scenario: Non-blueprint Bash calls do not trigger validation
      When an agent runs "git status" via Bash
      Then the PostToolUse hook does not trigger blueprint validation

    @edge-case
    Scenario: Blueprint command in a chained Bash call
      When an agent runs "cd /project && blueprint add-context Payment" via Bash
      Then the PostToolUse hook detects "blueprint add-" in the command
      And "blueprint validate" runs automatically

    @edge-case
    Scenario: Blueprint read commands do not trigger validation
      When an agent runs "blueprint summary" via Bash
      Then the PostToolUse hook does not trigger validation
      Because read-only commands do not mutate the blueprint

  Rule: Workbench cleanup requires explicit action and refuses without commit

    @should-have @command:RunHousekeeping
    Scenario: Cleanup after committing phase artifacts
      Given the workbench contains example-map.yaml from a completed Three Amigos session
      And example-map.yaml has been committed to git
      When the agent runs "blueprint housekeeping --cleanup"
      Then consumed workbench artifacts are removed

    @sad-path @command:RunHousekeeping
    Scenario: Cleanup refused when workbench has uncommitted changes
      Given the workbench contains example-map.yaml with uncommitted modifications
      When the agent runs "blueprint housekeeping --cleanup"
      Then the command refuses with "Uncommitted changes in workbench/ — commit first"
      And no files are deleted

    @should-have @command:RunHousekeeping
    Scenario: Phase-specific cleanup preserves artifacts needed by next phase
      Given the workbench contains amigo-notes/ and example-map.yaml
      And all workbench files are committed
      When the agent runs "blueprint housekeeping --cleanup --phase three-amigos"
      Then amigo-notes/ is removed
      But example-map.yaml is preserved
      Because Mister Gherkin needs it in the next phase

    Scenario: Artifacts survive across sessions without automatic cleanup
      Given Three Amigos completed on Monday
      And no cleanup was triggered
      When Mister Gherkin starts on Thursday
      Then example-map.yaml is still in the workbench
      And Mister Gherkin can read it normally

  Rule: Estimation reports are saved to plans/, not workbench/

    @should-have @command:DispatchAppraiser
    Scenario: Appraiser writes estimation report to plans/
      When The Appraiser completes a triangulated estimate for "user-dashboard"
      Then the report is saved to ".storyline/plans/YYYY-MM-DD-estimation-user-dashboard.md"
      And the report is not in the workbench/ directory
