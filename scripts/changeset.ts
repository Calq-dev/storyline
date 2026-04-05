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
  key: string;
  index?: string;
}

function parsePathSegments(pathStr: string): PathSegment[] | null {
  const raw = pathStr.split(".");
  const segments: PathSegment[] = [];
  for (const part of raw) {
    const m = part.match(/^([a-z_]+)\[([^\]]+)\]$/);
    if (m) {
      segments.push({ key: m[1], index: m[2] });
    } else if (/^[a-z_]+$/.test(part)) {
      segments.push({ key: part });
    } else {
      return null;
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
      if (!Array.isArray(node[seg.key])) return { found: false, value: undefined };
      const match = node[seg.key].find((item: any) => isDict(item) && item.name === seg.index);
      if (!match) return { found: false, value: undefined };
      node = match;
    } else {
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
// Init command
// ---------------------------------------------------------------------------

function cmdInit(args: { title: string }, cwd: string) {
  const changesetsDir = join(cwd, CHANGESETS_DIR);
  mkdirSync(changesetsDir, { recursive: true });

  const slug = titleToSlug(args.title);
  const dateStr = today();
  const id = `CS-${dateStr}-${slug}`;
  const filename = `${id}.yaml`;
  const filePath = join(changesetsDir, filename);

  if (existsSync(filePath)) {
    console.error(`Error: Changeset ${filename} already exists (slug: '${slug}'). Edit it directly or use a title that produces a different slug.`);
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

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

function validateChangesetSchema(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isDict(data)) {
    errors.push({ field: "<root>", message: "Changeset must be a YAML mapping.", type: "schema" });
    return errors;
  }

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

// ---------------------------------------------------------------------------
// Validate command
// ---------------------------------------------------------------------------

function cmdValidate(args: { json: boolean; id?: string }, cwd: string) {
  const changesetsDir = join(cwd, CHANGESETS_DIR);

  if (!existsSync(changesetsDir)) {
    if (args.json) {
      console.log(JSON.stringify({ valid: false, file: changesetsDir, errors: [{ field: "<root>", message: `No changesets directory found at ${CHANGESETS_DIR}`, type: "schema" }], warnings: [] }, null, 2));
    } else {
      console.error(`No changesets directory found at ${CHANGESETS_DIR}. Run: storyline changeset init --title "..."`);
    }
    process.exit(1);
  }

  let files: string[];
  if (args.id) {
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

    const errors = validateChangesetSchema(data);
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

    // Touches path validation (only when blueprint available and no schema errors)
    if (blueprint && errors.length === 0 && Array.isArray(data.phases)) {
      for (const phase of data.phases) {
        if (!isDict(phase) || !isDict(phase.touches)) continue;
        const pid = phase.id ?? "<unknown>";

        for (const mod of phase.touches.modify ?? []) {
          if (!isDict(mod) || !mod.path) continue;
          const { found } = resolveBlueprintPath(blueprint, mod.path);
          if (!found) {
            errors.push({ phase: pid, field: "touches.modify", message: `Path '${mod.path}' not found in blueprint.`, type: "path_not_found" });
          } else if (mod.action === "append" && Array.isArray(mod.value) && mod.field) {
            const { value: targetNode } = resolveBlueprintPath(blueprint, `${mod.path}.${mod.field}`);
            if (Array.isArray(targetNode)) {
              for (const v of mod.value) {
                if (targetNode.includes(v)) {
                  warnings.push({ phase: pid, field: "touches.modify", message: `Value '${v}' may already exist in '${mod.path}.${mod.field}' — check for duplicates.`, type: "duplicate_append" });
                }
              }
            }
          }
        }

        for (const rem of phase.touches.remove ?? []) {
          if (!isDict(rem) || !rem.path) continue;
          const { found } = resolveBlueprintPath(blueprint, rem.path);
          if (!found) {
            errors.push({ phase: pid, field: "touches.remove", message: `Path '${rem.path}' not found in blueprint.`, type: "path_not_found" });
          }
        }

        const addData = phase.touches.add;
        if (isDict(addData) && Array.isArray(addData.bounded_contexts)) {
          for (const ctx of addData.bounded_contexts) {
            if (!isDict(ctx) || !ctx.name) continue;
            const { found } = resolveBlueprintPath(blueprint, `bounded_contexts[${ctx.name}]`);
            if (found) {
              errors.push({ phase: pid, field: "touches.add", message: `bounded_contexts[${ctx.name}] already exists in blueprint. Use touches.modify instead.`, type: "path_already_exists" });
            }
          }
        }
      }
    }

    const result: ValidationResult = { valid: errors.length === 0, file: filename, errors, warnings };
    results.push(result);
    if (errors.length > 0) anyErrors = true;
  }

  if (args.json) {
    const output = results.length === 1 ? results[0] : results;
    console.log(JSON.stringify(output, null, 2));
  } else {
    for (const result of results) {
      for (const w of result.warnings) {
        const prefix = w.phase ? `[${result.file}] ${w.phase}` : `[${result.file}]`;
        console.warn(`WARNING ${prefix} ${w.field}: ${w.message}`);
      }
      for (const e of result.errors) {
        const prefix = e.phase ? `[${result.file}] ${e.phase}` : `[${result.file}]`;
        console.error(`ERROR ${prefix} ${e.field}: ${e.message}`);
      }
      if (result.errors.length === 0) {
        console.log(`${result.file}: valid${result.warnings.length > 0 ? ` (${result.warnings.length} warning(s))` : ""}`);
      }
    }
  }

  if (anyErrors) process.exit(1);
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`Usage: storyline changeset <command> [options]

Commands:
  init --title "<title>"           Scaffold a new changeset file
  validate [--json] [<id>]         Validate one or all changesets
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  const cwd = process.cwd();

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
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main();
