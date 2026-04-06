/**
 * Tests for scripts/blueprint.ts — run with: npx tsx --test scripts/test-blueprint.ts
 *
 * Ports all 18 Python tests from test_blueprint.py and adds tests for
 * summary, view, and housekeeping commands.
 */

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCRIPT = join(fileURLToPath(import.meta.url), "..", "blueprint.ts");

function run(
  args: string[],
  cwd: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("npx", ["tsx", SCRIPT, ...args], {
    cwd,
    encoding: "utf-8",
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), "blueprint-test-"));
}

function setupBddDir(tmpdir: string): void {
  mkdirSync(join(tmpdir, ".storyline"), { recursive: true });
}

function writeBlueprint(
  tmpdir: string,
  yamlContent: string,
): { blueprintPath: string; featuresDir: string } {
  const bddDir = join(tmpdir, ".storyline");
  mkdirSync(bddDir, { recursive: true });
  const featuresDir = join(bddDir, "features");
  mkdirSync(featuresDir, { recursive: true });
  const blueprintPath = join(bddDir, "blueprint.yaml");
  writeFileSync(blueprintPath, yamlContent, "utf-8");
  return { blueprintPath, featuresDir };
}

// Track temp dirs for cleanup
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function tmp(): string {
  const dir = makeTmp();
  tempDirs.push(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// Test 1: init creates a valid blueprint
// ---------------------------------------------------------------------------
test("test_init_creates_valid_blueprint", () => {
  const d = tmp();
  setupBddDir(d);

  const result = run(["init", "--project", "Test App"], d);
  assert.equal(result.exitCode, 0, `init failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const blueprintPath = join(d, ".storyline", "blueprint.yaml");
  assert.ok(readFileSync(blueprintPath, "utf-8").length > 0, "blueprint.yaml was not created");

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after init:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 2: init refuses if blueprint already exists
// ---------------------------------------------------------------------------
test("test_init_refuses_if_blueprint_exists", () => {
  const d = tmp();
  setupBddDir(d);

  run(["init", "--project", "Test App"], d);
  const result = run(["init", "--project", "Test App"], d);

  assert.notEqual(result.exitCode, 0, "Second init should have failed but returned 0");
  const output = (result.stderr + result.stdout).toLowerCase();
  assert.ok(output.includes("already exists"), `Expected 'already exists' in output.\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 3: validate empty (freshly initialised) blueprint passes
// ---------------------------------------------------------------------------
test("test_validate_empty_blueprint_passes", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `validate should pass on fresh blueprint:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 4: validate fails when meta.project is missing
// ---------------------------------------------------------------------------
test("test_validate_missing_meta_project_fails", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const blueprintPath = join(d, ".storyline", "blueprint.yaml");
  const badYaml =
    "meta:\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "tech_stack: {}\n" +
    "bounded_contexts: []\n" +
    "glossary: {}\n" +
    "gaps: []\n" +
    "questions: []\n";
  writeFileSync(blueprintPath, badYaml, "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "validate should fail when meta.project is missing");
  assert.ok(result.stderr.includes("meta.project"), `Expected 'meta.project' in stderr.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 5: validate fails when unknown top-level key is present
// ---------------------------------------------------------------------------
test("test_validate_unknown_top_level_key_fails", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const blueprintPath = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(blueprintPath, "utf-8");
  writeFileSync(blueprintPath, content + "\nfoo: bar\n", "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "validate should fail on unknown top-level key");
  assert.ok(result.stderr.includes("foo"), `Expected 'foo' in stderr.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 6: validate fails when a feature file referenced by a command is missing
// ---------------------------------------------------------------------------
test("test_validate_feature_file_not_found", () => {
  const d = tmp();
  const yamlContent =
    "meta:\n" +
    "  project: 'Test App'\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "bounded_contexts:\n" +
    "  - name: Ordering\n" +
    "    aggregates:\n" +
    "      - name: Order\n" +
    "        commands:\n" +
    "          - name: PlaceOrder\n" +
    "            feature_files:\n" +
    "              - nonexistent.feature\n" +
    "        events: []\n" +
    "        policies: []\n" +
    "    relationships: []\n" +
    "    read_models: []\n";
  writeBlueprint(d, yamlContent);

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "validate should fail when feature file is missing");
  assert.ok(result.stderr.includes("nonexistent.feature"), `Expected 'nonexistent.feature' in stderr.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 7: validate fails when a policy references a non-existent event
// ---------------------------------------------------------------------------
test("test_validate_policy_references_missing_event", () => {
  const d = tmp();
  const yamlContent =
    "meta:\n" +
    "  project: 'Test App'\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "bounded_contexts:\n" +
    "  - name: Ordering\n" +
    "    aggregates:\n" +
    "      - name: Order\n" +
    "        commands:\n" +
    "          - name: PlaceOrder\n" +
    "            feature_files: []\n" +
    "        events:\n" +
    "          - name: OrderPlaced\n" +
    "            payload_fields: []\n" +
    "    policies:\n" +
    "      - name: NotifyOnUnknownEvent\n" +
    "        triggered_by: 'NonExistentEvent'\n" +
    "        issues_command: 'PlaceOrder'\n" +
    "    relationships: []\n" +
    "    read_models: []\n";
  writeBlueprint(d, yamlContent);

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "validate should fail when policy references missing event");
  assert.ok(result.stderr.includes("NonExistentEvent"), `Expected 'NonExistentEvent' in stderr.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 8: validate fails when relationship target is a non-existent context
// ---------------------------------------------------------------------------
test("test_validate_relationship_references_missing_context", () => {
  const d = tmp();
  const yamlContent =
    "meta:\n" +
    "  project: 'Test App'\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "bounded_contexts:\n" +
    "  - name: Ordering\n" +
    "    aggregates: []\n" +
    "    relationships:\n" +
    "      - type: customer-supplier\n" +
    "        target: NonExistentContext\n" +
    "    read_models: []\n";
  writeBlueprint(d, yamlContent);

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "validate should fail when relationship target context does not exist");
  assert.ok(result.stderr.includes("NonExistentContext"), `Expected 'NonExistentContext' in stderr.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 9: validate fails when gap affects a non-existent context
// ---------------------------------------------------------------------------
test("test_validate_gap_affects_missing_context", () => {
  const d = tmp();
  const yamlContent =
    "meta:\n" +
    "  project: 'Test App'\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "bounded_contexts:\n" +
    "  - name: Ordering\n" +
    "    aggregates: []\n" +
    "    relationships: []\n" +
    "    read_models: []\n" +
    "gaps:\n" +
    "  - id: GAP-001\n" +
    "    description: A gap referencing a fake context\n" +
    "    severity: important\n" +
    "    affects:\n" +
    "      - FakeContext\n";
  writeBlueprint(d, yamlContent);

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "validate should fail when gap affects a missing context");
  assert.ok(result.stderr.includes("FakeContext"), `Expected 'FakeContext' in stderr.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 10: validate passes for a complete valid blueprint with real feature file
// ---------------------------------------------------------------------------
test("test_validate_valid_full_blueprint_passes", () => {
  const d = tmp();
  const { featuresDir } = writeBlueprint(d, "");

  // Create the actual feature file on disk
  writeFileSync(join(featuresDir, "place_order.feature"), "Feature: Place Order\n", "utf-8");

  const yamlContent =
    "meta:\n" +
    "  project: 'Full App'\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "bounded_contexts:\n" +
    "  - name: Ordering\n" +
    "    aggregates:\n" +
    "      - name: Order\n" +
    "        commands:\n" +
    "          - name: PlaceOrder\n" +
    "            feature_files:\n" +
    "              - place_order.feature\n" +
    "        events:\n" +
    "          - name: OrderPlaced\n" +
    "            payload_fields: []\n" +
    "    policies:\n" +
    "      - name: NotifyOnOrder\n" +
    "        triggered_by: 'OrderPlaced'\n" +
    "        issues_command: 'PlaceOrder'\n" +
    "    relationships:\n" +
    "      - type: customer-supplier\n" +
    "        target: Ordering\n" +
    "    read_models:\n" +
    "      - name: OrderSummary\n" +
    "        built_from:\n" +
    "          - OrderPlaced\n" +
    "  - name: Inventory\n" +
    "    aggregates: []\n" +
    "    relationships: []\n" +
    "    read_models: []\n" +
    "gaps:\n" +
    "  - id: GAP-001\n" +
    "    description: Needs more coverage\n" +
    "    severity: important\n" +
    "    affects:\n" +
    "      - Ordering\n" +
    "questions:\n" +
    "  - id: Q-001\n" +
    "    question: Is ordering ready?\n" +
    "    severity: critical\n" +
    "    affects:\n" +
    "      - Ordering\n" +
    "    status: open\n" +
    "glossary:\n" +
    "  Order:\n" +
    "    definitions:\n" +
    "      - context: Ordering\n" +
    "        meaning: A customer order\n";

  const blueprintPath = join(d, ".storyline", "blueprint.yaml");
  writeFileSync(blueprintPath, yamlContent, "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `validate should pass for a complete valid blueprint.\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 11: add-context adds a context and validate passes
// ---------------------------------------------------------------------------
test("test_add_context", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const result = run(["add-context", "Payment"], d);
  assert.equal(result.exitCode, 0, `add-context failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-context:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);

  // Verify Payment is in the blueprint
  const content = readFileSync(join(d, ".storyline", "blueprint.yaml"), "utf-8");
  assert.ok(content.includes("Payment"), `Expected 'Payment' in blueprint content`);
});

// ---------------------------------------------------------------------------
// Test 12: add-context duplicate fails with "already exists"
// ---------------------------------------------------------------------------
test("test_add_context_duplicate_fails", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);

  const result = run(["add-context", "Payment"], d);
  assert.notEqual(result.exitCode, 0, "Second add-context should have failed");
  assert.ok(result.stderr.toLowerCase().includes("already exists"), `Expected 'already exists' in stderr.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 13: add-aggregate adds an aggregate and validate passes
// ---------------------------------------------------------------------------
test("test_add_aggregate", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);

  const result = run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], d);
  assert.equal(result.exitCode, 0, `add-aggregate failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-aggregate:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 14: add-event adds an event and validate passes
// ---------------------------------------------------------------------------
test("test_add_event", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], d);

  const result = run(
    ["add-event", "--context", "Payment", "--aggregate", "Invoice", "--name", "InvoiceSent", "--payload", "invoiceId,amount"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-event failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-event:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 15: add-command adds a command and validate passes
// ---------------------------------------------------------------------------
test("test_add_command", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], d);

  // Create the feature file on disk
  const featuresDir = join(d, ".storyline", "features");
  mkdirSync(featuresDir, { recursive: true });
  writeFileSync(join(featuresDir, "invoicing.feature"), "Feature: Invoicing\n", "utf-8");

  const result = run(
    ["add-command", "--context", "Payment", "--aggregate", "Invoice", "--name", "SendInvoice", "--feature-files", "invoicing.feature"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-command failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-command:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 16: add-glossary adds a glossary term and validate passes
// ---------------------------------------------------------------------------
test("test_add_glossary", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);

  const result = run(
    ["add-glossary", "--term", "Invoice", "--context", "Payment", "--meaning", "A request for payment"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-glossary failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-glossary:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 17: add-gap adds a gap and validate passes
// ---------------------------------------------------------------------------
test("test_add_gap", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);

  const result = run(
    ["add-gap", "--description", "Missing tests", "--severity", "important", "--affects", "Payment"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-gap failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-gap:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 18: add-question adds a question and validate passes
// ---------------------------------------------------------------------------
test("test_add_question", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);

  const result = run(
    ["add-question", "--question", "How do refunds work?", "--severity", "important", "--raised-during", "Three Amigos", "--affects", "Payment"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-question failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-question:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ===========================================================================
// Summary tests
// ===========================================================================

test("test_summary_shows_context_names_and_aggregate_counts", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], d);

  const result = run(["summary"], d);
  assert.equal(result.exitCode, 0, `summary failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
  assert.ok(result.stdout.includes("Payment"), "Expected 'Payment' in summary output");
  assert.ok(result.stdout.includes("Invoice"), "Expected 'Invoice' in summary output");
});

test("test_summary_excludes_commands_and_events", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], d);
  run(["add-event", "--context", "Payment", "--aggregate", "Invoice", "--name", "InvoiceSent", "--payload", "invoiceId"], d);

  // Create feature file and add command
  const featuresDir = join(d, ".storyline", "features");
  mkdirSync(featuresDir, { recursive: true });
  writeFileSync(join(featuresDir, "invoicing.feature"), "Feature: Invoicing\n", "utf-8");
  run(["add-command", "--context", "Payment", "--aggregate", "Invoice", "--name", "SendInvoice", "--feature-files", "invoicing.feature"], d);

  const result = run(["summary"], d);
  assert.equal(result.exitCode, 0);

  // Summary shows aggregate line with counts but not individual command/event names
  // The summary format is: "    Invoice (1 cmd, 1 evt)" — it shows counts, not names
  // The individual names "SendInvoice" and "InvoiceSent" should NOT appear as separate entries
  assert.ok(!result.stdout.includes("SendInvoice"), "Summary should not list individual command names");
  assert.ok(!result.stdout.includes("InvoiceSent"), "Summary should not list individual event names");
  // But should show the counts
  assert.ok(result.stdout.includes("1 cmd"), "Summary should show command count");
  assert.ok(result.stdout.includes("1 evt"), "Summary should show event count");
});

test("test_summary_includes_glossary", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-glossary", "--term", "Invoice", "--context", "Payment", "--meaning", "A request for payment"], d);

  const result = run(["summary"], d);
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("Glossary"), "Expected 'Glossary' heading in summary");
  assert.ok(result.stdout.includes("Invoice"), "Expected glossary term 'Invoice' in summary");
});

test("test_summary_on_empty_blueprint", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const result = run(["summary"], d);
  assert.equal(result.exitCode, 0, `summary should work on empty blueprint:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
  assert.ok(result.stdout.includes("Test App"), "Expected project name in summary");
});

test("test_summary_includes_context_views_section", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-context", "Ordering"], d);

  const result = run(["summary"], d);
  assert.equal(result.exitCode, 0, `summary failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
  assert.ok(result.stdout.includes("## Context Views"), "Expected '## Context Views' section in summary");
  assert.ok(result.stdout.includes('storyline view --context "Payment"'), "Expected view command for Payment");
  assert.ok(result.stdout.includes('storyline view --context "Ordering"'), "Expected view command for Ordering");
});

test("test_summary_includes_cli_commands_section", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const result = run(["summary"], d);
  assert.equal(result.exitCode, 0, `summary failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
  assert.ok(result.stdout.includes("## Available CLI Commands"), "Expected '## Available CLI Commands' section");
  assert.ok(result.stdout.includes("storyline validate"), "Expected validate command listed");
  assert.ok(result.stdout.includes("storyline housekeeping"), "Expected housekeeping command listed");
  assert.ok(result.stdout.includes("storyline add-context"), "Expected add-context command listed");
});

test("test_summary_no_context_views_when_empty", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const result = run(["summary"], d);
  assert.equal(result.exitCode, 0, `summary failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
  assert.ok(!result.stdout.includes("## Context Views"), "Expected NO '## Context Views' section on empty blueprint");
});

// ===========================================================================
// View tests
// ===========================================================================

test("test_view_shows_full_context", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], d);

  const result = run(["view", "--context", "Payment"], d);
  assert.equal(result.exitCode, 0, `view failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
  assert.ok(result.stdout.includes("Payment"), "Expected 'Payment' in view output");
  assert.ok(result.stdout.includes("Invoice"), "Expected 'Invoice' in view output");
});

test("test_view_includes_relevant_glossary", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-glossary", "--term", "Invoice", "--context", "Payment", "--meaning", "A request for payment"], d);

  const result = run(["view", "--context", "Payment"], d);
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("Glossary"), "Expected glossary section in view output");
  assert.ok(result.stdout.includes("Invoice"), "Expected glossary term 'Invoice' in view output");
  assert.ok(result.stdout.includes("A request for payment"), "Expected glossary meaning in view output");
});

test("test_view_nonexistent_context_lists_available", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-context", "Shipping"], d);

  const result = run(["view", "--context", "NonExistent"], d);
  assert.notEqual(result.exitCode, 0, "view should fail for nonexistent context");
  assert.ok(result.stderr.includes("Payment"), "Expected 'Payment' in available contexts list");
  assert.ok(result.stderr.includes("Shipping"), "Expected 'Shipping' in available contexts list");
});

test("test_view_on_blueprint_with_multiple_contexts", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);
  run(["add-context", "Payment"], d);
  run(["add-context", "Shipping"], d);
  run(["add-aggregate", "--context", "Payment", "--name", "Invoice"], d);
  run(["add-aggregate", "--context", "Shipping", "--name", "Parcel"], d);

  const result = run(["view", "--context", "Payment"], d);
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("Payment"), "Expected 'Payment' in view output");
  assert.ok(result.stdout.includes("Invoice"), "Expected 'Invoice' in view output");
  assert.ok(!result.stdout.includes("Shipping"), "Should not include 'Shipping' context in view of Payment");
  assert.ok(!result.stdout.includes("Parcel"), "Should not include 'Parcel' aggregate in view of Payment");
});

// ===========================================================================
// Housekeeping tests
// ===========================================================================

test("test_housekeeping_validates_and_stamps", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  // Read the initial version
  const blueprintPath = join(d, ".storyline", "blueprint.yaml");
  const before = readFileSync(blueprintPath, "utf-8");
  const versionMatch = before.match(/version:\s*(\d+)/);
  const versionBefore = versionMatch ? parseInt(versionMatch[1], 10) : 0;

  // Init in a git repo so housekeeping sees changes
  execFileSync("git", ["init"], { cwd: d, stdio: "pipe" });
  execFileSync("git", ["add", "."], { cwd: d, stdio: "pipe" });

  const result = run(["housekeeping"], d);
  assert.equal(result.exitCode, 0, `housekeeping failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const after = readFileSync(blueprintPath, "utf-8");
  const versionAfterMatch = after.match(/version:\s*(\d+)/);
  const versionAfter = versionAfterMatch ? parseInt(versionAfterMatch[1], 10) : 0;

  assert.ok(versionAfter > versionBefore, `Expected version to increment. Before: ${versionBefore}, After: ${versionAfter}`);
});

test("test_housekeeping_fails_on_invalid_blueprint", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  // Break the blueprint
  const blueprintPath = join(d, ".storyline", "blueprint.yaml");
  const badYaml =
    "meta:\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "bounded_contexts: []\n";
  writeFileSync(blueprintPath, badYaml, "utf-8");

  const result = run(["housekeeping"], d);
  assert.notEqual(result.exitCode, 0, "housekeeping should fail on invalid blueprint");

  // Version should NOT have changed (no stamp on failure)
  const after = readFileSync(blueprintPath, "utf-8");
  assert.ok(after.includes("version: 1"), "Version should not have been incremented on failure");
});

test("test_housekeeping_already_up_to_date", () => {
  const d = tmp();
  setupBddDir(d);

  // Set up a git repo so housekeeping can check for changes
  execFileSync("git", ["init"], { cwd: d, stdio: "pipe" });

  run(["init", "--project", "Test App"], d);

  // Stamp first so updated_at is today
  run(["stamp"], d);

  // Commit everything so there are no git changes
  execFileSync("git", ["add", "."], { cwd: d, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: d, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@test.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@test.com" } });

  const result = run(["housekeeping"], d);
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes("already up to date"), `Expected 'already up to date' in output.\nSTDOUT: ${result.stdout}`);
});

test("test_housekeeping_idempotent", () => {
  const d = tmp();
  setupBddDir(d);

  // Set up a git repo
  execFileSync("git", ["init"], { cwd: d, stdio: "pipe" });

  run(["init", "--project", "Test App"], d);

  // First housekeeping stamps
  const result1 = run(["housekeeping"], d);
  assert.equal(result1.exitCode, 0);

  // Commit so git sees no changes
  execFileSync("git", ["add", "."], { cwd: d, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "stamped", "--no-gpg-sign"], { cwd: d, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@test.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@test.com" } });

  // Read version after first housekeeping
  const blueprintPath = join(d, ".storyline", "blueprint.yaml");
  const contentAfterFirst = readFileSync(blueprintPath, "utf-8");
  const versionMatch = contentAfterFirst.match(/version:\s*(\d+)/);
  const versionAfterFirst = versionMatch ? parseInt(versionMatch[1], 10) : 0;

  // Second housekeeping should be a no-op
  const result2 = run(["housekeeping"], d);
  assert.equal(result2.exitCode, 0);
  assert.ok(result2.stdout.includes("already up to date"), `Expected second housekeeping to be no-op.\nSTDOUT: ${result2.stdout}`);

  // Version should not change
  const contentAfterSecond = readFileSync(blueprintPath, "utf-8");
  const versionMatch2 = contentAfterSecond.match(/version:\s*(\d+)/);
  const versionAfterSecond = versionMatch2 ? parseInt(versionMatch2[1], 10) : 0;

  assert.equal(versionAfterSecond, versionAfterFirst, "Version should not change on idempotent housekeeping");
});

// ===========================================================================
// Archive tests
// ===========================================================================

test("test_archive_creates_session_directory", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const result = run(["archive", "--feature", "shopping cart"], d);
  assert.equal(result.exitCode, 0, `archive failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const today = new Date().toISOString().slice(0, 10);
  const sessionDir = join(d, ".storyline", "sessions", `${today}-shopping-cart`);
  assert.ok(existsSync(sessionDir), `Expected session directory at ${sessionDir}`);
});

test("test_archive_writes_session_manifest", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "My Project"], d);

  run(["archive", "--feature", "checkout flow"], d);

  const today = new Date().toISOString().slice(0, 10);
  const manifest = join(d, ".storyline", "sessions", `${today}-checkout-flow`, "session.yaml");
  assert.ok(existsSync(manifest), "Expected session.yaml to exist");

  const content = readFileSync(manifest, "utf-8");
  assert.ok(content.includes("feature: checkout flow"), "Expected feature name in manifest");
  assert.ok(content.includes("project: My Project"), "Expected project name in manifest");
});

test("test_archive_copies_workbench_artifacts", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  // Create a workbench artifact
  const workbench = join(d, ".storyline", "workbench");
  mkdirSync(workbench, { recursive: true });
  writeFileSync(join(workbench, "example-map.yaml"), "feature: test\nrules: []");

  run(["archive", "--feature", "my feature"], d);

  const today = new Date().toISOString().slice(0, 10);
  const archived = join(d, ".storyline", "sessions", `${today}-my-feature`, "example-map.yaml");
  assert.ok(existsSync(archived), "Expected example-map.yaml to be archived");
});

test("test_archive_slugifies_feature_name", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  run(["archive", "--feature", "User Login & Auth!"], d);

  const today = new Date().toISOString().slice(0, 10);
  const sessionDir = join(d, ".storyline", "sessions", `${today}-user-login--auth`);
  assert.ok(existsSync(sessionDir), "Expected slugified directory name");
});

test("test_archive_fails_on_duplicate", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  run(["archive", "--feature", "payments"], d);
  const result = run(["archive", "--feature", "payments"], d);

  assert.equal(result.exitCode, 1, "Expected second archive to fail");
  assert.ok(result.stderr.includes("already exists"), "Expected 'already exists' error");
});

test("test_archive_requires_feature_flag", () => {
  const d = tmp();
  setupBddDir(d);
  run(["init", "--project", "Test App"], d);

  const result = run(["archive"], d);
  assert.equal(result.exitCode, 1, "Expected archive without --feature to fail");
});

// ===========================================================================
// Fixture helper for structural mutation tests
// ===========================================================================

/**
 * Writes a blueprint with two contexts:
 *   - Payments: has Invoice aggregate (no events/commands), empty relationships/policies
 *   - Orchestration: has Pipeline aggregate with StartPipeline command and PipelineStarted event
 *
 * Note: StartPipeline lives in Payments (not Orchestration) so that add-policy tests
 * exercise cross-context command lookup rather than same-context lookup.
 */
function writeMutationFixture(dir: string): string {
  const bp = join(dir, ".storyline", "blueprint.yaml");
  writeFileSync(bp, `\
meta:
  project: "Test"
  created_at: "2026-01-01"
tech_stack:
  language: TypeScript
bounded_contexts:
  - name: Payments
    aggregates:
      - name: Invoice
        invariants: []
        commands:
          - name: StartPipeline
            feature_files: []
        events: []
    relationships: []
    policies: []
  - name: Orchestration
    aggregates:
      - name: Pipeline
        commands: []
        events:
          - name: PipelineStarted
            payload_fields: []
    relationships: []
    policies: []
questions:
  - id: "Q-001"
    question: "Should the Security Amigo run on every feature?"
    severity: "important"
    affects:
      - Payments
    status: open
`, "utf-8");
  return bp;
}

// ===========================================================================
// Tests 40–49: structural mutation commands
// ===========================================================================

// ---------------------------------------------------------------------------
// Test 40: add-relationship appends to context relationships
// ---------------------------------------------------------------------------
test("test_add_relationship", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["add-relationship", "--context", "Payments", "--type", "customer-supplier", "--target", "Orchestration", "--via", "payment events trigger pipeline transitions"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-relationship failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const content = readFileSync(join(d, ".storyline", "blueprint.yaml"), "utf-8");
  assert.ok(content.includes("customer-supplier"), "Expected relationship type in blueprint");
  assert.ok(content.includes("Orchestration"), "Expected relationship target in blueprint");

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-relationship:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 41: add-relationship fails when context does not exist
// ---------------------------------------------------------------------------
test("test_add_relationship_context_not_found", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["add-relationship", "--context", "NonExistent", "--type", "customer-supplier", "--target", "Orchestration"],
    d,
  );
  assert.equal(result.exitCode, 1, "Expected exit code 1 when context not found");
  assert.ok(result.stderr.includes("NonExistent"), `Expected error to name the missing context.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 42: add-invariant appends to aggregate invariants
// ---------------------------------------------------------------------------
test("test_add_invariant", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["add-invariant", "--context", "Payments", "--aggregate", "Invoice", "--invariant", "An invoice amount must be greater than zero"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-invariant failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const content = readFileSync(join(d, ".storyline", "blueprint.yaml"), "utf-8");
  assert.ok(content.includes("An invoice amount must be greater than zero"), "Expected invariant text in blueprint");

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-invariant:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 43: add-invariant fails when aggregate does not exist in context
// ---------------------------------------------------------------------------
test("test_add_invariant_aggregate_not_found", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["add-invariant", "--context", "Payments", "--aggregate", "Order", "--invariant", "x"],
    d,
  );
  assert.equal(result.exitCode, 1, "Expected exit code 1 when aggregate not found");
  assert.ok(result.stderr.includes("Order"), `Expected error to name the missing aggregate.\nSTDERR: ${result.stderr}`);
  assert.ok(result.stderr.includes("Payments"), `Expected error to name the context.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 44: add-policy appends to context policies (cross-context command lookup)
// ---------------------------------------------------------------------------
test("test_add_policy", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  // StartPipeline is in Payments (cross-context), PipelineStarted is in Orchestration
  const result = run(
    ["add-policy", "--context", "Orchestration", "--name", "StartOnInit", "--triggered-by", "PipelineStarted", "--issues-command", "StartPipeline"],
    d,
  );
  assert.equal(result.exitCode, 0, `add-policy failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const content = readFileSync(join(d, ".storyline", "blueprint.yaml"), "utf-8");
  assert.ok(content.includes("StartOnInit"), "Expected policy name in blueprint");
  assert.ok(content.includes("PipelineStarted"), "Expected triggered_by in blueprint");
  assert.ok(content.includes("StartPipeline"), "Expected issues_command in blueprint");

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after add-policy:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 45: add-policy fails when triggered-by event not in context
// ---------------------------------------------------------------------------
test("test_add_policy_event_not_found", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["add-policy", "--context", "Orchestration", "--name", "NotifyOnOrder", "--triggered-by", "OrderPlaced", "--issues-command", "StartPipeline"],
    d,
  );
  assert.equal(result.exitCode, 1, "Expected exit code 1 when event not found");
  assert.ok(result.stderr.includes("OrderPlaced"), `Expected error to name the missing event.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 46: add-policy fails when issues-command not found in any context
// ---------------------------------------------------------------------------
test("test_add_policy_command_not_found", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["add-policy", "--context", "Orchestration", "--name", "Notify", "--triggered-by", "PipelineStarted", "--issues-command", "SendEmail"],
    d,
  );
  assert.equal(result.exitCode, 1, "Expected exit code 1 when command not found");
  assert.ok(result.stderr.includes("SendEmail"), `Expected error to name the missing command.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 47: resolve-question sets status to resolved with answer and resolved_at
// ---------------------------------------------------------------------------
test("test_resolve_question", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["resolve-question", "--id", "Q-001", "--answer", "Only when the feature touches auth, user input, or sensitive data"],
    d,
  );
  assert.equal(result.exitCode, 0, `resolve-question failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);

  const content = readFileSync(join(d, ".storyline", "blueprint.yaml"), "utf-8");
  // yaml may serialize the scalar with or without quotes depending on source style
  assert.ok(/status:\s+"?resolved"?/.test(content), "Expected status to be resolved");
  assert.ok(content.includes("Only when the feature touches auth"), "Expected answer text in blueprint");
  assert.ok(/resolved_at:\s+"?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(content), "Expected resolved_at ISO datetime in blueprint");

  const validate = run(["validate"], d);
  assert.equal(validate.exitCode, 0, `validate failed after resolve-question:\nSTDOUT: ${validate.stdout}\nSTDERR: ${validate.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 48: resolve-question fails when question ID does not exist
// ---------------------------------------------------------------------------
test("test_resolve_question_not_found", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  const result = run(
    ["resolve-question", "--id", "Q-999", "--answer", "irrelevant"],
    d,
  );
  assert.equal(result.exitCode, 1, "Expected exit code 1 when question not found");
  assert.ok(result.stderr.includes("Q-999"), `Expected error to name the missing question ID.\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 49: resolve-question on already-resolved question warns and updates answer
// ---------------------------------------------------------------------------
test("test_resolve_question_already_resolved", () => {
  const d = tmp();
  setupBddDir(d);
  writeMutationFixture(d);

  // First resolution
  run(["resolve-question", "--id", "Q-001", "--answer", "Original answer"], d);

  // Capture the resolved_at timestamp written by the first resolution
  // The yaml library may serialize with or without quotes, so strip them
  const afterFirst = readFileSync(join(d, ".storyline", "blueprint.yaml"), "utf-8");
  const resolvedAtMatch = afterFirst.match(/resolved_at:\s+"?(\d{4}-\d{2}-\d{2}T[\d:.Z]+)"?/);
  assert.ok(resolvedAtMatch, "Expected resolved_at to be set after first resolution");
  const originalResolvedAt = resolvedAtMatch![1]; // the raw timestamp without quotes

  // Second resolution
  const result = run(
    ["resolve-question", "--id", "Q-001", "--answer", "Updated answer"],
    d,
  );
  assert.equal(result.exitCode, 0, `re-resolve failed:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
  assert.ok(result.stderr.includes("already resolved"), `Expected warning about already resolved.\nSTDERR: ${result.stderr}`);
  assert.ok(result.stderr.includes(originalResolvedAt), `Expected original resolved_at timestamp in warning.\nSTDERR: ${result.stderr}`);

  const content = readFileSync(join(d, ".storyline", "blueprint.yaml"), "utf-8");
  assert.ok(content.includes("Updated answer"), "Expected updated answer in blueprint");
});

// ===========================================================================
// Tests 50–58: new schema fields — actor, rejection_reasons, sagas, answer/decided_at
// ===========================================================================

function mutationFixtureWithSagaSupport(dir: string): string {
  const bp = join(dir, ".storyline", "blueprint.yaml");
  writeFileSync(bp, `\
meta:
  project: "Test"
  created_at: "2026-01-01"
bounded_contexts:
  - name: Ordering
    aggregates:
      - name: Order
        commands:
          - name: PlaceOrder
            feature_files: []
          - name: CancelOrder
            feature_files: []
        events:
          - name: OrderPlaced
            payload_fields: [orderId]
          - name: OrderCancelled
            payload_fields: [orderId]
    policies: []
    relationships: []
  - name: Payment
    aggregates:
      - name: PaymentLedger
        commands:
          - name: RequestPayment
            feature_files: []
          - name: RefundPayment
            feature_files: []
        events:
          - name: PaymentReceived
            payload_fields: [orderId, amount]
    policies: []
    relationships: []
questions:
  - id: "Q-001"
    question: "What payment methods?"
    severity: "important"
    affects:
      - Payment
    status: open
`, "utf-8");
  return bp;
}

// ---------------------------------------------------------------------------
// Test 50: actor field on command is accepted
// ---------------------------------------------------------------------------
test("test_actor_on_command_accepted", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  // Insert actor into PlaceOrder command
  writeFileSync(bp, content.replace(
    "          - name: PlaceOrder\n            feature_files: []",
    "          - name: PlaceOrder\n            actor: Customer\n            feature_files: []",
  ), "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `validate failed with valid actor field:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 51: actor field must be a string
// ---------------------------------------------------------------------------
test("test_actor_must_be_string", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    "          - name: PlaceOrder\n            feature_files: []",
    "          - name: PlaceOrder\n            actor: [Customer, Admin]\n            feature_files: []",
  ), "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected validation to fail when actor is not a string");
  assert.ok(result.stderr.includes("actor"), `Expected 'actor' in error:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 52: rejection_reasons field on command is accepted
// ---------------------------------------------------------------------------
test("test_rejection_reasons_on_command_accepted", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    "          - name: PlaceOrder\n            feature_files: []",
    "          - name: PlaceOrder\n            feature_files: []\n            rejection_reasons:\n              - InsufficientStock\n              - CreditLimitExceeded",
  ), "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `validate failed with valid rejection_reasons:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 53: rejection_reasons must be a list
// ---------------------------------------------------------------------------
test("test_rejection_reasons_must_be_list", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    "          - name: PlaceOrder\n            feature_files: []",
    "          - name: PlaceOrder\n            feature_files: []\n            rejection_reasons: InsufficientStock",
  ), "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected validation to fail when rejection_reasons is not a list");
  assert.ok(result.stderr.includes("rejection_reasons"), `Expected 'rejection_reasons' in error:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 54: valid saga is accepted
// ---------------------------------------------------------------------------
test("test_valid_saga_accepted", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    "    policies: []\n    relationships: []\n  - name: Payment",
    `    sagas:
      - name: OrderFulfillmentSaga
        steps:
          - on: OrderPlaced
            do: RequestPayment
            context: Payment
        compensation:
          - CancelOrder
    policies: []
    relationships: []
  - name: Payment`,
  ), "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `validate failed with valid saga:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 55: saga step with unknown event fails referential integrity
// ---------------------------------------------------------------------------
test("test_saga_step_unknown_event_fails", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    "    policies: []\n    relationships: []\n  - name: Payment",
    `    sagas:
      - name: BrokenSaga
        steps:
          - on: NonExistentEvent
            do: RequestPayment
    policies: []
    relationships: []
  - name: Payment`,
  ), "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected validation to fail for unknown saga event");
  assert.ok(result.stderr.includes("NonExistentEvent"), `Expected event name in error:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 56: saga step with unknown command fails referential integrity
// ---------------------------------------------------------------------------
test("test_saga_step_unknown_command_fails", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    "    policies: []\n    relationships: []\n  - name: Payment",
    `    sagas:
      - name: BrokenSaga
        steps:
          - on: OrderPlaced
            do: NonExistentCommand
    policies: []
    relationships: []
  - name: Payment`,
  ), "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected validation to fail for unknown saga command");
  assert.ok(result.stderr.includes("NonExistentCommand"), `Expected command name in error:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 57: answer and decided_at on question are accepted
// ---------------------------------------------------------------------------
test("test_answer_and_decided_at_on_question_accepted", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    '    status: "open"',
    '    status: "resolved"\n    answer: "Card and bank transfer only"\n    decided_at: "2026-04-05"',
  ), "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `validate failed with valid answer/decided_at:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 58: saga missing steps field fails schema validation
// ---------------------------------------------------------------------------
test("test_saga_missing_steps_fails", () => {
  const d = tmp();
  setupBddDir(d);
  mutationFixtureWithSagaSupport(d);

  const bp = join(d, ".storyline", "blueprint.yaml");
  const content = readFileSync(bp, "utf-8");
  writeFileSync(bp, content.replace(
    "    policies: []\n    relationships: []\n  - name: Payment",
    `    sagas:
      - name: IncompleteSaga
    policies: []
    relationships: []
  - name: Payment`,
  ), "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected validation to fail when saga has no steps");
  assert.ok(result.stderr.includes("steps"), `Expected 'steps' in error:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Helpers for spec_type tests
// ---------------------------------------------------------------------------

function makeSpecTypeBlueprintYaml(specType: string | null, featureFile: string): string {
  const specTypeLine = specType != null ? `\n            spec_type: ${specType}` : "";
  return (
    "meta:\n" +
    "  project: 'SpecType Test'\n" +
    "  created_at: '2026-01-01'\n" +
    "  updated_at: '2026-01-01'\n" +
    "  version: 1\n" +
    "bounded_contexts:\n" +
    "  - name: Ordering\n" +
    "    aggregates:\n" +
    "      - name: Order\n" +
    "        commands:\n" +
    "          - name: PlaceOrder\n" +
    "            feature_files:\n" +
    `              - ${featureFile}` +
    specTypeLine + "\n" +
    "        events: []\n" +
    "        policies: []\n" +
    "    relationships: []\n" +
    "    read_models: []\n"
  );
}

// ---------------------------------------------------------------------------
// Test 59: no spec_type — .feature file resolves against features/ — passes
// ---------------------------------------------------------------------------
test("spec_type_absent_feature_file_passes", () => {
  const d = tmp();
  const { featuresDir } = writeBlueprint(d, makeSpecTypeBlueprintYaml(null, "ordering.feature"));
  writeFileSync(join(featuresDir, "ordering.feature"), "Feature: Ordering\n", "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `Expected validation to pass:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 60: spec_type: gherkin — .feature file resolves against features/ — passes
// ---------------------------------------------------------------------------
test("spec_type_gherkin_feature_file_passes", () => {
  const d = tmp();
  const { featuresDir } = writeBlueprint(d, makeSpecTypeBlueprintYaml("gherkin", "ordering.feature"));
  writeFileSync(join(featuresDir, "ordering.feature"), "Feature: Ordering\n", "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `Expected validation to pass:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 61: spec_type: brief — .yaml in workbench — passes when file exists
// ---------------------------------------------------------------------------
test("spec_type_brief_yaml_in_workbench_passes_when_file_exists", () => {
  const d = tmp();
  writeBlueprint(d, makeSpecTypeBlueprintYaml("brief", "technical-brief.yaml"));
  const workbenchDir = join(d, ".storyline", "workbench");
  mkdirSync(workbenchDir, { recursive: true });
  writeFileSync(join(workbenchDir, "technical-brief.yaml"), "id: brief-test\n", "utf-8");

  const result = run(["validate"], d);
  assert.equal(result.exitCode, 0, `Expected validation to pass:\nSTDERR: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 62: spec_type: brief — .yaml in workbench — fails when file absent
// ---------------------------------------------------------------------------
test("spec_type_brief_yaml_in_workbench_fails_when_file_absent", () => {
  const d = tmp();
  writeBlueprint(d, makeSpecTypeBlueprintYaml("brief", "technical-brief.yaml"));
  // workbench dir exists but no file
  mkdirSync(join(d, ".storyline", "workbench"), { recursive: true });

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected validation to fail when brief artifact is absent");
  assert.ok(
    result.stderr.includes("technical-brief.yaml"),
    `Expected 'technical-brief.yaml' in stderr:\nSTDERR: ${result.stderr}`,
  );
});

// ---------------------------------------------------------------------------
// Test 63: spec_type: gherkin — .yaml artifact reference — validation error
// ---------------------------------------------------------------------------
test("spec_type_gherkin_with_yaml_artifact_fails", () => {
  const d = tmp();
  writeBlueprint(d, makeSpecTypeBlueprintYaml("gherkin", "technical-brief.yaml"));
  // Brief file exists but spec_type is wrong
  mkdirSync(join(d, ".storyline", "workbench"), { recursive: true });
  writeFileSync(join(d, ".storyline", "workbench", "technical-brief.yaml"), "id: brief-test\n", "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected validation to fail on spec_type mismatch");
  assert.ok(
    result.stderr.toLowerCase().includes("spec_type"),
    `Expected 'spec_type' mismatch error in stderr:\nSTDERR: ${result.stderr}`,
  );
});

// ---------------------------------------------------------------------------
// Test 64: invalid spec_type value — schema error reported
// ---------------------------------------------------------------------------
test("spec_type_invalid_value_fails_schema", () => {
  const d = tmp();
  const { featuresDir } = writeBlueprint(d, makeSpecTypeBlueprintYaml("markdown", "ordering.feature"));
  writeFileSync(join(featuresDir, "ordering.feature"), "Feature: Ordering\n", "utf-8");

  const result = run(["validate"], d);
  assert.notEqual(result.exitCode, 0, "Expected schema validation to fail on invalid spec_type");
  assert.ok(
    result.stderr.includes("spec_type"),
    `Expected 'spec_type' in stderr:\nSTDERR: ${result.stderr}`,
  );
});
