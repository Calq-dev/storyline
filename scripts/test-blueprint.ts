/**
 * Tests for scripts/blueprint.ts — run with: npx tsx --test scripts/test-blueprint.ts
 *
 * Ports all 18 Python tests from test_blueprint.py and adds tests for
 * summary, view, and housekeeping commands.
 */

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
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
  try {
    const stdout = execFileSync("npx", ["tsx", SCRIPT, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.status ?? 1,
    };
  }
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
