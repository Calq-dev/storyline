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

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
// Phase-2 — generateTypescript, generatePython, printSummary
// ---------------------------------------------------------------------------

export function generateTypescript(model: any, outputDir: string): void {
  const contexts: any[] = model.bounded_contexts ?? [];

  for (const context of contexts) {
    const ctxDir = join(outputDir, toKebabCase(context.name));
    const domainDir = join(ctxDir, "domain");
    const eventsDir = join(domainDir, "events");
    mkdirSync(eventsDir, { recursive: true });

    for (const aggregate of context.aggregates ?? []) {
      const aggName: string = aggregate.name;
      const root: string = aggregate.root_entity ?? aggName;

      const events: any[] = aggregate.events ?? aggregate.events_produced ?? [];
      const commands: any[] = aggregate.commands ?? aggregate.commands_handled ?? [];
      const eventNames = extractEventNames(events);
      const commandNames = extractCommandNames(commands);

      // Aggregate root
      const invariants: string[] = aggregate.invariants ?? [];
      const invariantComments = invariants
        .map((inv) => `   * - ${inv}`)
        .join("\n");
      const voImports = (aggregate.value_objects ?? [])
        .map((vo: string) => `// import { ${vo} } from './${toKebabCase(vo)}';`)
        .join("\n");
      const evImports = eventNames
        .map((ev) => `// import { ${ev} } from './events/${toKebabCase(ev)}';`)
        .join("\n");

      writeFileSync(
        join(domainDir, `${toKebabCase(aggName)}.ts`),
        `/**
 * ${aggName} Aggregate Root
 * Bounded Context: ${context.name}
 *
 * Invariants:
${invariantComments}
 */

// Value Objects
${voImports}

// Events
${evImports}

export class ${root} {
  // TODO: Implement aggregate root
  // Commands handled: ${commandNames.join(", ")}
  // Events produced: ${eventNames.join(", ")}
}
`,
      );

      // Value objects
      for (const vo of aggregate.value_objects ?? []) {
        writeFileSync(
          join(domainDir, `${toKebabCase(vo)}.ts`),
          `/**
 * ${vo} Value Object
 * Bounded Context: ${context.name}
 */

export class ${vo} {
  // TODO: Implement as immutable value object
  // - Implement equals()
  // - Implement toString()
  // - No identity, defined by attributes only

  constructor() {
    // TODO: Add constructor parameters
  }

  equals(other: ${vo}): boolean {
    throw new Error('Not implemented');
  }

  toString(): string {
    throw new Error('Not implemented');
  }
}
`,
        );
      }

      // Events
      for (const event of events) {
        const eventName: string =
          typeof event === "object" && event !== null ? String(event.name) : String(event);
        const payloadFields: string[] =
          typeof event === "object" && event !== null
            ? event.payload_fields ?? []
            : [];
        const payloadLines = payloadFields
          .map((field) => `  readonly ${field}: unknown; // TODO: type this field`)
          .join("\n");

        writeFileSync(
          join(eventsDir, `${toKebabCase(eventName)}.ts`),
          `/**
 * ${eventName} Domain Event
 * Produced by: ${aggName} aggregate
 * Bounded Context: ${context.name}
 */

export interface ${eventName} {
  readonly type: '${eventName}';
  readonly occurredAt: Date;
${payloadLines}
}
`,
        );
      }

      // Repository interface (always created)
      writeFileSync(
        join(domainDir, `${toKebabCase(root)}-repository.ts`),
        `/**
 * ${root} Repository Interface
 * Bounded Context: ${context.name}
 *
 * This interface is defined in the domain layer.
 * Implementations go in the infrastructure layer.
 */

// import { ${root} } from './${toKebabCase(root)}';

export interface ${root}Repository {
  findById(id: string): Promise<${root} | null>;
  save(aggregate: ${root}): Promise<void>;
}
`,
      );

      // Command handlers + in-memory repo — only when commands exist
      if (commands.length > 0) {
        const appDir = join(ctxDir, "application");
        const infraDir = join(ctxDir, "infrastructure");
        mkdirSync(appDir, { recursive: true });
        mkdirSync(infraDir, { recursive: true });

        for (const cmd of commands) {
          const cmdName: string =
            typeof cmd === "object" && cmd !== null ? String(cmd.name) : String(cmd);
          const featureFiles: string[] =
            typeof cmd === "object" && cmd !== null ? cmd.feature_files ?? [] : [];
          const featureRefs =
            featureFiles.length > 0
              ? featureFiles.map((ff) => ` * - features/${ff}`).join("\n")
              : ` * - (no feature files linked yet)`;

          writeFileSync(
            join(appDir, `${toKebabCase(cmdName)}-handler.ts`),
            `/**
 * ${cmdName} Command Handler
 * Targets: ${aggName} aggregate
 * Bounded Context: ${context.name}
 *
 * Implements behavior from:
${featureRefs}
 */

// import { ${root} } from '../domain/${toKebabCase(aggName)}';
// import { ${root}Repository } from '../domain/${toKebabCase(root)}-repository';

export interface ${cmdName}Command {
  // TODO: Define command fields
}

export class ${cmdName}Handler {
  // constructor(private repository: ${root}Repository) {}

  async handle(command: ${cmdName}Command): Promise<void> {
    // TODO: Implement
    // 1. Load aggregate from repository
    // 2. Execute command on aggregate
    // 3. Save aggregate
    // 4. Publish domain events
    throw new Error('Not implemented');
  }
}
`,
          );
        }

        // In-memory repository
        writeFileSync(
          join(infraDir, `in-memory-${toKebabCase(root)}-repository.ts`),
          `/**
 * In-Memory ${root} Repository
 * For testing purposes only.
 */

// import { ${root} } from '../domain/${toKebabCase(root)}';
// import { ${root}Repository } from '../domain/${toKebabCase(root)}-repository';

export class InMemory${root}Repository /* implements ${root}Repository */ {
  private store: Map<string, any> = new Map();

  async findById(id: string): Promise<any | null> {
    return this.store.get(id) || null;
  }

  async save(aggregate: any): Promise<void> {
    // this.store.set(aggregate.id, aggregate);
    throw new Error('Not implemented');
  }
}
`,
        );
      }
    }
  }
}

