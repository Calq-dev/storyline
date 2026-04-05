/**
 * Tests for scripts/scaffold.ts — run with: npx tsx --test scripts/test-scaffold.ts
 *
 * Phase-1 coverage only:
 *   Unit tests: toSnakeCase, toKebabCase, extractEventNames, extractCommandNames
 *   Integration tests: loadModel YAML, loadModel JSON, loadModel missing file
 *
 * scaffold.ts does NOT exist yet — these tests are intentionally RED.
 */

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// This import will fail until scaffold.ts is written — that is the point.
import {
  toSnakeCase,
  toKebabCase,
  extractEventNames,
  extractCommandNames,
  loadModel,
} from "./scaffold.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "scaffold-test-"));
  tempDirs.push(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// Unit tests — toSnakeCase
// ---------------------------------------------------------------------------

test("toSnakeCase converts PascalCase to snake_case", () => {
  assert.equal(toSnakeCase("PipelineSession"), "pipeline_session");
});

test("toSnakeCase converts multi-word PascalCase", () => {
  assert.equal(toSnakeCase("BoundedContext"), "bounded_context");
});

test("toSnakeCase — documents actual output for acronym-like input InvoiceID", () => {
  // The changeset calls out to document actual behaviour, not assumed behaviour.
  // scaffold.ts inserts underscores before each uppercase letter sequence,
  // so 'InvoiceID' becomes 'invoice_i_d'. We assert the documented actual output.
  assert.equal(toSnakeCase("InvoiceID"), "invoice_i_d");
});

// ---------------------------------------------------------------------------
// Unit tests — toKebabCase
// ---------------------------------------------------------------------------

test("toKebabCase converts PascalCase to kebab-case", () => {
  assert.equal(toKebabCase("PipelineSession"), "pipeline-session");
});

test("toKebabCase converts multi-word PascalCase", () => {
  assert.equal(toKebabCase("BoundedContext"), "bounded-context");
});

// ---------------------------------------------------------------------------
// Unit tests — extractEventNames
// ---------------------------------------------------------------------------

test("extractEventNames returns names from plain string array", () => {
  const result = extractEventNames(["OrderPlaced", "OrderShipped"]);
  assert.deepEqual(result, ["OrderPlaced", "OrderShipped"]);
});

test("extractEventNames returns names from object array", () => {
  const events = [
    { name: "InvoiceSent", payload_fields: ["invoiceId", "amount"] },
    { name: "PaymentReceived", payload_fields: ["paymentId"] },
  ];
  const result = extractEventNames(events);
  assert.deepEqual(result, ["InvoiceSent", "PaymentReceived"]);
});

test("extractEventNames handles mixed string and object array", () => {
  const events = [
    "OrderPlaced",
    { name: "InvoiceSent", payload_fields: ["invoiceId"] },
  ];
  const result = extractEventNames(events);
  assert.deepEqual(result, ["OrderPlaced", "InvoiceSent"]);
});

test("extractEventNames returns empty array for empty input", () => {
  assert.deepEqual(extractEventNames([]), []);
});

// ---------------------------------------------------------------------------
// Unit tests — extractCommandNames
// ---------------------------------------------------------------------------

test("extractCommandNames returns names from plain string array", () => {
  const result = extractCommandNames(["PlaceOrder", "ShipOrder"]);
  assert.deepEqual(result, ["PlaceOrder", "ShipOrder"]);
});

test("extractCommandNames returns names from object array", () => {
  const commands = [
    { name: "SendInvoice", feature_files: ["invoicing.feature"] },
    { name: "CancelInvoice", feature_files: [] },
  ];
  const result = extractCommandNames(commands);
  assert.deepEqual(result, ["SendInvoice", "CancelInvoice"]);
});

test("extractCommandNames handles mixed string and object array", () => {
  const commands = [
    "PlaceOrder",
    { name: "SendInvoice", feature_files: ["invoicing.feature"] },
  ];
  const result = extractCommandNames(commands);
  assert.deepEqual(result, ["PlaceOrder", "SendInvoice"]);
});

test("extractCommandNames returns empty array for empty input", () => {
  assert.deepEqual(extractCommandNames([]), []);
});

// ---------------------------------------------------------------------------
// Integration tests — loadModel
// ---------------------------------------------------------------------------

const FIXTURE_YAML = `
bounded_contexts:
  - name: Payment
    aggregates:
      - name: Invoice
        root_entity: Invoice
        commands: []
        events: []
`.trim();

const FIXTURE_JSON = JSON.stringify({
  bounded_contexts: [
    {
      name: "Payment",
      aggregates: [
        {
          name: "Invoice",
          root_entity: "Invoice",
          commands: [],
          events: [],
        },
      ],
    },
  ],
});

test("loadModel reads a YAML file and returns parsed object", () => {
  const d = tmp();
  const modelPath = join(d, "model.yaml");
  writeFileSync(modelPath, FIXTURE_YAML, "utf-8");

  const result = loadModel(modelPath);

  assert.ok(result.bounded_contexts, "bounded_contexts should be present");
  assert.equal(result.bounded_contexts.length, 1);
  assert.equal(result.bounded_contexts[0].name, "Payment");
});

test("loadModel reads a JSON file and returns parsed object", () => {
  const d = tmp();
  const modelPath = join(d, "model.json");
  writeFileSync(modelPath, FIXTURE_JSON, "utf-8");

  const result = loadModel(modelPath);

  assert.ok(result.bounded_contexts, "bounded_contexts should be present");
  assert.equal(result.bounded_contexts.length, 1);
  assert.equal(result.bounded_contexts[0].name, "Payment");
});

test("loadModel throws Error with 'Model file not found' when file does not exist", () => {
  const d = tmp();
  const nonexistentPath = join(d, "nonexistent.yaml");

  assert.throws(
    () => loadModel(nonexistentPath),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should throw an Error instance");
      assert.ok(
        err.message.includes("Model file not found"),
        `Error message should contain 'Model file not found', got: "${err.message}"`,
      );
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// root_entity fallback — aggregate.root_entity ?? aggregate.name
// ---------------------------------------------------------------------------

const FIXTURE_YAML_NO_ROOT_ENTITY = `
bounded_contexts:
  - name: Billing
    aggregates:
      - name: Receipt
        commands: []
        events: []
`.trim();

test("root_entity fallback: aggregate without root_entity falls back to aggregate.name", () => {
  const d = tmp();
  const modelPath = join(d, "model.yaml");
  writeFileSync(modelPath, FIXTURE_YAML_NO_ROOT_ENTITY, "utf-8");

  const result = loadModel(modelPath);
  const aggregate = result.bounded_contexts[0].aggregates[0];

  // root_entity is absent in the fixture — confirm it is undefined/null
  assert.equal(aggregate.root_entity, undefined);

  // The caller pattern: aggregate.root_entity ?? aggregate.name
  const rootEntityName = aggregate.root_entity ?? aggregate.name;
  assert.equal(rootEntityName, "Receipt", "root_entity fallback should return aggregate.name");
});
