/**
 * Tests for scripts/changeset.ts — run with: npx tsx --test scripts/test-changeset.ts
 */

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANGESET_SCRIPT = join(fileURLToPath(import.meta.url), "..", "changeset.ts");
const BLUEPRINT_SCRIPT = join(fileURLToPath(import.meta.url), "..", "blueprint.ts");

function runChangeset(
  args: string[],
  cwd: string,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("npx", ["tsx", CHANGESET_SCRIPT, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status ?? 1 };
  }
}

function runBlueprint(args: string[], cwd: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("npx", ["tsx", BLUEPRINT_SCRIPT, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status ?? 1 };
  }
}

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "changeset-test-"));
  tempDirs.push(dir);
  return dir;
}

function initProject(d: string): void {
  mkdirSync(join(d, ".storyline"), { recursive: true });
  runBlueprint(["init", "--project", "Test App"], d);
}

function readChangeset(d: string, filename: string): any {
  const content = readFileSync(join(d, ".storyline", "changesets", filename), "utf-8");
  return parseDocument(content).toJSON();
}

// ---------------------------------------------------------------------------
// Test 1: init creates changeset file with correct meta
// ---------------------------------------------------------------------------
test("changeset_init_creates_file_with_correct_meta", () => {
  const d = tmp();
  initProject(d);

  const result = runChangeset(["init", "--title", "Add Payment Context"], d);
  assert.equal(result.exitCode, 0, `init failed:\n${result.stderr}`);

  const files = readdirSync(join(d, ".storyline", "changesets"));
  assert.equal(files.length, 1, "Expected exactly one changeset file");
  assert.ok(files[0].startsWith("CS-"), "Filename should start with CS-");
  assert.ok(files[0].includes("add-payment-context"), "Filename should include slug");

  const cs = readChangeset(d, files[0]);
  assert.equal(cs.meta.title, "Add Payment Context");
  assert.equal(cs.meta.status, "draft");
  assert.equal(typeof cs.meta.blueprint_version, "number");
  assert.equal(typeof cs.meta.created_at, "string");
  assert.ok(cs.meta.id.startsWith("CS-"), "id should start with CS-");
  assert.deepEqual(cs.phases, []);
});

// ---------------------------------------------------------------------------
// Test 2: init refuses if same file already exists
// ---------------------------------------------------------------------------
test("changeset_init_refuses_if_file_exists", () => {
  const d = tmp();
  initProject(d);

  runChangeset(["init", "--title", "Add Payment Context"], d);
  const result = runChangeset(["init", "--title", "Add Payment Context"], d);

  assert.notEqual(result.exitCode, 0, "Second init should fail");
  assert.ok((result.stderr + result.stdout).toLowerCase().includes("already exists"));
});

// ---------------------------------------------------------------------------
// Test 3: init captures current blueprint version
// ---------------------------------------------------------------------------
test("changeset_init_captures_blueprint_version", () => {
  const d = tmp();
  initProject(d);
  runBlueprint(["stamp"], d); // bump to version 2
  runBlueprint(["stamp"], d); // bump to version 3

  runChangeset(["init", "--title", "My Feature"], d);

  const files = readdirSync(join(d, ".storyline", "changesets"));
  const cs = readChangeset(d, files[0]);
  assert.equal(cs.meta.blueprint_version, 3);
});

// ---------------------------------------------------------------------------
// Test 4: init creates changesets/ directory if it doesn't exist
// ---------------------------------------------------------------------------
test("changeset_init_creates_changesets_dir", () => {
  const d = tmp();
  initProject(d);

  assert.ok(!existsSync(join(d, ".storyline", "changesets")), "changesets/ should not exist yet");

  runChangeset(["init", "--title", "My Feature"], d);

  assert.ok(existsSync(join(d, ".storyline", "changesets")), "changesets/ should be created");
});

// ---------------------------------------------------------------------------
// Test 5: init refuses when different title produces the same slug
// ---------------------------------------------------------------------------
test("changeset_init_refuses_slug_collision_from_different_title", () => {
  const d = tmp();
  initProject(d);

  runChangeset(["init", "--title", "Add Payment Context"], d);
  // "Add-Payment-Context" produces the same slug: "add-payment-context"
  const result = runChangeset(["init", "--title", "Add-Payment-Context"], d);

  assert.notEqual(result.exitCode, 0, "Slug collision should be refused");
  assert.ok((result.stderr + result.stdout).toLowerCase().includes("already exists"),
    `Expected 'already exists' in error:\n${result.stderr}\n${result.stdout}`);
});

