# Changeset YAML — Format, Init, and Validate (Story A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `.storyline/changesets/CS-YYYY-MM-DD-<slug>.yaml` as the structured replacement for `.storyline/plans/*.md`, with `storyline changeset init` and `storyline changeset validate [--json]` CLI commands.

**Architecture:** New `scripts/changeset.ts` handles all `changeset` subcommands. `bin/storyline` dispatches to it when the first arg is `changeset`. The changeset YAML schema is self-contained and validated independently from `blueprint.yaml`, but cross-references it for version lock and touches-path validation.

**Tech Stack:** TypeScript / Node.js 18+ / tsx / `yaml` npm package (already in deps) / `node:test` for tests

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `scripts/changeset.ts` | Create | All `changeset` subcommands: init, validate |
| `scripts/test-changeset.ts` | Create | node:test tests for changeset CLI |
| `bin/storyline` | Modify (3 lines) | Dispatch `changeset` first-arg to `changeset.ts` |
| `scripts/blueprint.ts` | Modify (1 line) | Change `plans` → `changesets` in `cmdInit` subdir list |

---

## Task 1: Update `bin/storyline` to dispatch `changeset` subcommands

**Files:**
- Modify: `bin/storyline`

- [ ] **Step 1: Write the failing test (manual)**

There's no automated test for bin/storyline dispatch — verify manually after implementing.

- [ ] **Step 2: Update `bin/storyline`**

Replace the `exec` line at the bottom with dispatch logic:

```bash
#!/usr/bin/env bash
# Blueprint CLI wrapper — uses Node.js with tsx for TypeScript
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

find_node_modules() {
  # 1. Plugin install: node_modules symlinked into cache dir by SessionStart hook
  if [ -d "${SCRIPT_DIR}/node_modules" ]; then
    echo "${SCRIPT_DIR}/node_modules"; return
  fi
  # 2. CLAUDE_PLUGIN_DATA is set in hook subprocess contexts (fallback)
  if [ -n "${CLAUDE_PLUGIN_DATA:-}" ] && [ -d "${CLAUDE_PLUGIN_DATA}/node_modules" ]; then
    echo "${CLAUDE_PLUGIN_DATA}/node_modules"; return
  fi
  # 3. Local dev: project node_modules in cwd
  if [ -d "$(pwd)/node_modules" ]; then
    echo "$(pwd)/node_modules"
  fi
}

NM="$(find_node_modules)"
if [ -z "$NM" ]; then
  echo "storyline: node_modules not found. Run: npm install" >&2
  exit 1
fi

# Dispatch to the right script based on first argument
FIRST_ARG="${1:-}"
if [ "$FIRST_ARG" = "changeset" ]; then
  shift
  exec node --import "${NM}/tsx/dist/esm/index.mjs" "${SCRIPT_DIR}/scripts/changeset.ts" "$@"
else
  exec node --import "${NM}/tsx/dist/esm/index.mjs" "${SCRIPT_DIR}/scripts/blueprint.ts" "$@"
fi
```

- [ ] **Step 3: Verify dispatch works**

```bash
cd /tmp && mkdir test-dispatch && cd test-dispatch
storyline changeset 2>&1 | grep -i "unknown\|usage\|error\|changeset"
```

Expected: some output (even an error about missing command is fine — it means dispatch worked and reached changeset.ts).

- [ ] **Step 4: Commit**

```bash
git add bin/storyline
git commit -m "feat: dispatch changeset subcommand to changeset.ts"
```

---

## Task 2: Create `scripts/changeset.ts` — types, constants, path parser

**Files:**
- Create: `scripts/changeset.ts`

This task creates the file with types and the blueprint path parser. No commands yet.

- [ ] **Step 1: Create `scripts/changeset.ts` with types and path resolver**

