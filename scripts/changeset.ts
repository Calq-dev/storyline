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
    case "validate":
      console.error(`Command '${command}' not yet implemented`);
      process.exit(1);
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main();
