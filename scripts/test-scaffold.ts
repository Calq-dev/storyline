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
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// Path to the bin/storyline CLI wrapper used for subprocess (CLI) tests.
const BIN = join(fileURLToPath(import.meta.url), "..", "..", "bin", "storyline");

// Path to an existing blueprint used as a real model file for the happy-path CLI test.
const REAL_BLUEPRINT = join(
  fileURLToPath(import.meta.url),
  "..",
  "..",
  ".storyline",
  "blueprint.yaml",
);

// ---------------------------------------------------------------------------
// CLI subprocess helper
// ---------------------------------------------------------------------------

function runCLI(
  args: string[],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(BIN, args, {
    cwd: cwd ?? tmpdir(),
    encoding: "utf-8",
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// This import will fail until scaffold.ts is written — that is the point.
import {
  toSnakeCase,
  toKebabCase,
  extractEventNames,
  extractCommandNames,
  loadModel,
  generateTypescript,
  generatePython,
  printSummary,
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

// ---------------------------------------------------------------------------
// Phase-2 fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal Payment/Invoice model with one event (InvoiceSent, invoiceId + amount)
 * and one command (SendInvoice). Used by generateTypescript and generatePython tests.
 */
const FIXTURE_PAYMENT_INVOICE = {
  bounded_contexts: [
    {
      name: "Payment",
      aggregates: [
        {
          name: "Invoice",
          root_entity: "Invoice",
          events: [
            { name: "InvoiceSent", payload_fields: ["invoiceId", "amount"] },
          ],
          commands: [
            { name: "SendInvoice", feature_files: ["invoicing.feature"] },
          ],
        },
      ],
    },
  ],
};

/**
 * Minimal Billing/Receipt model with no events and no commands.
 * Used to test the intentional divergence: application/ is NOT created
 * when there are no commands.
 */
const FIXTURE_BILLING_RECEIPT_EMPTY = {
  bounded_contexts: [
    {
      name: "Billing",
      aggregates: [
        {
          name: "Receipt",
          root_entity: "Receipt",
          events: [],
          commands: [],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Integration tests — generateTypescript (Phase-2, RED until implemented)
// ---------------------------------------------------------------------------

test("generateTypescript: aggregate root file exists and contains 'export class Invoice'", () => {
  const d = tmp();

  generateTypescript(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "domain", "invoice.ts");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("export class Invoice"),
    `Expected 'export class Invoice' in invoice.ts, got:\n${content}`,
  );
});

test("generateTypescript: event file exists and contains correct interface and readonly fields", () => {
  const d = tmp();

  generateTypescript(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "domain", "events", "invoice-sent.ts");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("interface InvoiceSent"),
    `Expected 'interface InvoiceSent' in event file, got:\n${content}`,
  );
  assert.ok(
    content.includes("readonly invoiceId"),
    `Expected 'readonly invoiceId' in event file, got:\n${content}`,
  );
  assert.ok(
    content.includes("readonly amount"),
    `Expected 'readonly amount' in event file, got:\n${content}`,
  );
});

test("generateTypescript: command handler file exists and contains 'class SendInvoiceHandler'", () => {
  const d = tmp();

  generateTypescript(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(
    d,
    "payment",
    "application",
    "send-invoice-handler.ts",
  );
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("class SendInvoiceHandler"),
    `Expected 'class SendInvoiceHandler' in handler file, got:\n${content}`,
  );
});

test("generateTypescript: repository interface file exists and contains 'interface InvoiceRepository'", () => {
  const d = tmp();

  generateTypescript(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "domain", "invoice-repository.ts");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("interface InvoiceRepository"),
    `Expected 'interface InvoiceRepository' in repository file, got:\n${content}`,
  );
});

test("generateTypescript: in-memory repository file exists and contains 'class InMemoryInvoiceRepository'", () => {
  const d = tmp();

  generateTypescript(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(
    d,
    "payment",
    "infrastructure",
    "in-memory-invoice-repository.ts",
  );
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("class InMemoryInvoiceRepository"),
    `Expected 'class InMemoryInvoiceRepository' in in-memory repository file, got:\n${content}`,
  );
});

test("generateTypescript: empty aggregate — domain root file exists (billing/domain/receipt.ts)", () => {
  const d = tmp();

  generateTypescript(FIXTURE_BILLING_RECEIPT_EMPTY, d);

  const filePath = join(d, "billing", "domain", "receipt.ts");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
});

test("generateTypescript: empty aggregate — repository file exists (billing/domain/receipt-repository.ts)", () => {
  const d = tmp();

  generateTypescript(FIXTURE_BILLING_RECEIPT_EMPTY, d);

  const filePath = join(d, "billing", "domain", "receipt-repository.ts");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
});

test("generateTypescript: empty aggregate — application/ dir does NOT exist (intentional divergence from Python)", () => {
  const d = tmp();

  generateTypescript(FIXTURE_BILLING_RECEIPT_EMPTY, d);

  const appDir = join(d, "billing", "application");
  assert.ok(
    !existsSync(appDir),
    `Expected billing/application/ to NOT exist when aggregate has no commands, but it was created`,
  );
});

// ---------------------------------------------------------------------------
// Integration tests — generatePython (Phase-2, RED until implemented)
// ---------------------------------------------------------------------------

test("generatePython: domain aggregate file exists and contains 'class Invoice'", () => {
  const d = tmp();

  generatePython(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "domain", "invoice.py");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("class Invoice"),
    `Expected 'class Invoice' in invoice.py, got:\n${content}`,
  );
});

test("generatePython: context-level __init__.py exists (payment/__init__.py)", () => {
  const d = tmp();

  generatePython(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "__init__.py");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
});

test("generatePython: domain __init__.py exists (payment/domain/__init__.py)", () => {
  const d = tmp();

  generatePython(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "domain", "__init__.py");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
});

test("generatePython: application __init__.py exists (payment/application/__init__.py)", () => {
  const d = tmp();

  generatePython(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "application", "__init__.py");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
});

test("generatePython: infrastructure __init__.py exists (payment/infrastructure/__init__.py)", () => {
  const d = tmp();

  generatePython(FIXTURE_PAYMENT_INVOICE, d);

  const filePath = join(d, "payment", "infrastructure", "__init__.py");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
});

// ---------------------------------------------------------------------------
// Integration tests — printSummary (Phase-2, RED until implemented)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Integration tests — value objects (TypeScript + Python)
// ---------------------------------------------------------------------------

/**
 * Payment/Invoice model that includes a value object (Money).
 * Used to exercise the value object file generation paths in both generators.
 */
const FIXTURE_PAYMENT_INVOICE_WITH_VO = {
  bounded_contexts: [
    {
      name: "Payment",
      aggregates: [
        {
          name: "Invoice",
          root_entity: "Invoice",
          value_objects: ["Money"],
          events: [],
          commands: [],
        },
      ],
    },
  ],
};

test("generateTypescript: value object file exists and contains 'export class Money'", () => {
  const d = tmp();

  generateTypescript(FIXTURE_PAYMENT_INVOICE_WITH_VO, d);

  const filePath = join(d, "payment", "domain", "money.ts");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("export class Money"),
    `Expected 'export class Money' in value object file, got:\n${content}`,
  );
});

test("generatePython: value object file exists and contains 'class Money'", () => {
  const d = tmp();

  generatePython(FIXTURE_PAYMENT_INVOICE_WITH_VO, d);

  const filePath = join(d, "payment", "domain", "money.py");
  assert.ok(existsSync(filePath), `Expected ${filePath} to exist`);
  const content = readFileSync(filePath, "utf-8");
  assert.ok(
    content.includes("class Money"),
    `Expected 'class Money' in value object file, got:\n${content}`,
  );
});

// ---------------------------------------------------------------------------
// Integration tests — printSummary (Phase-2, RED until implemented)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CLI end-to-end tests — subprocess via bin/storyline scaffold
// ---------------------------------------------------------------------------

test("CLI scaffold: exit code 0 and at least one .ts file created (typescript)", () => {
  const d = tmp();

  const result = runCLI([
    "scaffold",
    "--model", REAL_BLUEPRINT,
    "--output", d,
    "--lang", "typescript",
  ]);

  assert.equal(
    result.exitCode,
    0,
    `Expected exit code 0, got ${result.exitCode}.\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`,
  );

  // At least one .ts file must have been created somewhere in the output dir.
  // Use spawnSync to find .ts files — avoids shell glob expansion issues.
  const find = spawnSync("find", [d, "-name", "*.ts"], { encoding: "utf-8" });
  const tsFiles = find.stdout.trim().split("\n").filter(Boolean);
  assert.ok(
    tsFiles.length > 0,
    `Expected at least one .ts file in output dir, found none.\nOutput dir: ${d}`,
  );
});

test("CLI scaffold: non-zero exit code and stderr contains 'Model file not found' for missing model", () => {
  const d = tmp();

  const result = runCLI([
    "scaffold",
    "--model", join(d, "missing.yaml"),
    "--output", "/tmp/scaffold-error-test",
    "--lang", "typescript",
  ]);

  assert.notEqual(
    result.exitCode,
    0,
    `Expected non-zero exit code for missing model file, got 0.\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`,
  );
  assert.ok(
    result.stderr.includes("Model file not found"),
    `Expected stderr to contain 'Model file not found', got:\n${result.stderr}`,
  );
});

test("CLI usage: storyline with no args exits non-zero and output contains 'scaffold --model'", () => {
  const result = runCLI([]);

  // The binary exits 1 when called with no arguments.
  assert.notEqual(
    result.exitCode,
    0,
    `Expected non-zero exit code for no-args invocation, got 0.\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`,
  );

  // The usage text is written to stderr by bin/storyline.
  const combined = result.stdout + result.stderr;
  assert.ok(
    combined.includes("scaffold --model"),
    `Expected output to contain 'scaffold --model', got:\n${combined}`,
  );
});

test("printSummary: output contains all four expected lines", () => {
  const d = tmp();

  // Capture stdout by temporarily replacing process.stdout.write
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string | Uint8Array, ...args: any[]): boolean => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  };

  try {
    printSummary(FIXTURE_PAYMENT_INVOICE, d);
  } finally {
    process.stdout.write = originalWrite;
  }

  const output = chunks.join("");

  assert.ok(
    output.includes("Scaffold generated"),
    `Expected 'Scaffold generated' in output, got:\n${output}`,
  );
  assert.ok(
    output.includes("Bounded contexts: 1"),
    `Expected 'Bounded contexts: 1' in output, got:\n${output}`,
  );
  assert.ok(
    output.includes("Aggregates: 1"),
    `Expected 'Aggregates: 1' in output, got:\n${output}`,
  );
  assert.ok(
    output.includes("Next step: write your first acceptance test!"),
    `Expected 'Next step: write your first acceptance test!' in output, got:\n${output}`,
  );
});