```typescript
#!/usr/bin/env node
/**
 * changeset.ts — Changeset CLI for the Storyline BDD pipeline.
 *
 * Subcommands:
 *   changeset init --title "<title>"           Scaffold a new changeset file
 *   changeset validate [--json] [<id>]         Validate one or all changesets
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseDocument, Document } from "yaml";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANGESETS_DIR = ".storyline/changesets";
const BLUEPRINT_PATH = ".storyline/blueprint.yaml";

const ALLOWED_STATUSES = new Set(["draft", "ready", "in_progress", "done", "abandoned"]);
const ALLOWED_PHASE_TYPES = new Set(["addition", "refactor", "migration", "removal"]);
const ALLOWED_PHASE_STATUSES = new Set(["pending", "in_progress", "done", "skipped"]);
const MIGRATION_REQUIRED_TYPES = new Set(["refactor", "migration"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Dict = Record<string, any>;

interface ValidationError {
  phase?: string;
  field: string;
  message: string;
  type: "schema" | "version_mismatch" | "path_not_found" | "path_already_exists" | "missing_required_block" | "duplicate_value";
}

interface ValidationWarning {
  phase?: string;
  field: string;
  message: string;
  type: "version_drift" | "duplicate_append";
}

interface ValidationResult {
  valid: boolean;
  file: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

function loadYaml(path: string): any {
  return parseDocument(readFileSync(path, "utf-8")).toJSON();
}

function isDict(v: any): v is Dict {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Blueprint path parser
//
// Syntax: "bounded_contexts[Name].aggregates[Name].events[Name]"
// Bracket segments address named items in arrays.
// Plain segments address keys in dicts.
// ---------------------------------------------------------------------------

interface PathSegment {
  key: string;       // e.g. "bounded_contexts", "aggregates", "events", "payload_fields"
  index?: string;    // present for bracket segments: bounded_contexts[Payment] → "Payment"
}

function parsePathSegments(pathStr: string): PathSegment[] | null {
  // Split on "." — but segments may contain brackets: "bounded_contexts[Name]"
  const raw = pathStr.split(".");
  const segments: PathSegment[] = [];
  for (const part of raw) {
    const m = part.match(/^([a-z_]+)\[([^\]]+)\]$/);
    if (m) {
      segments.push({ key: m[1], index: m[2] });
    } else if (/^[a-z_]+$/.test(part)) {
      segments.push({ key: part });
    } else {
      return null; // unparseable
    }
  }
  return segments;
}

/** Resolve a bracket-notation path against the blueprint data.
 *  Returns the node at that path, or undefined if any step is missing. */
function resolveBlueprintPath(blueprint: any, pathStr: string): { found: boolean; value: any } {
  const segments = parsePathSegments(pathStr);
  if (!segments) return { found: false, value: undefined };

  let node: any = blueprint;
  for (const seg of segments) {
    if (node === undefined || node === null) return { found: false, value: undefined };
    if (seg.index !== undefined) {
      // Navigate into an array, finding by .name field
      if (!Array.isArray(node[seg.key])) return { found: false, value: undefined };
      const match = node[seg.key].find((item: any) => isDict(item) && item.name === seg.index);
      if (!match) return { found: false, value: undefined };
      node = match;
    } else {
      // Plain key navigation
      if (!isDict(node) || !(seg.key in node)) return { found: false, value: undefined };
      node = node[seg.key];
    }
  }
  return { found: true, value: node };
}

// ---------------------------------------------------------------------------
// Blueprint version helpers
// ---------------------------------------------------------------------------

function loadBlueprintVersion(cwd: string): number | null {
  const bp = join(cwd, BLUEPRINT_PATH);
  if (!existsSync(bp)) return null;
  try {
    const data = loadYaml(bp);
    const v = data?.meta?.version;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

function loadBlueprint(cwd: string): any | null {
  const bp = join(cwd, BLUEPRINT_PATH);
  if (!existsSync(bp)) return null;
  try {
    return loadYaml(bp);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Subcommands (stubs — implemented in later tasks)
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage: storyline changeset <command> [options]

Commands:
  init --title "<title>"           Scaffold a new changeset file
  validate [--json] [<id>]         Validate one or all changesets
`);
}