export function generatePython(model: any, outputDir: string): void {
  const contexts: any[] = model.bounded_contexts ?? [];

  for (const context of contexts) {
    const ctxDir = join(outputDir, toSnakeCase(context.name));
    const domainDir = join(ctxDir, "domain");
    const eventsDir = join(domainDir, "events");
    const appDir = join(ctxDir, "application");
    const infraDir = join(ctxDir, "infrastructure");

    mkdirSync(eventsDir, { recursive: true });
    mkdirSync(appDir, { recursive: true });
    mkdirSync(infraDir, { recursive: true });

    // __init__.py in all four layers
    writeFileSync(join(ctxDir, "__init__.py"), "");
    writeFileSync(join(domainDir, "__init__.py"), "");
    writeFileSync(join(appDir, "__init__.py"), "");
    writeFileSync(join(infraDir, "__init__.py"), "");

    for (const aggregate of context.aggregates ?? []) {
      const aggName: string = aggregate.name;
      const root: string = aggregate.root_entity ?? aggName;

      const events: any[] = aggregate.events ?? aggregate.events_produced ?? [];
      const commands: any[] = aggregate.commands ?? aggregate.commands_handled ?? [];
      const eventNames = extractEventNames(events);
      const commandNames = extractCommandNames(commands);

      const invariants: string[] = aggregate.invariants ?? [];
      const invariantLines = invariants.map((inv) => `    - ${inv}`).join("\n");

      writeFileSync(
        join(domainDir, `${toSnakeCase(aggName)}.py`),
        `"""
${aggName} Aggregate Root
Bounded Context: ${context.name}

Invariants:
${invariantLines}
"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class ${root}:
    """
    ${aggName} aggregate root.

    Commands handled: ${commandNames.join(", ")}
    Events produced: ${eventNames.join(", ")}
    """
    # TODO: Add fields
    # TODO: Implement command methods
    # TODO: Enforce invariants
    pass
`,
      );

      // Value objects
      for (const vo of aggregate.value_objects ?? []) {
        writeFileSync(
          join(domainDir, `${toSnakeCase(vo)}.py`),
          `"""
${vo} Value Object
Bounded Context: ${context.name}
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class ${vo}:
    """
    Immutable value object. Equality is based on attributes, not identity.
    """
    # TODO: Add fields
    pass
`,
        );
      }

      // Events
      for (const event of events) {
        const eventName: string =
          typeof event === "object" && event !== null ? String(event.name) : String(event);
        const payloadFields: string[] =
          typeof event === "object" && event !== null
            ? event.payload_fields ?? []
            : [];
        const payloadLines = payloadFields
          .map((f) => `    ${f}: object  # TODO: type this field`)
          .join("\n");

        writeFileSync(
          join(eventsDir, `${toSnakeCase(eventName)}.py`),
          `"""
${eventName} Domain Event
Produced by: ${aggName} aggregate
Bounded Context: ${context.name}
"""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ${eventName}:
    occurred_at: datetime
${payloadLines}
`,
        );
      }

      // Command handlers
      for (const cmd of commands) {
        const cmdName: string =
          typeof cmd === "object" && cmd !== null ? String(cmd.name) : String(cmd);
        const featureFiles: string[] =
          typeof cmd === "object" && cmd !== null ? cmd.feature_files ?? [] : [];
        const featureRefs =
          featureFiles.length > 0
            ? featureFiles.map((ff) => `    - features/${ff}`).join("\n")
            : "    - (no feature files linked yet)";

        writeFileSync(
          join(appDir, `${toSnakeCase(cmdName)}_handler.py`),
          `"""
${cmdName} Command Handler
Targets: ${aggName} aggregate
Bounded Context: ${context.name}

Implements behavior from:
${featureRefs}
"""
from dataclasses import dataclass


@dataclass
class ${cmdName}Command:
    """TODO: Define command fields."""
    pass


class ${cmdName}Handler:
    def __init__(self, repository):
        self.repository = repository

    def handle(self, command: ${cmdName}Command):
        """
        TODO: Implement
        1. Load aggregate from repository
        2. Execute command on aggregate
        3. Save aggregate
        4. Publish domain events
        """
        raise NotImplementedError
`,
        );
      }
    }
  }
}

export function printSummary(model: any, outputDir: string): void {
  const contexts: any[] = model.bounded_contexts ?? [];
  const totalAggs = contexts.reduce(
    (sum: number, c: any) => sum + (c.aggregates ?? []).length,
    0,
  );
  process.stdout.write(`Scaffold generated in ${outputDir}\n`);
  process.stdout.write(`  Bounded contexts: ${contexts.length}\n`);
  process.stdout.write(`  Aggregates: ${totalAggs}\n`);
  process.stdout.write(`  Next step: write your first acceptance test!\n`);
}

// ---------------------------------------------------------------------------
// Phase-3 stub — main()
// ---------------------------------------------------------------------------

export function main(): void {
  throw new Error("main: not yet implemented (phase-3)");
}