// ---------------------------------------------------------------------------
// Test 6: validate passes on fresh init'd changeset
// ---------------------------------------------------------------------------
test("changeset_validate_passes_on_fresh_changeset", () => {
  const d = tmp();
  initProject(d);
  runChangeset(["init", "--title", "My Feature"], d);

  const result = runChangeset(["validate"], d);
  assert.equal(result.exitCode, 0, `validate should pass on fresh changeset:\n${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 7: validate errors on missing meta.title
// ---------------------------------------------------------------------------
test("changeset_validate_errors_on_missing_title", () => {
  const d = tmp();
  initProject(d);
  mkdirSync(join(d, ".storyline", "changesets"), { recursive: true });
  writeFileSync(
    join(d, ".storyline", "changesets", "CS-2026-04-05-test.yaml"),
    "meta:\n  id: CS-2026-04-05-test\n  blueprint_version: 1\n  created_at: '2026-04-05'\n  status: draft\ngoal: ''\nphases: []\ncompletion_criteria: []\nopen_questions: []\n",
    "utf-8",
  );
  const result = runChangeset(["validate"], d);
  assert.notEqual(result.exitCode, 0);
  assert.ok((result.stderr + result.stdout).includes("meta.title"),
    `Expected error about meta.title:\n${result.stderr}\n${result.stdout}`);
});

// ---------------------------------------------------------------------------
// Test 8: validate errors on invalid status
// ---------------------------------------------------------------------------
test("changeset_validate_errors_on_invalid_status", () => {
  const d = tmp();
  initProject(d);
  mkdirSync(join(d, ".storyline", "changesets"), { recursive: true });
  writeFileSync(
    join(d, ".storyline", "changesets", "CS-2026-04-05-test.yaml"),
    "meta:\n  id: CS-2026-04-05-test\n  title: Test\n  blueprint_version: 1\n  created_at: '2026-04-05'\n  status: bogus\ngoal: ''\nphases: []\ncompletion_criteria: []\nopen_questions: []\n",
    "utf-8",
  );
  const result = runChangeset(["validate"], d);
  assert.notEqual(result.exitCode, 0);
  assert.ok((result.stderr + result.stdout).includes("status"),
    `Expected error about status:\n${result.stderr}\n${result.stdout}`);
});

// ---------------------------------------------------------------------------
// Test 9: validate errors when refactor phase has no migration block
// ---------------------------------------------------------------------------
test("changeset_validate_errors_on_missing_migration_block", () => {
  const d = tmp();
  initProject(d);
  mkdirSync(join(d, ".storyline", "changesets"), { recursive: true });
  writeFileSync(
    join(d, ".storyline", "changesets", "CS-2026-04-05-test.yaml"),
    [
      "meta:",
      "  id: CS-2026-04-05-test",
      "  title: Test",
      "  blueprint_version: 1",
      "  created_at: '2026-04-05'",
      "  status: draft",
      "goal: ''",
      "phases:",
      "  - id: PH-01",
      "    title: Refactor something",
      "    type: refactor",
      "    touches:",
      "      add: []",
      "      modify: []",
      "      remove: []",
      "    depends_on: []",
      "    acceptance: []",
      "completion_criteria: []",
      "open_questions: []",
    ].join("\n"),
    "utf-8",
  );
  const result = runChangeset(["validate"], d);
  assert.notEqual(result.exitCode, 0);
  assert.ok((result.stderr + result.stdout).toLowerCase().includes("migration"),
    `Expected error about migration:\n${result.stderr}\n${result.stdout}`);
});

// ---------------------------------------------------------------------------
// Test 10: validate --json outputs structured JSON with valid/errors fields
// ---------------------------------------------------------------------------
test("changeset_validate_json_output_on_error", () => {
  const d = tmp();
  initProject(d);
  mkdirSync(join(d, ".storyline", "changesets"), { recursive: true });
  // Missing meta.title
  writeFileSync(
    join(d, ".storyline", "changesets", "CS-2026-04-05-test.yaml"),
    "meta:\n  id: CS-2026-04-05-test\n  blueprint_version: 1\n  created_at: '2026-04-05'\n  status: draft\ngoal: ''\nphases: []\ncompletion_criteria: []\nopen_questions: []\n",
    "utf-8",
  );
  const result = runChangeset(["validate", "--json"], d);
  const combined = result.stdout + result.stderr;
  const jsonMatch = combined.match(/\{[\s\S]*\}/);
  assert.ok(jsonMatch, `Expected JSON in output:\n${combined}`);
  const parsed = JSON.parse(jsonMatch![0]);
  assert.ok("valid" in parsed, "JSON should have 'valid' field");
  assert.ok("errors" in parsed, "JSON should have 'errors' field");
  assert.equal(parsed.valid, false);
  assert.ok(Array.isArray(parsed.errors) && parsed.errors.length > 0, "errors should be non-empty");
});
