#!/usr/bin/env node
/**
 * blueprint.ts — BDD Pipeline blueprint management CLI.
 *
 * Port of blueprint.py + three new commands (summary, view, housekeeping).
 *
 * Subcommands:
 *   init --project "Name"        Create a new .storyline/blueprint.yaml
 *   validate [--strict]          Validate the blueprint schema (read-only)
 *   stamp                        Validate then bump meta.updated_at and meta.version
 *   add-context <name>           Add a bounded context
 *   add-aggregate --context X --name Y
 *   add-event --context X --aggregate Y --name Z --payload "fields"
 *   add-command --context X --aggregate Y --name Z --feature-files "files"
 *   add-glossary --term X --context Y --meaning Z
 *   add-gap --description X --severity Y --affects Z
 *   add-question --question X --severity Y --raised-during Z --affects W
 *   summary                      Compact overview of the blueprint
 *   view --context X             Filtered view of a single bounded context
 *   housekeeping [--cleanup] [--phase X]  Validate + stamp + optional cleanup
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { parseDocument, Document, stringify } from "yaml";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLUEPRINT_PATH = ".storyline/blueprint.yaml";
const FEATURES_DIR = ".storyline/features";

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "meta",
  "tech_stack",
  "bounded_contexts",
  "glossary",
  "gaps",
  "questions",
]);

const ALLOWED_SEVERITIES = new Set(["critical", "important", "nice_to_know"]);

const ALLOWED_RELATIONSHIP_TYPES = new Set([
  "shared-kernel",
  "customer-supplier",
  "conformist",
  "anti-corruption-layer",
  "published-language",
  "open-host-service",
  "separate-ways",
]);

const ALLOWED_QUESTION_STATUSES = new Set(["open", "resolved", "deferred"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Dict = Record<string, any>;

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

function loadYaml(path: string): any {
  const content = readFileSync(path, "utf-8");
  const doc = parseDocument(content);
  return doc.toJSON();
}

function loadDocument(path: string) {
  const content = readFileSync(path, "utf-8");
  return parseDocument(content);
}

function saveDocument(path: string, doc: ReturnType<typeof parseDocument>) {
  writeFileSync(path, String(doc), "utf-8");
}

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

function fmtError(pathStr: string, message: string, fix: string): string {
  return `ERROR [schema] ${pathStr}\n  ${message}\n  Fix: ${fix}`;
}

function fmtRefError(pathStr: string, message: string, detail: string, fix: string): string {
  return `ERROR [referential] ${pathStr}\n  ${message}\n  ${detail}\n  Fix: ${fix}`;
}

function fmtFileError(pathStr: string, filename: string, checkedPath: string, fix: string): string {
  return `ERROR [file-not-found] ${pathStr}\n  Feature file '${filename}' not found\n  Path checked: ${checkedPath}\n  Fix: ${fix}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sorted(items: Iterable<string>): string[] {
  return [...items].sort();
}

function isDict(v: any): v is Dict {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Run a git command safely using execFileSync (no shell injection). */
function gitExec(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

function validateSchema(data: any, strict = false): string[] {
  const errors: string[] = [];

  if (!isDict(data)) {
    errors.push(fmtError(
      "<root>",
      "Blueprint must be a YAML mapping at the top level.",
      "Ensure the file is a YAML mapping (key: value pairs).",
    ));
    return errors;
  }

  // Unknown top-level keys
  const unknown = Object.keys(data).filter(k => !ALLOWED_TOP_LEVEL_KEYS.has(k));
  for (const key of sorted(unknown)) {
    errors.push(fmtError(
      key,
      `Unknown top-level key '${key}'.`,
      `Remove '${key}' or move it under an allowed section. Allowed keys: ${JSON.stringify(sorted(ALLOWED_TOP_LEVEL_KEYS))}`,
    ));
  }

  // --- meta ---
  const meta = data.meta;
  if (meta == null) {
    errors.push(fmtError(
      "meta",
      "Missing required section 'meta'.",
      "Add a 'meta' section with at least 'project' and 'created_at'.",
    ));
  } else if (!isDict(meta)) {
    errors.push(fmtError(
      "meta",
      "'meta' must be a mapping.",
      "Replace the 'meta' value with a YAML mapping.",
    ));
  } else {
    if (!("project" in meta) || typeof meta.project !== "string" || !meta.project) {
      errors.push(fmtError(
        "meta.project",
        "'meta.project' must be a non-empty string.",
        "Add 'project: \"Your Project Name\"' inside the meta section.",
      ));
    }
    if (!("created_at" in meta) || typeof meta.created_at !== "string" || !meta.created_at) {
      errors.push(fmtError(
        "meta.created_at",
        "'meta.created_at' must be a non-empty string.",
        "Add 'created_at: \"YYYY-MM-DD\"' inside the meta section.",
      ));
    } else {
      if (!/^\d{4}-\d{2}-\d{2}/.test(meta.created_at)) {
        errors.push(fmtError(
          "meta.created_at",
          `'meta.created_at' value '${meta.created_at}' is not a valid date. Expected YYYY-MM-DD or ISO 8601 format.`,
          "Use format: '2026-04-04' or '2026-04-04T14:30:00Z'.",
        ));
      }
    }
  }

  // --- strict-mode ---
  if (strict) {
    const requiredSections = ["tech_stack", "bounded_contexts", "glossary", "gaps", "questions"];
    for (const section of requiredSections) {
      if (!(section in data)) {
        errors.push(fmtError(
          section,
          `Missing required section '${section}' (strict mode).`,
          `Add an empty '${section}:' section.`,
        ));
      }
    }
    const bc = data.bounded_contexts;
    if (bc != null && (!Array.isArray(bc) || bc.length === 0)) {
      errors.push(fmtError(
        "bounded_contexts",
        "'bounded_contexts' must be a non-empty list in strict mode.",
        "Add at least one bounded context.",
      ));
    }
  }

  // --- bounded_contexts ---
  const bc = data.bounded_contexts;
  if (bc != null) {
    if (!Array.isArray(bc)) {
      errors.push(fmtError(
        "bounded_contexts",
        "'bounded_contexts' must be a list.",
        "Change 'bounded_contexts' to a YAML sequence.",
      ));
    } else {
      for (let i = 0; i < bc.length; i++) {
        const ctx = bc[i];
        const prefix = `bounded_contexts[${i}]`;
        if (!isDict(ctx)) {
          errors.push(fmtError(prefix, "Each bounded context must be a mapping.", "Use a YAML mapping."));
          continue;
        }
        if (!("name" in ctx) || !ctx.name) {
          errors.push(fmtError(
            `${prefix}.name`,
            "Bounded context must have a 'name'.",
            "Add 'name: ...' to this bounded context.",
          ));
        }
        // aggregates
        const aggregates = ctx.aggregates || [];
        for (let j = 0; j < (aggregates?.length ?? 0); j++) {
          const agg = aggregates[j];
          const aprefix = `${prefix}.aggregates[${j}]`;
          if (!isDict(agg) || !("name" in agg) || !agg.name) {
            errors.push(fmtError(
              `${aprefix}.name`,
              "Aggregate must have a 'name'.",
              "Add 'name: ...' to this aggregate.",
            ));
          } else {
            // commands
            const commands = agg.commands || [];
            for (let k = 0; k < (commands?.length ?? 0); k++) {
              const cmd = commands[k];
              const cprefix = `${aprefix}.commands[${k}]`;
              if (!isDict(cmd)) {
                errors.push(fmtError(cprefix, "Command must be a mapping.", "Use a YAML mapping."));
                continue;
              }
              if (!("name" in cmd) || !cmd.name) {
                errors.push(fmtError(`${cprefix}.name`, "Command must have a 'name'.", "Add 'name: ...'"));
              }
              if (!("feature_files" in cmd)) {
                errors.push(fmtError(`${cprefix}.feature_files`, "Command must have a 'feature_files' field.", "Add 'feature_files: []' to this command."));
              }
            }
            // events
            const events = agg.events || [];
            for (let k = 0; k < (events?.length ?? 0); k++) {
              const evt = events[k];
              const eprefix = `${aprefix}.events[${k}]`;
              if (!isDict(evt)) {
                errors.push(fmtError(eprefix, "Event must be a mapping.", "Use a YAML mapping."));
                continue;
              }
              if (!("name" in evt) || !evt.name) {
                errors.push(fmtError(`${eprefix}.name`, "Event must have a 'name'.", "Add 'name: ...'"));
              }
              if (!("payload_fields" in evt)) {
                errors.push(fmtError(`${eprefix}.payload_fields`, "Event must have a 'payload_fields' field.", "Add 'payload_fields: []' to this event."));
              }
            }
          }
        }

        // policies (at context level)
        const policies = ctx.policies || [];
        for (let k = 0; k < (policies?.length ?? 0); k++) {
          const pol = policies[k];
          const pprefix = `${prefix}.policies[${k}]`;
          if (!isDict(pol)) {
            errors.push(fmtError(pprefix, "Policy must be a mapping.", "Use a YAML mapping."));
            continue;
          }
          for (const field of ["name", "triggered_by", "issues_command"]) {
            if (!(field in pol) || !pol[field]) {
              errors.push(fmtError(`${pprefix}.${field}`, `Policy must have '${field}'.`, `Add '${field}: ...' to this policy.`));
            }
          }
        }

        // relationships
        const relationships = ctx.relationships || [];
        for (let j = 0; j < (relationships?.length ?? 0); j++) {
          const rel = relationships[j];
          const rprefix = `${prefix}.relationships[${j}]`;
          if (!isDict(rel)) {
            errors.push(fmtError(rprefix, "Relationship must be a mapping.", "Use a YAML mapping."));
            continue;
          }
          if (!("type" in rel) || !ALLOWED_RELATIONSHIP_TYPES.has(rel.type)) {
            errors.push(fmtError(
              `${rprefix}.type`,
              `Relationship 'type' must be one of ${JSON.stringify(sorted(ALLOWED_RELATIONSHIP_TYPES))}.`,
              "Set 'type' to one of the allowed relationship types.",
            ));
          }
          if (!("target" in rel) || !rel.target) {
            errors.push(fmtError(`${rprefix}.target`, "Relationship must have a 'target'.", "Add 'target: ...'"));
          }
        }
      }
    }
  }

  // --- gaps ---
  const gaps = data.gaps;
  if (gaps != null) {
    if (!Array.isArray(gaps)) {
      errors.push(fmtError("gaps", "'gaps' must be a list.", "Change to a YAML sequence."));
    } else {
      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        const gprefix = `gaps[${i}]`;
        if (!isDict(gap)) {
          errors.push(fmtError(gprefix, "Gap must be a mapping.", "Use a YAML mapping."));
          continue;
        }
        for (const field of ["id", "description"]) {
          if (!(field in gap) || !gap[field]) {
            errors.push(fmtError(`${gprefix}.${field}`, `Gap must have '${field}'.`, `Add '${field}: ...'`));
          }
        }
        const sev = gap.severity;
        if (!ALLOWED_SEVERITIES.has(sev)) {
          errors.push(fmtError(
            `${gprefix}.severity`,
            `Gap severity must be one of ${JSON.stringify(sorted(ALLOWED_SEVERITIES))}, got '${sev}'.`,
            "Set 'severity' to 'critical', 'important', or 'nice_to_know'.",
          ));
        }
        if (!("affects" in gap) || !Array.isArray(gap.affects)) {
          errors.push(fmtError(`${gprefix}.affects`, "Gap must have 'affects' as a list.", "Add 'affects: []'"));
        }
      }
    }
  }

  // --- questions ---
  const questions = data.questions;
  if (questions != null) {
    if (!Array.isArray(questions)) {
      errors.push(fmtError("questions", "'questions' must be a list.", "Change to a YAML sequence."));
    } else {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qprefix = `questions[${i}]`;
        if (!isDict(q)) {
          errors.push(fmtError(qprefix, "Question must be a mapping.", "Use a YAML mapping."));
          continue;
        }
        for (const field of ["id", "question"]) {
          if (!(field in q) || !q[field]) {
            errors.push(fmtError(`${qprefix}.${field}`, `Question must have '${field}'.`, `Add '${field}: ...'`));
          }
        }
        const sev = q.severity;
        if (!ALLOWED_SEVERITIES.has(sev)) {
          errors.push(fmtError(
            `${qprefix}.severity`,
            `Question severity must be one of ${JSON.stringify(sorted(ALLOWED_SEVERITIES))}, got '${sev}'.`,
            "Set 'severity' to 'critical', 'important', or 'nice_to_know'.",
          ));
        }
        if (!("affects" in q) || !Array.isArray(q.affects)) {
          errors.push(fmtError(`${qprefix}.affects`, "Question must have 'affects' as a list.", "Add 'affects: []'"));
        }
        const status = q.status;
        if (status != null && !ALLOWED_QUESTION_STATUSES.has(status)) {
          errors.push(fmtError(
            `${qprefix}.status`,
            `Question status must be one of ${JSON.stringify(sorted(ALLOWED_QUESTION_STATUSES))}, got '${status}'.`,
            "Set 'status' to 'open', 'resolved', or 'deferred'.",
          ));
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Referential integrity
// ---------------------------------------------------------------------------

function validateReferentialIntegrity(data: any, cwd: string): string[] {
  const errors: string[] = [];

  if (!isDict(data)) return errors;

  // Build lookup structures
  const contextNames = new Set<string>();
  const contextEvents: Record<string, Set<string>> = {};
  const allEvents: Record<string, string[]> = {};
  const allCommands = new Set<string>();

  let bcs = data.bounded_contexts || [];
  if (!Array.isArray(bcs)) bcs = [];

  for (const ctx of bcs) {
    if (!isDict(ctx)) continue;
    const ctxName = ctx.name;
    if (!ctxName) continue;
    contextNames.add(ctxName);
    const ctxEventNames = new Set<string>();
    for (const agg of ctx.aggregates || []) {
      if (!isDict(agg)) continue;
      for (const evt of agg.events || []) {
        if (isDict(evt) && evt.name) {
          ctxEventNames.add(evt.name);
          if (!allEvents[evt.name]) allEvents[evt.name] = [];
          allEvents[evt.name].push(ctxName);
        }
      }
      for (const cmd of agg.commands || []) {
        if (isDict(cmd) && cmd.name) {
          allCommands.add(cmd.name);
        }
      }
    }
    contextEvents[ctxName] = ctxEventNames;
  }

  // Check 9: duplicate event names across all aggregates
  for (const [evtName, ctxList] of Object.entries(allEvents)) {
    if (ctxList.length > 1) {
      const uniqueContexts = sorted(new Set(ctxList));
      let msg: string;
      if (uniqueContexts.length > 1) {
        msg = `Event '${evtName}' is defined in multiple contexts: ${JSON.stringify(uniqueContexts)}.`;
      } else {
        msg = `Event '${evtName}' is defined ${ctxList.length} times in context '${uniqueContexts[0]}'.`;
      }
      errors.push(fmtRefError(
        `bounded_contexts[events].${evtName}`,
        msg,
        "Event names must be unique across all aggregates.",
        "Rename the event to make it unique, or merge the definitions.",
      ));
    }
  }

  // Per-context checks
  for (let i = 0; i < bcs.length; i++) {
    const ctx = bcs[i];
    if (!isDict(ctx)) continue;
    const ctxName = ctx.name || `[${i}]`;
    const ctxPrefix = `bounded_contexts[${ctxName}]`;

    // Check 1: feature files exist on disk
    for (const agg of ctx.aggregates || []) {
      if (!isDict(agg)) continue;
      const aggName = agg.name || "?";
      const aggPrefix = `${ctxPrefix}.aggregates[${aggName}]`;
      const commands = agg.commands || [];
      for (let k = 0; k < commands.length; k++) {
        const cmd = commands[k];
        if (!isDict(cmd)) continue;
        const cmdName = cmd.name || `[${k}]`;
        const cmdPrefix = `${aggPrefix}.commands[${cmdName}]`;
        for (const ff of cmd.feature_files || []) {
          if (typeof ff !== "string" || !ff) continue;
          const featurePath = join(cwd, FEATURES_DIR, ff);
          if (!existsSync(featurePath)) {
            errors.push(fmtFileError(
              `${cmdPrefix}.feature_files`,
              ff,
              `${FEATURES_DIR}/${ff}`,
              "create the feature file or update the reference",
            ));
          }
        }
      }
    }

    // Check 2 & 3: policies
    const ctxEvtSet = contextEvents[ctxName] || new Set<string>();
    for (const pol of ctx.policies || []) {
      if (!isDict(pol)) continue;
      const polName = pol.name || "?";
      const polPrefix = `${ctxPrefix}.policies[${polName}]`;

      const triggeredBy = pol.triggered_by;
      if (triggeredBy && !ctxEvtSet.has(triggeredBy)) {
        errors.push(fmtRefError(
          `${polPrefix}.triggered_by`,
          `Event '${triggeredBy}' not found in context '${ctxName}'.`,
          `Expected one of: ${JSON.stringify(sorted(ctxEvtSet))}`,
          "rename to a valid event, or add the event to an aggregate",
        ));
      }

      const issuesCommand = pol.issues_command;
      if (issuesCommand && !allCommands.has(issuesCommand)) {
        errors.push(fmtRefError(
          `${polPrefix}.issues_command`,
          `Command '${issuesCommand}' not found in any bounded context.`,
          `Expected one of: ${JSON.stringify(sorted(allCommands))}`,
          "rename to a valid command, or add the command to an aggregate",
        ));
      }
    }

    // Check 4: relationship targets
    const relationships = ctx.relationships || [];
    for (let j = 0; j < relationships.length; j++) {
      const rel = relationships[j];
      if (!isDict(rel)) continue;
      const target = rel.target;
      if (target && !contextNames.has(target)) {
        errors.push(fmtRefError(
          `${ctxPrefix}.relationships[${j}].target`,
          `Relationship target '${target}' is not a known bounded context.`,
          `Known contexts: ${JSON.stringify(sorted(contextNames))}`,
          "rename the target to match an existing bounded context name",
        ));
      }
    }

    // Check 7: read_models built_from events
    for (const rm of ctx.read_models || []) {
      if (!isDict(rm)) continue;
      const rmName = rm.name || "?";
      const rmPrefix = `${ctxPrefix}.read_models[${rmName}]`;
      for (const evtName of rm.built_from || []) {
        if (typeof evtName !== "string") continue;
        if (!(evtName in allEvents)) {
          errors.push(fmtRefError(
            `${rmPrefix}.built_from`,
            `Event '${evtName}' not found in any bounded context.`,
            `Known events: ${JSON.stringify(sorted(Object.keys(allEvents)))}`,
            "rename to a valid event name, or add the event to an aggregate",
          ));
        }
      }
    }
  }

  // Check 5: gaps affects
  const gapsList = data.gaps || [];
  for (let i = 0; i < gapsList.length; i++) {
    const gap = gapsList[i];
    if (!isDict(gap)) continue;
    const gapId = gap.id || `[${i}]`;
    for (const ctxRef of gap.affects || []) {
      if (typeof ctxRef === "string" && !contextNames.has(ctxRef)) {
        errors.push(fmtRefError(
          `gaps[${gapId}].affects`,
          `Context '${ctxRef}' referenced in gap affects is not a known bounded context.`,
          `Known contexts: ${JSON.stringify(sorted(contextNames))}`,
          "rename to a valid bounded context name, or add the context",
        ));
      }
    }
  }

  // Check 6: questions affects
  const questionsList = data.questions || [];
  for (let i = 0; i < questionsList.length; i++) {
    const q = questionsList[i];
    if (!isDict(q)) continue;
    const qId = q.id || `[${i}]`;
    for (const ctxRef of q.affects || []) {
      if (typeof ctxRef === "string" && !contextNames.has(ctxRef)) {
        errors.push(fmtRefError(
          `questions[${qId}].affects`,
          `Context '${ctxRef}' referenced in question affects is not a known bounded context.`,
          `Known contexts: ${JSON.stringify(sorted(contextNames))}`,
          "rename to a valid bounded context name, or add the context",
        ));
      }
    }
  }

  // Check 8: glossary definitions context references
  const glossary = data.glossary || {};
  if (isDict(glossary)) {
    for (const [term, entry] of Object.entries(glossary)) {
      if (!isDict(entry)) continue;
      for (const defn of entry.definitions || []) {
        if (!isDict(defn)) continue;
        const ctxRef = defn.context;
        if (ctxRef && ctxRef !== "Shared Kernel" && !contextNames.has(ctxRef)) {
          errors.push(fmtRefError(
            `glossary[${term}].definitions.context`,
            `Context '${ctxRef}' in glossary definition is not a known bounded context.`,
            `Known contexts: ${JSON.stringify(sorted(contextNames))} (or 'Shared Kernel')`,
            "rename to a valid bounded context name, or use 'Shared Kernel'",
          ));
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Blueprint helpers
// ---------------------------------------------------------------------------

function findContext(data: any, name: string): Dict | null {
  for (const ctx of data.bounded_contexts || []) {
    if (isDict(ctx) && ctx.name === name) return ctx;
  }
  return null;
}

function findAggregate(ctx: Dict, name: string): Dict | null {
  for (const agg of ctx.aggregates || []) {
    if (isDict(agg) && agg.name === name) return agg;
  }
  return null;
}

function requireBlueprint(cwd: string): [string, any] {
  const bp = join(cwd, BLUEPRINT_PATH);
  if (!existsSync(bp)) {
    console.error(`Blueprint not found at ${BLUEPRINT_PATH}`);
    process.exit(1);
  }
  return [bp, loadYaml(bp)];
}

const PREFIX_SECTION: Record<string, string> = { GAP: "gaps", Q: "questions" };

function nextId(data: any, prefix: string): string {
  const section = PREFIX_SECTION[prefix];
  if (!section) throw new Error(`Unknown ID prefix '${prefix}'`);
  const existing: number[] = [];
  for (const item of data[section] || []) {
    const idVal = item?.id ?? "";
    if (typeof idVal === "string" && idVal.startsWith(`${prefix}-`)) {
      const num = parseInt(idVal.split("-")[1], 10);
      if (!isNaN(num)) existing.push(num);
    }
  }
  const next = (existing.length > 0 ? Math.max(...existing) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Document-level helpers for add-* commands (round-trip safe)
// ---------------------------------------------------------------------------

function findDocNode(doc: ReturnType<typeof parseDocument>, path: (string | number)[]): any {
  let node: any = doc.contents;
  for (const key of path) {
    if (node == null) return null;
    if (typeof key === "string") {
      node = node.get(key, true);
    } else {
      // numeric index into a seq
      if (node.items) {
        node = node.items[key];
      } else {
        return null;
      }
    }
  }
  return node;
}

function findDocContextIndex(doc: ReturnType<typeof parseDocument>, name: string): number {
  const bcs = findDocNode(doc, ["bounded_contexts"]);
  if (!bcs || !bcs.items) return -1;
  for (let i = 0; i < bcs.items.length; i++) {
    const item = bcs.items[i];
    const nameNode = item.get ? item.get("name") : null;
    if (nameNode === name) return i;
  }
  return -1;
}

function findDocAggregateIndex(doc: ReturnType<typeof parseDocument>, ctxIndex: number, name: string): number {
  const aggs = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates"]);
  if (!aggs || !aggs.items) return -1;
  for (let i = 0; i < aggs.items.length; i++) {
    const item = aggs.items[i];
    const nameNode = item.get ? item.get("name") : null;
    if (nameNode === name) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmdInit(args: { project: string }, cwd: string) {
  const bp = join(cwd, BLUEPRINT_PATH);

  if (existsSync(bp)) {
    console.error(`Error: blueprint already exists at ${BLUEPRINT_PATH}`);
    process.exit(1);
  }

  const dir = join(cwd, ".storyline");
  mkdirSync(dir, { recursive: true });
  for (const subdir of ["features", "workbench", "plans", "backlog"]) {
    mkdirSync(join(dir, subdir), { recursive: true });
  }

  const todayStr = today();

  const doc = new Document({
    meta: {
      project: args.project,
      created_at: todayStr,
      updated_at: todayStr,
      version: 1,
    },
    tech_stack: {},
    bounded_contexts: [],
    glossary: {},
    gaps: [],
    questions: [],
  });

  writeFileSync(bp, String(doc), "utf-8");
  console.log(`Initialised blueprint at ${BLUEPRINT_PATH}`);
}

function cmdValidate(args: { strict: boolean }, cwd: string) {
  const bp = join(cwd, BLUEPRINT_PATH);

  if (!existsSync(bp)) {
    console.error(`ERROR [schema] <root>\n  Blueprint not found at ${BLUEPRINT_PATH}\n  Fix: Run 'blueprint.py init --project ...' first.`);
    process.exit(1);
  }

  const data = loadYaml(bp);
  let errors = validateSchema(data, args.strict);

  if (errors.length === 0) {
    errors = errors.concat(validateReferentialIntegrity(data, cwd));
  }

  if (errors.length > 0) {
    for (const err of errors) console.error(err);
    const schemaCount = errors.filter(e => e.includes("[schema]")).length;
    const refCount = errors.filter(e => e.includes("[referential]")).length;
    const fileCount = errors.filter(e => e.includes("[file-not-found]")).length;
    const parts: string[] = [];
    if (schemaCount) parts.push(`${schemaCount} schema`);
    if (refCount) parts.push(`${refCount} referential`);
    if (fileCount) parts.push(`${fileCount} file-not-found`);
    console.error(`\n${errors.length} errors (${parts.join(", ")}). Blueprint NOT stamped.`);
    process.exit(1);
  }

  console.log("Blueprint is valid.");
}

function cmdStamp(_args: unknown, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);
  let errors = validateSchema(data);
  if (errors.length === 0) {
    errors = errors.concat(validateReferentialIntegrity(data, cwd));
  }

  if (errors.length > 0) {
    for (const err of errors) console.error(err);
    process.exit(1);
  }

  // Round-trip safe: load document, update, save
  const doc = loadDocument(bp);
  const meta = findDocNode(doc, ["meta"]);
  const todayStr = today();
  meta.set("updated_at", todayStr);
  const version = (parseInt(String(meta.get("version") ?? "0"), 10) || 0) + 1;
  meta.set("version", version);

  saveDocument(bp, doc);
  console.log(`Stamped blueprint: version=${version}, updated_at=${todayStr}`);
}

function cmdAddContext(args: { name: string }, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);
  if (findContext(data, args.name) !== null) {
    console.error(`Error: bounded context '${args.name}' already exists.`);
    process.exit(1);
  }

  const doc = loadDocument(bp);
  let bcs = findDocNode(doc, ["bounded_contexts"]);
  if (!bcs) {
    (doc.contents as any).set("bounded_contexts", doc.createNode([]));
    bcs = findDocNode(doc, ["bounded_contexts"]);
  }

  const ctx = doc.createNode({
    name: args.name,
    description: "",
    aggregates: [],
    policies: [],
    read_models: [],
    external_systems: [],
    domain_services: [],
    relationships: [],
  });
  bcs.add(ctx);

  saveDocument(bp, doc);
  console.log(`Added bounded context '${args.name}'.`);
}

function cmdAddAggregate(args: { context: string; name: string }, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);
  const ctx = findContext(data, args.context);
  if (ctx === null) {
    console.error(`Error: bounded context '${args.context}' not found.`);
    process.exit(1);
  }
  if (findAggregate(ctx, args.name) !== null) {
    console.error(`Error: aggregate '${args.name}' already exists in context '${args.context}'.`);
    process.exit(1);
  }

  const doc = loadDocument(bp);
  const ctxIndex = findDocContextIndex(doc, args.context);
  let aggs = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates"]);
  if (!aggs) {
    const ctxNode = findDocNode(doc, ["bounded_contexts", ctxIndex]);
    ctxNode.set("aggregates", doc.createNode([]));
    aggs = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates"]);
  }

  const agg = doc.createNode({
    name: args.name,
    root_entity: args.name,
    entities: [],
    value_objects: [],
    commands: [],
    events: [],
    invariants: [],
  });
  aggs.add(agg);

  saveDocument(bp, doc);
  console.log(`Added aggregate '${args.name}' to context '${args.context}'.`);
}

function cmdAddEvent(args: { context: string; aggregate: string; name: string; payload: string }, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);
  const ctx = findContext(data, args.context);
  if (ctx === null) {
    console.error(`Error: bounded context '${args.context}' not found.`);
    process.exit(1);
  }
  const agg = findAggregate(ctx, args.aggregate);
  if (agg === null) {
    console.error(`Error: aggregate '${args.aggregate}' not found in context '${args.context}'.`);
    process.exit(1);
  }

  const payloadFields = args.payload ? args.payload.split(",").map(f => f.trim()).filter(Boolean) : [];

  const doc = loadDocument(bp);
  const ctxIndex = findDocContextIndex(doc, args.context);
  const aggIndex = findDocAggregateIndex(doc, ctxIndex, args.aggregate);
  let evts = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates", aggIndex, "events"]);
  if (!evts) {
    const aggNode = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates", aggIndex]);
    aggNode.set("events", doc.createNode([]));
    evts = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates", aggIndex, "events"]);
  }

  const evt = doc.createNode({
    name: args.name,
    payload_fields: payloadFields,
  });
  evts.add(evt);

  saveDocument(bp, doc);
  console.log(`Added event '${args.name}' to aggregate '${args.aggregate}' in context '${args.context}'.`);
}

function cmdAddCommand(args: { context: string; aggregate: string; name: string; featureFiles: string }, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);
  const ctx = findContext(data, args.context);
  if (ctx === null) {
    console.error(`Error: bounded context '${args.context}' not found.`);
    process.exit(1);
  }
  const agg = findAggregate(ctx, args.aggregate);
  if (agg === null) {
    console.error(`Error: aggregate '${args.aggregate}' not found in context '${args.context}'.`);
    process.exit(1);
  }

  const featureFiles = args.featureFiles ? args.featureFiles.split(",").map(f => f.trim()).filter(Boolean) : [];

  const doc = loadDocument(bp);
  const ctxIndex = findDocContextIndex(doc, args.context);
  const aggIndex = findDocAggregateIndex(doc, ctxIndex, args.aggregate);
  let cmds = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates", aggIndex, "commands"]);
  if (!cmds) {
    const aggNode = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates", aggIndex]);
    aggNode.set("commands", doc.createNode([]));
    cmds = findDocNode(doc, ["bounded_contexts", ctxIndex, "aggregates", aggIndex, "commands"]);
  }

  const cmd = doc.createNode({
    name: args.name,
    feature_files: featureFiles,
  });
  cmds.add(cmd);

  saveDocument(bp, doc);
  console.log(`Added command '${args.name}' to aggregate '${args.aggregate}' in context '${args.context}'.`);
}

function cmdAddGlossary(args: { term: string; context: string; meaning: string }, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);

  // Check for duplicate context definition
  const glossary = data.glossary || {};
  const termEntry = glossary[args.term];
  if (termEntry) {
    for (const defn of termEntry.definitions || []) {
      if (isDict(defn) && defn.context === args.context) {
        console.error(`Error: glossary term '${args.term}' already has a definition for context '${args.context}'.`);
        process.exit(1);
      }
    }
  }

  const doc = loadDocument(bp);
  let glossaryNode = findDocNode(doc, ["glossary"]);
  if (!glossaryNode) {
    (doc.contents as any).set("glossary", doc.createNode({}));
    glossaryNode = findDocNode(doc, ["glossary"]);
  }

  let termNode = glossaryNode.get(args.term, true);
  if (!termNode) {
    glossaryNode.set(args.term, doc.createNode({ definitions: [] }));
    termNode = glossaryNode.get(args.term, true);
  }

  let defsNode = termNode.get("definitions", true);
  if (!defsNode) {
    termNode.set("definitions", doc.createNode([]));
    defsNode = termNode.get("definitions", true);
  }

  const defn = doc.createNode({
    context: args.context,
    meaning: args.meaning,
  });
  defsNode.add(defn);

  saveDocument(bp, doc);
  console.log(`Added glossary term '${args.term}' for context '${args.context}'.`);
}

function cmdAddGap(args: { description: string; severity: string; affects: string }, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);
  const gapId = nextId(data, "GAP");
  const affects = args.affects ? args.affects.split(",").map(a => a.trim()).filter(Boolean) : [];

  const doc = loadDocument(bp);
  let gapsNode = findDocNode(doc, ["gaps"]);
  if (!gapsNode) {
    (doc.contents as any).set("gaps", doc.createNode([]));
    gapsNode = findDocNode(doc, ["gaps"]);
  }

  const gap = doc.createNode({
    id: gapId,
    description: args.description,
    severity: args.severity,
    affects,
  });
  gapsNode.add(gap);

  saveDocument(bp, doc);
  console.log(`Added gap '${gapId}'.`);
}

function cmdAddQuestion(args: { question: string; severity: string; raisedDuring: string; affects: string }, cwd: string) {
  const [bp, data] = requireBlueprint(cwd);
  const qId = nextId(data, "Q");
  const affects = args.affects ? args.affects.split(",").map(a => a.trim()).filter(Boolean) : [];

  const doc = loadDocument(bp);
  let questionsNode = findDocNode(doc, ["questions"]);
  if (!questionsNode) {
    (doc.contents as any).set("questions", doc.createNode([]));
    questionsNode = findDocNode(doc, ["questions"]);
  }

  const q = doc.createNode({
    id: qId,
    question: args.question,
    severity: args.severity,
    raised_during: args.raisedDuring,
    affects,
    status: "open",
  });
  questionsNode.add(q);

  saveDocument(bp, doc);
  console.log(`Added question '${qId}'.`);
}

// ---------------------------------------------------------------------------
// New command: summary
// ---------------------------------------------------------------------------

function cmdSummary(_args: unknown, cwd: string) {
  const [_bp, data] = requireBlueprint(cwd);

  const lines: string[] = [];

  // Meta
  const meta = data.meta || {};
  lines.push("# Blueprint Summary");
  lines.push("");
  lines.push(`project: ${meta.project || "(unknown)"}`);
  lines.push(`version: ${meta.version ?? "?"}`);
  lines.push(`updated_at: ${meta.updated_at || "?"}`);
  lines.push(`created_at: ${meta.created_at || "?"}`);
  lines.push("");

  // Tech stack
  const ts = data.tech_stack;
  if (ts && isDict(ts) && Object.keys(ts).length > 0) {
    lines.push("## Tech Stack");
    for (const [key, val] of Object.entries(ts)) {
      if (Array.isArray(val)) {
        lines.push(`  ${key}: ${val.join(", ")}`);
      } else {
        lines.push(`  ${key}: ${val}`);
      }
    }
    lines.push("");
  }

  // Bounded contexts
  const bcs = data.bounded_contexts || [];
  if (bcs.length > 0) {
    lines.push(`## Bounded Contexts (${bcs.length})`);
    lines.push("");
    for (const ctx of bcs) {
      if (!isDict(ctx)) continue;
      const desc = ctx.description || "";
      const firstSentence = desc.split(/[.!?]\s/)[0] || desc;
      const descLine = firstSentence ? ` — ${firstSentence.replace(/[.!?]$/, "")}` : "";
      lines.push(`  ${ctx.name}${descLine}`);

      // Aggregates
      const aggs = ctx.aggregates || [];
      for (const agg of aggs) {
        if (!isDict(agg)) continue;
        const cmdCount = (agg.commands || []).length;
        const evtCount = (agg.events || []).length;
        lines.push(`    ${agg.name} (${cmdCount} cmd, ${evtCount} evt)`);
      }

      // Relationships
      const rels = ctx.relationships || [];
      if (rels.length > 0) {
        const relDescs = rels
          .filter((r: any) => isDict(r))
          .map((r: any) => `${r.type} -> ${r.target}`)
          .join(", ");
        lines.push(`    relationships: ${relDescs}`);
      }
      lines.push("");
    }
  }

  // Glossary terms
  const glossary = data.glossary || {};
  if (isDict(glossary) && Object.keys(glossary).length > 0) {
    const terms = sorted(Object.keys(glossary));
    lines.push(`## Glossary (${terms.length} terms)`);
    lines.push(`  ${terms.join(", ")}`);
    lines.push("");
  }

  // Context views — dynamic, based on actual contexts in this blueprint
  if (bcs.length > 0) {
    lines.push("## Context Views");
    lines.push("  # Run these to get full detail for a specific context:");
    for (const ctx of bcs) {
      if (isDict(ctx) && ctx.name) {
        lines.push(`  storyline view --context "${ctx.name}"`);
      }
    }
    lines.push("");
  }

  // Available CLI commands — static reference for agents
  lines.push("## Available CLI Commands");
  lines.push("");
  lines.push("  ### Read (no side effects)");
  lines.push('  storyline summary                                          # this output');
  lines.push('  storyline view --context "<name>"                         # full detail for one context');
  lines.push('  storyline validate [--strict]                             # schema + referential integrity');
  lines.push("");
  lines.push("  ### Mutate (trigger PostToolUse validation)");
  lines.push('  storyline add-context "<name>"');
  lines.push('  storyline add-aggregate --context "<name>" --name "<name>"');
  lines.push('  storyline add-event --context "<ctx>" --aggregate "<agg>" --name "<name>" --payload "field1,field2"');
  lines.push('  storyline add-command --context "<ctx>" --aggregate "<agg>" --name "<name>" --feature-files "file.feature"');
  lines.push('  storyline add-glossary --term "<term>" --context "<name>" --meaning "<meaning>"');
  lines.push('  storyline add-gap --description "<desc>" --severity "critical|important|nice_to_know" --affects "<name>"');
  lines.push('  storyline add-question --question "<q>" --severity "critical|important|nice_to_know" --raised-during "<phase>" --affects "<name>"');
  lines.push('  storyline stamp                                            # bump version + updated_at');
  lines.push('  storyline housekeeping [--cleanup [--phase <name>]]       # validate + stamp + optional cleanup');

  console.log(lines.join("\n"));
}

// ---------------------------------------------------------------------------
// New command: view
// ---------------------------------------------------------------------------

function cmdView(args: { context: string }, cwd: string) {
  const [_bp, data] = requireBlueprint(cwd);

  const ctx = findContext(data, args.context);
  if (ctx === null) {
    const names = (data.bounded_contexts || [])
      .filter((c: any) => isDict(c) && c.name)
      .map((c: any) => c.name);
    console.error(`Error: bounded context '${args.context}' not found.`);
    console.error(`Available contexts: ${names.join(", ")}`);
    process.exit(1);
  }

  // Output the full context as YAML
  console.log(`# Bounded Context: ${ctx.name}`);
  console.log("");
  console.log(stringify(ctx, { lineWidth: 120 }).trimEnd());
  console.log("");

  // Relevant glossary terms
  const glossary = data.glossary || {};
  if (isDict(glossary)) {
    const relevantTerms: Array<{ term: string; defn: Dict }> = [];
    for (const [term, entry] of Object.entries(glossary)) {
      if (!isDict(entry)) continue;
      for (const defn of entry.definitions || []) {
        if (isDict(defn) && (defn.context === args.context || defn.context === "Shared Kernel")) {
          relevantTerms.push({ term, defn });
        }
      }
    }
    if (relevantTerms.length > 0) {
      console.log("# Relevant Glossary Terms");
      console.log("");
      for (const { term, defn } of relevantTerms) {
        console.log(`  ${term} (${defn.context}): ${defn.meaning}`);
      }
      console.log("");
    }
  }

  // Relationship targets
  const rels = ctx.relationships || [];
  const targets = rels.filter((r: any) => isDict(r) && r.target).map((r: any) => r.target);
  if (targets.length > 0) {
    console.log("# Relationship Targets");
    console.log(`  ${targets.join(", ")}`);
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// New command: housekeeping
// ---------------------------------------------------------------------------

function cmdHousekeeping(args: { cleanup: boolean; phase?: string }, cwd: string) {
  const bp = join(cwd, BLUEPRINT_PATH);

  if (!existsSync(bp)) {
    console.error(`Blueprint not found at ${BLUEPRINT_PATH}`);
    process.exit(1);
  }

  // Check if already up to date
  const data = loadYaml(bp);
  const todayStr = today();
  const isUpToDate = data?.meta?.updated_at === todayStr;
  let blueprintHasGitChanges = false;

  const gitDiffOutput = gitExec(["diff", "--name-only", "--", BLUEPRINT_PATH], cwd);
  const gitStagedOutput = gitExec(["diff", "--staged", "--name-only", "--", BLUEPRINT_PATH], cwd);
  blueprintHasGitChanges = gitDiffOutput.length > 0 || gitStagedOutput.length > 0;

  if (isUpToDate && !blueprintHasGitChanges) {
    console.log("Blueprint is already up to date.");
  } else {
    // Validate
    let errors = validateSchema(data);
    if (errors.length === 0) {
      errors = errors.concat(validateReferentialIntegrity(data, cwd));
    }

    if (errors.length > 0) {
      for (const err of errors) console.error(err);
      const schemaCount = errors.filter(e => e.includes("[schema]")).length;
      const refCount = errors.filter(e => e.includes("[referential]")).length;
      const fileCount = errors.filter(e => e.includes("[file-not-found]")).length;
      const parts: string[] = [];
      if (schemaCount) parts.push(`${schemaCount} schema`);
      if (refCount) parts.push(`${refCount} referential`);
      if (fileCount) parts.push(`${fileCount} file-not-found`);
      console.error(`\n${errors.length} errors (${parts.join(", ")}). Blueprint NOT stamped.`);
      process.exit(1);
    }

    // Stamp
    const doc = loadDocument(bp);
    const meta = findDocNode(doc, ["meta"]);
    meta.set("updated_at", todayStr);
    const version = (parseInt(String(meta.get("version") ?? "0"), 10) || 0) + 1;
    meta.set("version", version);
    saveDocument(bp, doc);
    console.log(`Stamped blueprint: version=${version}, updated_at=${todayStr}`);
  }

  // Cleanup phase
  if (args.cleanup) {
    const workbench = join(cwd, ".storyline", "workbench");
    if (!existsSync(workbench)) {
      console.log("No workbench/ directory found. Nothing to clean.");
      return;
    }

    // Check for uncommitted files in workbench
    const untrackedOutput = gitExec(["ls-files", "--others", "--exclude-standard", workbench], cwd);
    const modifiedOutput = gitExec(["diff", "--name-only", "--", workbench], cwd);
    const stagedOutput = gitExec(["diff", "--staged", "--name-only", "--", workbench], cwd);

    const uncommitted = [untrackedOutput, modifiedOutput, stagedOutput].filter(Boolean).join("\n");
    if (uncommitted) {
      console.error("Error: uncommitted files in workbench/. Commit or discard them first:");
      console.error(uncommitted);
      process.exit(1);
    }

    // Determine what to remove
    const phase = args.phase || "all";
    const toRemove: string[] = [];

    if (phase === "three-amigos" || phase === "all") {
      const amigoNotes = join(workbench, "amigo-notes");
      if (existsSync(amigoNotes)) toRemove.push(amigoNotes);
    }

    if (phase === "sticky-storm" || phase === "all") {
      const eventsRaw = join(workbench, "events-raw.md");
      if (existsSync(eventsRaw)) toRemove.push(eventsRaw);
    }

    if (phase !== "three-amigos" && phase !== "sticky-storm" && phase !== "all") {
      console.error(`Error: unknown phase '${phase}'. Use: three-amigos, sticky-storm, or all`);
      process.exit(1);
    }

    if (toRemove.length === 0) {
      console.log(`No ${phase === "all" ? "" : phase + " "}artifacts to clean up.`);
    } else {
      for (const path of toRemove) {
        rmSync(path, { recursive: true, force: true });
        console.log(`Removed: ${path.replace(cwd + "/", "")}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Argument parsing & dispatch
// ---------------------------------------------------------------------------

function printUsage(): never {
  console.error(`Usage: blueprint <command> [options]

Commands:
  init --project "Name"                          Create a new blueprint
  validate [--strict]                            Validate the blueprint schema
  stamp                                          Validate then bump version/date
  add-context <name>                             Add a bounded context
  add-aggregate --context X --name Y             Add an aggregate
  add-event --context X --aggregate Y --name Z [--payload "fields"]
  add-command --context X --aggregate Y --name Z [--feature-files "files"]
  add-glossary --term X --context Y --meaning Z  Add a glossary term
  add-gap --description X --severity Y --affects Z
  add-question --question X --severity Y --raised-during Z --affects W
  summary                                        Compact blueprint overview
  view --context X                               View a single bounded context
  housekeeping [--cleanup] [--phase X]           Validate + stamp + cleanup`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) printUsage();

  const command = args[0];
  const rest = args.slice(1);
  const cwd = process.cwd();

  switch (command) {
    case "init": {
      const { values } = parseArgs({
        args: rest,
        options: { project: { type: "string" } },
        strict: true,
      });
      if (!values.project) {
        console.error("Error: --project is required for init");
        process.exit(1);
      }
      cmdInit({ project: values.project }, cwd);
      break;
    }

    case "validate": {
      const { values } = parseArgs({
        args: rest,
        options: { strict: { type: "boolean", default: false } },
        strict: true,
      });
      cmdValidate({ strict: values.strict ?? false }, cwd);
      break;
    }

    case "stamp": {
      cmdStamp(null, cwd);
      break;
    }

    case "add-context": {
      if (rest.length === 0 || rest[0].startsWith("-")) {
        console.error("Error: add-context requires a positional name argument");
        process.exit(1);
      }
      cmdAddContext({ name: rest[0] }, cwd);
      break;
    }

    case "add-aggregate": {
      const { values } = parseArgs({
        args: rest,
        options: {
          context: { type: "string" },
          name: { type: "string" },
        },
        strict: true,
      });
      if (!values.context || !values.name) {
        console.error("Error: --context and --name are required for add-aggregate");
        process.exit(1);
      }
      cmdAddAggregate({ context: values.context, name: values.name }, cwd);
      break;
    }

    case "add-event": {
      const { values } = parseArgs({
        args: rest,
        options: {
          context: { type: "string" },
          aggregate: { type: "string" },
          name: { type: "string" },
          payload: { type: "string", default: "" },
        },
        strict: true,
      });
      if (!values.context || !values.aggregate || !values.name) {
        console.error("Error: --context, --aggregate, and --name are required for add-event");
        process.exit(1);
      }
      cmdAddEvent({
        context: values.context,
        aggregate: values.aggregate,
        name: values.name,
        payload: values.payload ?? "",
      }, cwd);
      break;
    }

    case "add-command": {
      const { values } = parseArgs({
        args: rest,
        options: {
          context: { type: "string" },
          aggregate: { type: "string" },
          name: { type: "string" },
          "feature-files": { type: "string", default: "" },
        },
        strict: true,
      });
      if (!values.context || !values.aggregate || !values.name) {
        console.error("Error: --context, --aggregate, and --name are required for add-command");
        process.exit(1);
      }
      cmdAddCommand({
        context: values.context,
        aggregate: values.aggregate,
        name: values.name,
        featureFiles: values["feature-files"] ?? "",
      }, cwd);
      break;
    }

    case "add-glossary": {
      const { values } = parseArgs({
        args: rest,
        options: {
          term: { type: "string" },
          context: { type: "string" },
          meaning: { type: "string" },
        },
        strict: true,
      });
      if (!values.term || !values.context || !values.meaning) {
        console.error("Error: --term, --context, and --meaning are required for add-glossary");
        process.exit(1);
      }
      cmdAddGlossary({ term: values.term, context: values.context, meaning: values.meaning }, cwd);
      break;
    }

    case "add-gap": {
      const { values } = parseArgs({
        args: rest,
        options: {
          description: { type: "string" },
          severity: { type: "string" },
          affects: { type: "string" },
        },
        strict: true,
      });
      if (!values.description || !values.severity || !values.affects) {
        console.error("Error: --description, --severity, and --affects are required for add-gap");
        process.exit(1);
      }
      if (!ALLOWED_SEVERITIES.has(values.severity)) {
        console.error(`Error: severity must be one of: ${sorted(ALLOWED_SEVERITIES).join(", ")}`);
        process.exit(1);
      }
      cmdAddGap({ description: values.description, severity: values.severity, affects: values.affects }, cwd);
      break;
    }

    case "add-question": {
      const { values } = parseArgs({
        args: rest,
        options: {
          question: { type: "string" },
          severity: { type: "string" },
          "raised-during": { type: "string" },
          affects: { type: "string" },
        },
        strict: true,
      });
      if (!values.question || !values.severity || !values["raised-during"] || !values.affects) {
        console.error("Error: --question, --severity, --raised-during, and --affects are required for add-question");
        process.exit(1);
      }
      if (!ALLOWED_SEVERITIES.has(values.severity)) {
        console.error(`Error: severity must be one of: ${sorted(ALLOWED_SEVERITIES).join(", ")}`);
        process.exit(1);
      }
      cmdAddQuestion({
        question: values.question,
        severity: values.severity,
        raisedDuring: values["raised-during"],
        affects: values.affects,
      }, cwd);
      break;
    }

    case "summary": {
      cmdSummary(null, cwd);
      break;
    }

    case "view": {
      const { values } = parseArgs({
        args: rest,
        options: { context: { type: "string" } },
        strict: true,
      });
      if (!values.context) {
        console.error("Error: --context is required for view");
        process.exit(1);
      }
      cmdView({ context: values.context }, cwd);
      break;
    }

    case "housekeeping": {
      const { values } = parseArgs({
        args: rest,
        options: {
          cleanup: { type: "boolean", default: false },
          phase: { type: "string" },
        },
        strict: true,
      });
      cmdHousekeeping({ cleanup: values.cleanup ?? false, phase: values.phase }, cwd);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
  }
}

main();