function main() {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  const cwd = process.cwd();

  switch (command) {
    case "init":
    case "validate":
      console.error(`Command '${command}' not yet implemented`);
      process.exit(1);
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main();
```

- [ ] **Step 2: Verify the file parses**

```bash
cd /Users/janegbertkrikken/Projects/storyline
npx tsx scripts/changeset.ts 2>&1
```

Expected: prints usage (exit 0).

- [ ] **Step 3: Commit**

```bash
git add scripts/changeset.ts
git commit -m "feat: scaffold changeset.ts with types and blueprint path parser"
```

---

## Task 3: Implement `changeset init`

**Files:**
- Modify: `scripts/changeset.ts`

- [ ] **Step 1: Write failing test in `scripts/test-changeset.ts`**

Create the test file:

```typescript
/**
 * Tests for scripts/changeset.ts — run with: npx tsx --test scripts/test-changeset.ts
 */

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
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

  const files = require("node:fs").readdirSync(join(d, ".storyline", "changesets"));
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

  const files = require("node:fs").readdirSync(join(d, ".storyline", "changesets"));
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
```

- [ ] **Step 2: Run tests — expect fail**

```bash
cd /Users/janegbertkrikken/Projects/storyline
npx tsx --test scripts/test-changeset.ts 2>&1 | head -30
```

Expected: all 4 tests FAIL with "not yet implemented".

- [ ] **Step 3: Implement `cmdInit` in `scripts/changeset.ts`**

Replace the stub `case "init":` in `main()` and add the `cmdInit` function. Add above `printUsage()`:

```typescript
function cmdInit(args: { title: string }, cwd: string) {
  const changesetsDir = join(cwd, CHANGESETS_DIR);
  mkdirSync(changesetsDir, { recursive: true });

  const slug = titleToSlug(args.title);
  const dateStr = today();
  const id = `CS-${dateStr}-${slug}`;
  const filename = `${id}.yaml`;
  const filePath = join(changesetsDir, filename);

  if (existsSync(filePath)) {
    console.error(`Error: Changeset ${filename} already exists. Edit it directly or use a different title.`);
    process.exit(1);
  }

  const blueprintVersion = loadBlueprintVersion(cwd) ?? 0;

  const doc = new Document({
    meta: {
      id,
      title: args.title,
      blueprint_version: blueprintVersion,
      created_at: nowIso(),
      status: "draft",
    },
    goal: "",
    constraints: [],
    phases: [],
    completion_criteria: [],
    open_questions: [],
  });

  writeFileSync(filePath, String(doc), "utf-8");
  console.log(`Changeset initialised at ${CHANGESETS_DIR}/${filename}`);
}
```

Update `main()` to wire `init`:

```typescript
  switch (command) {
    case "init": {
      const { values } = parseArgs({
        args: rest,
        options: { title: { type: "string" } },
        strict: true,
      });
      if (!values.title) {
        console.error("Error: --title is required for changeset init");
        process.exit(1);
      }
      cmdInit({ title: values.title }, cwd);
      break;
    }
    case "validate":
      console.error(`Command '${command}' not yet implemented`);
      process.exit(1);
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx tsx --test scripts/test-changeset.ts 2>&1
```

Expected: 4 tests pass (the validate tests haven't been written yet).

- [ ] **Step 5: Commit**

```bash
git add scripts/changeset.ts scripts/test-changeset.ts
git commit -m "feat: changeset init command with tests"
```

---

## Task 4: Implement `changeset validate` — schema check

**Files:**
- Modify: `scripts/changeset.ts`
- Modify: `scripts/test-changeset.ts`

This task implements schema validation (required fields, allowed values). Touches-path and blueprint version checks come in Task 5.

- [ ] **Step 1: Write failing tests — append to `scripts/test-changeset.ts`**

```typescript
// ---------------------------------------------------------------------------
// Test 5: validate passes on fresh init'd changeset
// ---------------------------------------------------------------------------
test("changeset_validate_passes_on_fresh_changeset", () => {
  const d = tmp();
  initProject(d);
  runChangeset(["init", "--title", "My Feature"], d);

  const result = runChangeset(["validate"], d);
  assert.equal(result.exitCode, 0, `validate should pass on fresh changeset:\n${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 6: validate errors on missing meta.title
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
  assert.ok((result.stderr + result.stdout).includes("meta.title"));
});

// ---------------------------------------------------------------------------
// Test 7: validate errors on invalid status
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
  assert.ok((result.stderr + result.stdout).includes("status"));
});

// ---------------------------------------------------------------------------
// Test 8: validate errors when refactor phase has no migration block
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
  assert.ok((result.stderr + result.stdout).toLowerCase().includes("migration"));
});

// ---------------------------------------------------------------------------
// Test 9: validate --json outputs structured JSON
// ---------------------------------------------------------------------------
test("changeset_validate_json_output_on_error", () => {
  const d = tmp();
  initProject(d);
  mkdirSync(join(d, ".storyline", "changesets"), { recursive: true });
  writeFileSync(
    join(d, ".storyline", "changesets", "CS-2026-04-05-test.yaml"),
    "meta:\n  id: CS-2026-04-05-test\n  blueprint_version: 1\n  created_at: '2026-04-05'\n  status: draft\ngoal: ''\nphases: []\ncompletion_criteria: []\nopen_questions: []\n",
    "utf-8",
  );
  const result = runChangeset(["validate", "--json"], d);
  // May exit 0 or 1, but stdout must be valid JSON
  const combined = result.stdout + result.stderr;
  // Find JSON in output
  const jsonMatch = combined.match(/\{[\s\S]*\}/);
  assert.ok(jsonMatch, `Expected JSON in output:\n${combined}`);
  const parsed = JSON.parse(jsonMatch![0]);
  assert.ok("valid" in parsed, "JSON should have 'valid' field");
  assert.ok("errors" in parsed, "JSON should have 'errors' field");
});
```

- [ ] **Step 2: Run tests — expect the 5 new tests to fail**

```bash
npx tsx --test scripts/test-changeset.ts 2>&1 | tail -20
```

- [ ] **Step 3: Implement `validateChangesetSchema` and `cmdValidate` in `scripts/changeset.ts`**

Add before `cmdInit`:

```typescript
// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

function validateChangesetSchema(data: any, file: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isDict(data)) {
    errors.push({ field: "<root>", message: "Changeset must be a YAML mapping.", type: "schema" });
    return errors;
  }

  // meta
  const meta = data.meta;
  if (!isDict(meta)) {
    errors.push({ field: "meta", message: "meta is required and must be a mapping.", type: "schema" });
    return errors;
  }
  if (!meta.id || typeof meta.id !== "string") {
    errors.push({ field: "meta.id", message: "meta.id is required and must be a string.", type: "schema" });
  }
  if (!meta.title || typeof meta.title !== "string") {
    errors.push({ field: "meta.title", message: "meta.title is required and must be a non-empty string.", type: "schema" });
  }
  if (typeof meta.blueprint_version !== "number") {
    errors.push({ field: "meta.blueprint_version", message: "meta.blueprint_version is required and must be an integer.", type: "schema" });
  }
  if (!meta.created_at || typeof meta.created_at !== "string") {
    errors.push({ field: "meta.created_at", message: "meta.created_at is required.", type: "schema" });
  }
  if (!meta.status || !ALLOWED_STATUSES.has(meta.status)) {
    errors.push({
      field: "meta.status",
      message: `meta.status must be one of: ${[...ALLOWED_STATUSES].join(", ")}. Got: '${meta.status}'.`,
      type: "schema",
    });
  }

  // phases
  if (!Array.isArray(data.phases)) {
    errors.push({ field: "phases", message: "phases must be a list.", type: "schema" });
    return errors;
  }

  for (const phase of data.phases) {
    if (!isDict(phase)) continue;
    const pid = phase.id ?? "<unknown>";

    if (!phase.id || typeof phase.id !== "string") {
      errors.push({ phase: pid, field: "id", message: "Phase id is required.", type: "schema" });
    }
    if (!phase.title || typeof phase.title !== "string") {
      errors.push({ phase: pid, field: "title", message: "Phase title is required.", type: "schema" });
    }
    if (!phase.type || !ALLOWED_PHASE_TYPES.has(phase.type)) {
      errors.push({
        phase: pid,
        field: "type",
        message: `Phase type must be one of: ${[...ALLOWED_PHASE_TYPES].join(", ")}. Got: '${phase.type}'.`,
        type: "schema",
      });
    }
    if (phase.status && !ALLOWED_PHASE_STATUSES.has(phase.status)) {
      errors.push({
        phase: pid,
        field: "status",
        message: `Phase status must be one of: ${[...ALLOWED_PHASE_STATUSES].join(", ")}. Got: '${phase.status}'.`,
        type: "schema",
      });
    }

    // migration required for refactor/migration types
    if (MIGRATION_REQUIRED_TYPES.has(phase.type)) {
      const mig = phase.migration;
      if (!isDict(mig) || !mig.strategy || !mig.rollback) {
        errors.push({
          phase: pid,
          field: "migration",
          message: `Phase '${pid}' is type '${phase.type}' but has no migration block with strategy and rollback. Add migration.strategy and migration.rollback.`,
          type: "missing_required_block",
        });
      }
    }
  }

  return errors;
}
```

Add `cmdValidate` after `cmdInit`:

```typescript
function cmdValidate(args: { json: boolean; id?: string }, cwd: string) {
  const changesetsDir = join(cwd, CHANGESETS_DIR);

  if (!existsSync(changesetsDir)) {
    if (args.json) {
      console.log(JSON.stringify({ valid: false, errors: [{ field: "<root>", message: `No changesets directory found at ${CHANGESETS_DIR}`, type: "schema" }], warnings: [] }));
    } else {
      console.error(`No changesets directory found at ${CHANGESETS_DIR}. Run: storyline changeset init --title "..."`);
    }
    process.exit(1);
  }

  // Determine which files to validate
  let files: string[];
  if (args.id) {
    // Accept bare id (CS-2026-04-05-foo) or filename (CS-2026-04-05-foo.yaml)
    const filename = args.id.endsWith(".yaml") ? args.id : `${args.id}.yaml`;
    const filePath = join(changesetsDir, filename);
    if (!existsSync(filePath)) {
      console.error(`Changeset not found: ${filename}`);
      process.exit(1);
    }
    files = [filename];
  } else {
    files = readdirSync(changesetsDir).filter(f => f.endsWith(".yaml"));
    if (files.length === 0) {
      console.log("No changeset files found.");
      return;
    }
  }

  const blueprint = loadBlueprint(cwd);
  const blueprintVersion = blueprint?.meta?.version ?? null;

  const results: ValidationResult[] = [];
  let anyErrors = false;

  for (const filename of files) {
    const filePath = join(changesetsDir, filename);
    let data: any;
    try {
      data = loadYaml(filePath);
    } catch (e: any) {
      const result: ValidationResult = {
        valid: false,
        file: filename,
        errors: [{ field: "<root>", message: `YAML parse error: ${e.message}`, type: "schema" }],
        warnings: [],
      };
      results.push(result);
      anyErrors = true;
      continue;
    }

    const errors = validateChangesetSchema(data, filename);
    const warnings: ValidationWarning[] = [];

    // Blueprint version drift warning
    if (blueprintVersion !== null && isDict(data?.meta) && typeof data.meta.blueprint_version === "number") {
      if (data.meta.blueprint_version !== blueprintVersion) {
        warnings.push({
          field: "meta.blueprint_version",
          message: `Blueprint has moved from v${data.meta.blueprint_version} to v${blueprintVersion} since this changeset was written. Review touches paths for accuracy.`,
          type: "version_drift",
        });
      }
    }

    // Touches path validation (if blueprint available and no schema errors)
    if (blueprint && errors.length === 0 && Array.isArray(data.phases)) {
      for (const phase of data.phases) {
        if (!isDict(phase) || !isDict(phase.touches)) continue;
        const pid = phase.id ?? "<unknown>";

        // Validate modify paths
        for (const mod of phase.touches.modify ?? []) {
          if (!isDict(mod) || !mod.path) continue;
          const { found } = resolveBlueprintPath(blueprint, mod.path);
          if (!found) {
            errors.push({
              phase: pid,
              field: `touches.modify`,
              message: `Path '${mod.path}' not found in blueprint.`,
              type: "path_not_found",
            });
          } else if (mod.action === "append" && Array.isArray(mod.value)) {
            // Duplicate append check
            const { value: targetNode } = resolveBlueprintPath(blueprint, mod.path + "." + (mod.field ?? ""));
            if (Array.isArray(targetNode)) {
              for (const v of mod.value) {
                if (targetNode.includes(v)) {
                  warnings.push({
                    phase: pid,
                    field: `touches.modify`,
                    message: `Value '${v}' may already exist in '${mod.path}.${mod.field}' — check for duplicates.`,
                    type: "duplicate_append",
                  });
                }
              }
            }
          }
        }

        // Validate remove paths
        for (const rem of phase.touches.remove ?? []) {
          if (!isDict(rem) || !rem.path) continue;
          const { found } = resolveBlueprintPath(blueprint, rem.path);
          if (!found) {
            errors.push({
              phase: pid,
              field: `touches.remove`,
              message: `Path '${rem.path}' not found in blueprint.`,
              type: "path_not_found",
            });
          }
        }

        // Validate add — check top-level context additions don't already exist
        const addData = phase.touches.add;
        if (isDict(addData) && Array.isArray(addData.bounded_contexts)) {
          for (const ctx of addData.bounded_contexts) {
            if (!isDict(ctx) || !ctx.name) continue;
            const { found } = resolveBlueprintPath(blueprint, `bounded_contexts[${ctx.name}]`);
            if (found) {
              errors.push({
                phase: pid,
                field: `touches.add`,
                message: `bounded_contexts[${ctx.name}] already exists in blueprint. Use touches.modify instead.`,
                type: "path_already_exists",
              });
            }
          }
        }
      }
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      file: filename,
      errors,
      warnings,
    };
    results.push(result);
    if (errors.length > 0) anyErrors = true;
  }

  if (args.json) {
    // For a single file, output a flat object. For multiple, output an array.
    if (results.length === 1) {
      console.log(JSON.stringify(results[0], null, 2));
    } else {
      console.log(JSON.stringify(results, null, 2));
    }
  } else {
    for (const result of results) {
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          const prefix = w.phase ? `[${result.file}] ${w.phase}` : `[${result.file}]`;
          console.warn(`WARNING ${prefix} ${w.field}: ${w.message}`);
        }
      }
      if (result.errors.length > 0) {
        for (const e of result.errors) {
          const prefix = e.phase ? `[${result.file}] ${e.phase}` : `[${result.file}]`;
          console.error(`ERROR ${prefix} ${e.field}: ${e.message}`);
        }
      } else {
        console.log(`${result.file}: valid`);
      }
    }
  }

  if (anyErrors) process.exit(1);
}
```

Update `main()` to wire `validate`:

```typescript
    case "validate": {
      const { values, positionals } = parseArgs({
        args: rest,
        options: { json: { type: "boolean", default: false } },
        strict: false,
        allowPositionals: true,
      });
      cmdValidate({ json: values.json ?? false, id: positionals[0] }, cwd);
      break;
    }
```

- [ ] **Step 4: Run tests — expect all 9 to pass**

```bash
npx tsx --test scripts/test-changeset.ts 2>&1
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/changeset.ts scripts/test-changeset.ts
git commit -m "feat: changeset validate with schema checks and --json flag"
```

---

## Task 5: Touches-path and blueprint version validation tests

**Files:**
- Modify: `scripts/test-changeset.ts`

The path validation logic is already implemented in `cmdValidate`. This task adds integration tests to confirm it works.

- [ ] **Step 1: Append tests to `scripts/test-changeset.ts`**

```typescript
// ---------------------------------------------------------------------------
// Test 10: validate warns on blueprint version drift
// ---------------------------------------------------------------------------
test("changeset_validate_warns_on_version_drift", () => {
  const d = tmp();
  initProject(d);

  // Init captures version 1. Stamp to version 2.
  runChangeset(["init", "--title", "My Feature"], d);
  runBlueprint(["stamp"], d);

  const result = runChangeset(["validate"], d);
  // Should still exit 0 (warn, not block)
  assert.equal(result.exitCode, 0, `version drift should warn not block:\n${result.stderr}`);
  assert.ok((result.stdout + result.stderr).toLowerCase().includes("warning") || (result.stdout + result.stderr).toLowerCase().includes("warn"),
    `Expected a warning in output:\n${result.stdout}\n${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 11: validate errors on stale modify path
// ---------------------------------------------------------------------------
test("changeset_validate_errors_on_stale_modify_path", () => {
  const d = tmp();
  initProject(d);
  // Add a context to the blueprint so we have something to reference
  runBlueprint(["add-context", "Ordering"], d);
  runBlueprint(["stamp"], d);

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
      "    title: Extend OrderPlaced",
      "    type: refactor",
      "    migration:",
      "      strategy: dual-write",
      "      rollback: Remove field",
      "    touches:",
      "      add: []",
      "      modify:",
      "        - path: 'bounded_contexts[Ordering].aggregates[Order].events[OrderPlaced]'",
      "          field: payload_fields",
      "          action: append",
      "          value: ['paymentMethod']",
      "      remove: []",
      "    depends_on: []",
      "    acceptance: []",
      "completion_criteria: []",
      "open_questions: []",
    ].join("\n"),
    "utf-8",
  );

  const result = runChangeset(["validate"], d);
  assert.notEqual(result.exitCode, 0, "stale modify path should fail validation");
  assert.ok((result.stdout + result.stderr).includes("path_not_found") ||
    (result.stdout + result.stderr).includes("not found"),
    `Expected path_not_found error:\n${result.stdout}\n${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 12: validate errors when add path already exists
// ---------------------------------------------------------------------------
test("changeset_validate_errors_when_add_context_already_exists", () => {
  const d = tmp();
  initProject(d);
  runBlueprint(["add-context", "Payment"], d);
  runBlueprint(["stamp"], d);

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
      "    title: Add Payment",
      "    type: addition",
      "    touches:",
      "      add:",
      "        bounded_contexts:",
      "          - name: Payment",
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
  assert.notEqual(result.exitCode, 0, "adding existing context should fail validation");
  assert.ok((result.stdout + result.stderr).includes("already exists"),
    `Expected 'already exists' error:\n${result.stdout}\n${result.stderr}`);
});

// ---------------------------------------------------------------------------
// Test 13: validate --json on version drift includes warning in output
// ---------------------------------------------------------------------------
test("changeset_validate_json_includes_version_drift_warning", () => {
  const d = tmp();
  initProject(d);
  runChangeset(["init", "--title", "My Feature"], d);
  runBlueprint(["stamp"], d); // drift to v2

  const result = runChangeset(["validate", "--json"], d);
  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.stdout);
  assert.ok(Array.isArray(parsed.warnings), "warnings should be an array");
  assert.ok(parsed.warnings.some((w: any) => w.type === "version_drift"), "should contain version_drift warning");
});
```

- [ ] **Step 2: Run all tests**

```bash
npx tsx --test scripts/test-changeset.ts 2>&1
```

Expected: all 13 tests pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-changeset.ts
git commit -m "test: changeset validate — touches paths and blueprint version drift"
```

---

## Task 6: Update `blueprint.ts` `cmdInit` to create `changesets/` instead of `plans/`

**Files:**
- Modify: `scripts/blueprint.ts` (line ~819)

- [ ] **Step 1: Find and update the subdir list**

In `cmdInit`, change `"plans"` to `"changesets"`:

```typescript
for (const subdir of ["features", "workbench", "changesets", "backlog"]) {
  mkdirSync(join(dir, subdir), { recursive: true });
}
```

- [ ] **Step 2: Run the existing blueprint tests to confirm nothing broke**

```bash
npx tsx --test scripts/test-blueprint.ts 2>&1 | tail -10
```

Expected: all tests pass (the test for `init` may have checked for a `plans/` dir — check and update if needed).

- [ ] **Step 3: Check and update the test if needed**

Search for `plans` in `scripts/test-blueprint.ts`:

```bash
grep -n "plans" scripts/test-blueprint.ts
```

If any test asserts that `plans/` is created, update it to assert `changesets/` instead.

- [ ] **Step 4: Run all tests**

```bash
npx tsx --test scripts/test-blueprint.ts 2>&1 | tail -10
npx tsx --test scripts/test-changeset.ts 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/blueprint.ts scripts/test-blueprint.ts
git commit -m "feat: blueprint init creates changesets/ instead of plans/"
```

---

## Task 7: Housekeeping

- [ ] **Step 1: Run `storyline housekeeping`**

```bash
storyline housekeeping
```

Expected: "Blueprint is valid." and a stamp.

- [ ] **Step 2: Update blueprint — add Changeset aggregate to Implementation context**

```bash
storyline add-aggregate --context "Implementation" --name "Changeset"
storyline add-command --context "Implementation" --aggregate "Changeset" --name "InitChangeset" --feature-files "implementation.feature"
storyline add-command --context "Implementation" --aggregate "Changeset" --name "ValidateChangeset" --feature-files "implementation.feature"
storyline add-event --context "Implementation" --aggregate "Changeset" --name "ChangesetInitialised" --payload "id,title,blueprintVersion"
storyline add-event --context "Implementation" --aggregate "Changeset" --name "ChangesetValidated" --payload "id,errorCount,warningCount"
storyline add-glossary --term "Changeset" --context "Implementation" --meaning "A structured YAML file (.storyline/changesets/CS-YYYY-MM-DD-<slug>.yaml) describing what to build or refactor against a specific blueprint version. Contains ordered phases with touches (add/modify/remove blueprint elements), migration strategies, and acceptance criteria. Replaces free-form Markdown plans."
storyline add-glossary --term "Phase" --context "Implementation" --meaning "One ordered step within a Changeset. Has a type (addition | refactor | migration | removal), a touches block declaring which blueprint elements it affects, and acceptance criteria."
storyline add-glossary --term "Touches" --context "Implementation" --meaning "The structured declaration within a Phase of which blueprint elements are added, modified, or removed. Paths use bracket-notation (bounded_contexts[Name].aggregates[Name]...). Validated against the live blueprint during storyline changeset validate."
```

- [ ] **Step 3: Validate and stamp**

```bash
storyline validate
storyline stamp
```

- [ ] **Step 4: Final commit**

```bash
git add .storyline/blueprint.yaml
git commit -m "feat: add Changeset aggregate and glossary to Implementation context"
```

---

## Self-review

**Spec coverage:**
- ✅ R1: file location (`changesets/CS-YYYY-MM-DD-<slug>.yaml`) — Task 3
- ✅ R2: blueprint version lock, warn not block — Task 4 (version drift warning in `cmdValidate`)
- ✅ R4: touches path validation against blueprint — Task 4 (`resolveBlueprintPath`)
- ✅ R5: migration block required for refactor/migration — Task 4 (`validateChangesetSchema`)
- ✅ R8: status fields on changeset + phases — Task 4 (schema validation)
- ✅ R7-init: `changeset init --title` — Task 3
- ✅ NFR1: `--json` flag — Task 4

**Potential gaps:**
- Task 6 notes that a blueprint test may need updating if it asserts `plans/` is created — Step 3 handles this.
- The `bin/storyline` update in Task 1 is verified manually; a future test could automate this.
- Story B items (status, advance, dependency graph) are deliberately deferred.
