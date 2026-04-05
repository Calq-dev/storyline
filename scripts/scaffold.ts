#!/usr/bin/env node
/**
 * scaffold.ts — Code scaffold generator for The Onion phase.
 *
 * Port of skills/the-onion/scripts/scaffold.py.
 *
 * Reads blueprint.yaml (or domain-model.json for backwards compatibility) and
 * generates directory structure + skeleton files for the bounded contexts,
 * aggregates, and value objects defined in the model.
 *
 * Usage (via bin/storyline):
 *   storyline scaffold --model .storyline/blueprint.yaml --output src/ --lang typescript
 *   storyline scaffold --model .storyline/blueprint.yaml --output src/ --lang python
 */

import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
// Utility: case conversion
// ---------------------------------------------------------------------------

/**
 * Convert PascalCase to snake_case.
 * Inserts an underscore before each uppercase letter (except the first),
 * then lowercases the entire string.
 *
 * Examples:
 *   PipelineSession → pipeline_session
 *   InvoiceID       → invoice_i_d   (each uppercase letter gets its own segment)
 */
export function toSnakeCase(name: string): string {
  const result: string[] = [];
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch >= "A" && ch <= "Z" && i > 0) {
      result.push("_");
    }
    result.push(ch.toLowerCase());
  }
  return result.join("");
}

/**
 * Convert PascalCase to kebab-case.
 * Delegates to toSnakeCase and replaces underscores with hyphens.
 *
 * Examples:
 *   PipelineSession → pipeline-session
 */
export function toKebabCase(name: string): string {
  return toSnakeCase(name).replace(/_/g, "-");
}

// ---------------------------------------------------------------------------
// Utility: normalise event/command arrays
// ---------------------------------------------------------------------------

/**
 * Extract event name strings from a list that may contain either:
 *   - plain strings: "OrderPlaced"
 *   - blueprint objects: { name: "OrderPlaced", payload_fields: [...] }
 */
export function extractEventNames(events: any[]): string[] {
  return events.map((e) =>
    typeof e === "object" && e !== null ? String(e.name) : String(e),
  );
}

/**
 * Extract command name strings from a list that may contain either:
 *   - plain strings: "PlaceOrder"
 *   - blueprint objects: { name: "PlaceOrder", feature_files: [...] }
 */
export function extractCommandNames(commands: any[]): string[] {
  return commands.map((c) =>
    typeof c === "object" && c !== null ? String(c.name) : String(c),
  );
}

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------

/**
 * Load a domain model from a YAML (.yaml / .yml) or JSON file.
 *
 * - Uses the 'yaml' npm package for YAML files.
 * - Uses JSON.parse for all other extensions.
 * - Throws Error (never process.exit) when the file does not exist, so
 *   unit tests can call loadModel directly without killing the test runner.
 * - Falls back to aggregate.name when root_entity is absent (handled by
 *   callers who read aggregate.root_entity ?? aggregate.name).
 */
export function loadModel(path: string): any {
  if (!existsSync(path)) {
    throw new Error(`Model file not found: ${path}`);
  }

  const content = readFileSync(path, "utf-8");
  const lower = path.toLowerCase();

  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return parseYaml(content);
  }

  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Phase-2 stubs — generateTypescript, generatePython, printSummary
// ---------------------------------------------------------------------------
// These will be implemented in phase-2. Exported here so that any import of
// scaffold.ts does not fail with "not a function" even before phase-2 is done.

export function generateTypescript(_model: any, _outputDir: string): void {
  throw new Error("generateTypescript: not yet implemented (phase-2)");
}

export function generatePython(_model: any, _outputDir: string): void {
  throw new Error("generatePython: not yet implemented (phase-2)");
}

export function printSummary(_model: any, _outputDir: string): void {
  throw new Error("printSummary: not yet implemented (phase-2)");
}

// ---------------------------------------------------------------------------
// Phase-3 stub — main()
// ---------------------------------------------------------------------------

export function main(): void {
  throw new Error("main: not yet implemented (phase-3)");
}
