#!/usr/bin/env python3
"""blueprint.py — BDD Pipeline blueprint management CLI.

Subcommands:
  init --project "Name"   Create a new .storyline/blueprint.yaml
  validate [--strict]     Validate the blueprint schema (read-only)
  stamp                   Validate then bump meta.updated_at and meta.version
"""

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
BLUEPRINT_PATH = ".storyline/blueprint.yaml"
FEATURES_DIR = ".storyline/features"

ALLOWED_TOP_LEVEL_KEYS = {
    "meta",
    "tech_stack",
    "bounded_contexts",
    "glossary",
    "gaps",
    "questions",
}

ALLOWED_SEVERITIES = {"critical", "important", "nice_to_know"}

ALLOWED_RELATIONSHIP_TYPES = {
    "shared-kernel",
    "customer-supplier",
    "conformist",
    "anti-corruption-layer",
    "published-language",
    "open-host-service",
    "separate-ways",
}

ALLOWED_QUESTION_STATUSES = {"open", "resolved", "deferred"}


# ---------------------------------------------------------------------------
# YAML helper
# ---------------------------------------------------------------------------

_YAML = YAML()
_YAML.default_flow_style = False
_YAML.preserve_quotes = True


def _load(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return _YAML.load(fh)


def _save(path: Path, data):
    with path.open("w", encoding="utf-8") as fh:
        _YAML.dump(data, fh)


# ---------------------------------------------------------------------------
# Error formatting
# ---------------------------------------------------------------------------

def _fmt_error(path_str: str, message: str, fix: str) -> str:
    return (
        f"ERROR [schema] {path_str}\n"
        f"  {message}\n"
        f"  Fix: {fix}"
    )


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

def validate_schema(data, strict: bool = False) -> list[str]:
    """Return a list of formatted error strings (empty = valid)."""
    errors: list[str] = []

    if not isinstance(data, dict):
        errors.append(_fmt_error(
            "<root>",
            "Blueprint must be a YAML mapping at the top level.",
            "Ensure the file is a YAML mapping (key: value pairs).",
        ))
        return errors

    # Unknown top-level keys
    unknown = set(data.keys()) - ALLOWED_TOP_LEVEL_KEYS
    for key in sorted(unknown):
        errors.append(_fmt_error(
            key,
            f"Unknown top-level key '{key}'.",
            f"Remove '{key}' or move it under an allowed section. "
            f"Allowed keys: {sorted(ALLOWED_TOP_LEVEL_KEYS)}",
        ))

    # --- meta ---
    meta = data.get("meta")
    if meta is None:
        errors.append(_fmt_error(
            "meta",
            "Missing required section 'meta'.",
            "Add a 'meta' section with at least 'project' and 'created_at'.",
        ))
    elif not isinstance(meta, dict):
        errors.append(_fmt_error(
            "meta",
            "'meta' must be a mapping.",
            "Replace the 'meta' value with a YAML mapping.",
        ))
    else:
        if "project" not in meta or not isinstance(meta.get("project"), str) or not meta["project"]:
            errors.append(_fmt_error(
                "meta.project",
                "'meta.project' must be a non-empty string.",
                "Add 'project: \"Your Project Name\"' inside the meta section.",
            ))
        if "created_at" not in meta or not isinstance(meta.get("created_at"), str) or not meta["created_at"]:
            errors.append(_fmt_error(
                "meta.created_at",
                "'meta.created_at' must be a non-empty string.",
                "Add 'created_at: \"YYYY-MM-DD\"' inside the meta section.",
            ))
        else:
            if not re.match(r"^\d{4}-\d{2}-\d{2}", meta["created_at"]):
                errors.append(_fmt_error(
                    "meta.created_at",
                    f"'meta.created_at' value '{meta['created_at']}' is not a valid date. Expected YYYY-MM-DD or ISO 8601 format.",
                    "Use format: '2026-04-04' or '2026-04-04T14:30:00Z'.",
                ))

    # --- strict-mode: all sections present, bounded_contexts non-empty ---
    if strict:
        required_sections = ["tech_stack", "bounded_contexts", "glossary", "gaps", "questions"]
        for section in required_sections:
            if section not in data:
                errors.append(_fmt_error(
                    section,
                    f"Missing required section '{section}' (strict mode).",
                    f"Add an empty '{section}:' section.",
                ))
        bc = data.get("bounded_contexts")
        if bc is not None and (not isinstance(bc, list) or len(bc) == 0):
            errors.append(_fmt_error(
                "bounded_contexts",
                "'bounded_contexts' must be a non-empty list in strict mode.",
                "Add at least one bounded context.",
            ))

    # --- bounded_contexts ---
    bc = data.get("bounded_contexts")
    if bc is not None:
        if not isinstance(bc, list):
            errors.append(_fmt_error(
                "bounded_contexts",
                "'bounded_contexts' must be a list.",
                "Change 'bounded_contexts' to a YAML sequence.",
            ))
        else:
            for i, ctx in enumerate(bc):
                prefix = f"bounded_contexts[{i}]"
                if not isinstance(ctx, dict):
                    errors.append(_fmt_error(prefix, "Each bounded context must be a mapping.", "Use a YAML mapping."))
                    continue
                if "name" not in ctx or not ctx["name"]:
                    errors.append(_fmt_error(
                        f"{prefix}.name",
                        "Bounded context must have a 'name'.",
                        "Add 'name: ...' to this bounded context.",
                    ))
                # aggregates
                for j, agg in enumerate(ctx.get("aggregates", []) or []):
                    aprefix = f"{prefix}.aggregates[{j}]"
                    if not isinstance(agg, dict) or "name" not in agg or not agg["name"]:
                        errors.append(_fmt_error(
                            f"{aprefix}.name",
                            "Aggregate must have a 'name'.",
                            "Add 'name: ...' to this aggregate.",
                        ))
                    else:
                        # commands
                        for k, cmd in enumerate(agg.get("commands", []) or []):
                            cprefix = f"{aprefix}.commands[{k}]"
                            if not isinstance(cmd, dict):
                                errors.append(_fmt_error(cprefix, "Command must be a mapping.", "Use a YAML mapping."))
                                continue
                            if "name" not in cmd or not cmd["name"]:
                                errors.append(_fmt_error(f"{cprefix}.name", "Command must have a 'name'.", "Add 'name: ...'"))
                            if "feature_files" not in cmd:
                                errors.append(_fmt_error(f"{cprefix}.feature_files", "Command must have a 'feature_files' field.", "Add 'feature_files: []' to this command."))
                        # events
                        for k, evt in enumerate(agg.get("events", []) or []):
                            eprefix = f"{aprefix}.events[{k}]"
                            if not isinstance(evt, dict):
                                errors.append(_fmt_error(eprefix, "Event must be a mapping.", "Use a YAML mapping."))
                                continue
                            if "name" not in evt or not evt["name"]:
                                errors.append(_fmt_error(f"{eprefix}.name", "Event must have a 'name'.", "Add 'name: ...'"))
                            if "payload_fields" not in evt:
                                errors.append(_fmt_error(f"{eprefix}.payload_fields", "Event must have a 'payload_fields' field.", "Add 'payload_fields: []' to this event."))
                # policies (at context level)
                for k, pol in enumerate(ctx.get("policies", []) or []):
                    pprefix = f"{prefix}.policies[{k}]"
                    if not isinstance(pol, dict):
                        errors.append(_fmt_error(pprefix, "Policy must be a mapping.", "Use a YAML mapping."))
                        continue
                    for field in ("name", "triggered_by", "issues_command"):
                        if field not in pol or not pol[field]:
                            errors.append(_fmt_error(f"{pprefix}.{field}", f"Policy must have '{field}'.", f"Add '{field}: ...' to this policy."))

                # relationships
                for j, rel in enumerate(ctx.get("relationships", []) or []):
                    rprefix = f"{prefix}.relationships[{j}]"
                    if not isinstance(rel, dict):
                        errors.append(_fmt_error(rprefix, "Relationship must be a mapping.", "Use a YAML mapping."))
                        continue
                    if "type" not in rel or rel["type"] not in ALLOWED_RELATIONSHIP_TYPES:
                        errors.append(_fmt_error(
                            f"{rprefix}.type",
                            f"Relationship 'type' must be one of {sorted(ALLOWED_RELATIONSHIP_TYPES)}.",
                            "Set 'type' to one of the allowed relationship types.",
                        ))
                    if "target" not in rel or not rel["target"]:
                        errors.append(_fmt_error(f"{rprefix}.target", "Relationship must have a 'target'.", "Add 'target: ...'"))

    # --- gaps ---
    gaps = data.get("gaps")
    if gaps is not None:
        if not isinstance(gaps, list):
            errors.append(_fmt_error("gaps", "'gaps' must be a list.", "Change to a YAML sequence."))
        else:
            for i, gap in enumerate(gaps):
                gprefix = f"gaps[{i}]"
                if not isinstance(gap, dict):
                    errors.append(_fmt_error(gprefix, "Gap must be a mapping.", "Use a YAML mapping."))
                    continue
                for field in ("id", "description"):
                    if field not in gap or not gap[field]:
                        errors.append(_fmt_error(f"{gprefix}.{field}", f"Gap must have '{field}'.", f"Add '{field}: ...'"))
                sev = gap.get("severity")
                if sev not in ALLOWED_SEVERITIES:
                    errors.append(_fmt_error(
                        f"{gprefix}.severity",
                        f"Gap severity must be one of {sorted(ALLOWED_SEVERITIES)}, got '{sev}'.",
                        "Set 'severity' to 'critical', 'important', or 'nice_to_know'.",
                    ))
                if "affects" not in gap or not isinstance(gap.get("affects"), list):
                    errors.append(_fmt_error(f"{gprefix}.affects", "Gap must have 'affects' as a list.", "Add 'affects: []'"))

    # --- questions ---
    questions = data.get("questions")
    if questions is not None:
        if not isinstance(questions, list):
            errors.append(_fmt_error("questions", "'questions' must be a list.", "Change to a YAML sequence."))
        else:
            for i, q in enumerate(questions):
                qprefix = f"questions[{i}]"
                if not isinstance(q, dict):
                    errors.append(_fmt_error(qprefix, "Question must be a mapping.", "Use a YAML mapping."))
                    continue
                for field in ("id", "question"):
                    if field not in q or not q[field]:
                        errors.append(_fmt_error(f"{qprefix}.{field}", f"Question must have '{field}'.", f"Add '{field}: ...'"))
                sev = q.get("severity")
                if sev not in ALLOWED_SEVERITIES:
                    errors.append(_fmt_error(
                        f"{qprefix}.severity",
                        f"Question severity must be one of {sorted(ALLOWED_SEVERITIES)}, got '{sev}'.",
                        "Set 'severity' to 'critical', 'important', or 'nice_to_know'.",
                    ))
                if "affects" not in q or not isinstance(q.get("affects"), list):
                    errors.append(_fmt_error(f"{qprefix}.affects", "Question must have 'affects' as a list.", "Add 'affects: []'"))
                status = q.get("status")
                if status is not None and status not in ALLOWED_QUESTION_STATUSES:
                    errors.append(_fmt_error(
                        f"{qprefix}.status",
                        f"Question status must be one of {sorted(ALLOWED_QUESTION_STATUSES)}, got '{status}'.",
                        "Set 'status' to 'open', 'resolved', or 'deferred'.",
                    ))

    return errors


# ---------------------------------------------------------------------------
# Referential integrity
# ---------------------------------------------------------------------------

def _fmt_ref_error(path_str: str, message: str, detail: str, fix: str) -> str:
    return (
        f"ERROR [referential] {path_str}\n"
        f"  {message}\n"
        f"  {detail}\n"
        f"  Fix: {fix}"
    )


def _fmt_file_error(path_str: str, filename: str, checked_path: str, fix: str) -> str:
    return (
        f"ERROR [file-not-found] {path_str}\n"
        f"  Feature file '{filename}' not found\n"
        f"  Path checked: {checked_path}\n"
        f"  Fix: {fix}"
    )


def validate_referential_integrity(data, cwd) -> list[str]:
    """Check cross-references between blueprint entries and feature files."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return errors

    # Build lookup structures
    context_names: set[str] = set()
    # Map context_name -> set of event names in that context
    context_events: dict[str, set[str]] = {}
    # All event names across all contexts -> list of context names (for dup detection)
    all_events: dict[str, list[str]] = {}
    # All command names across all contexts
    all_commands: set[str] = set()

    bcs = data.get("bounded_contexts") or []
    if not isinstance(bcs, list):
        bcs = []

    for ctx in bcs:
        if not isinstance(ctx, dict):
            continue
        ctx_name = ctx.get("name")
        if not ctx_name:
            continue
        context_names.add(ctx_name)
        ctx_event_names: set[str] = set()
        for agg in (ctx.get("aggregates") or []):
            if not isinstance(agg, dict):
                continue
            for evt in (agg.get("events") or []):
                if isinstance(evt, dict) and evt.get("name"):
                    evt_name = evt["name"]
                    ctx_event_names.add(evt_name)
                    all_events.setdefault(evt_name, []).append(ctx_name)
            for cmd in (agg.get("commands") or []):
                if isinstance(cmd, dict) and cmd.get("name"):
                    all_commands.add(cmd["name"])
        context_events[ctx_name] = ctx_event_names

    # Check 9: duplicate event names across all aggregates
    for evt_name, ctx_list in all_events.items():
        if len(ctx_list) > 1:
            unique_contexts = sorted(set(ctx_list))
            if len(unique_contexts) > 1:
                msg = f"Event '{evt_name}' is defined in multiple contexts: {unique_contexts}."
            else:
                msg = f"Event '{evt_name}' is defined {len(ctx_list)} times in context '{unique_contexts[0]}'."
            errors.append(_fmt_ref_error(
                f"bounded_contexts[events].{evt_name}",
                msg,
                "Event names must be unique across all aggregates.",
                "Rename the event to make it unique, or merge the definitions.",
            ))

    # Per-context checks
    for i, ctx in enumerate(bcs):
        if not isinstance(ctx, dict):
            continue
        ctx_name = ctx.get("name") or f"[{i}]"
        ctx_prefix = f"bounded_contexts[{ctx_name}]"

        # Check 1: feature files exist on disk
        for agg in (ctx.get("aggregates") or []):
            if not isinstance(agg, dict):
                continue
            agg_name = agg.get("name") or "?"
            agg_prefix = f"{ctx_prefix}.aggregates[{agg_name}]"
            for k, cmd in enumerate(agg.get("commands") or []):
                if not isinstance(cmd, dict):
                    continue
                cmd_name = cmd.get("name") or f"[{k}]"
                cmd_prefix = f"{agg_prefix}.commands[{cmd_name}]"
                for ff in (cmd.get("feature_files") or []):
                    if not isinstance(ff, str) or not ff:
                        continue
                    feature_path = cwd / FEATURES_DIR / ff
                    if not feature_path.exists():
                        errors.append(_fmt_file_error(
                            f"{cmd_prefix}.feature_files",
                            ff,
                            f"{FEATURES_DIR}/{ff}",
                            "create the feature file or update the reference",
                        ))

        # Check 2: policy triggered_by events exist in same context
        # Check 3: policy issues_command exists across all contexts
        ctx_evt_set = context_events.get(ctx_name, set())
        for pol in (ctx.get("policies") or []):
            if not isinstance(pol, dict):
                continue
            pol_name = pol.get("name") or "?"
            pol_prefix = f"{ctx_prefix}.policies[{pol_name}]"

            triggered_by = pol.get("triggered_by")
            if triggered_by and triggered_by not in ctx_evt_set:
                errors.append(_fmt_ref_error(
                    f"{pol_prefix}.triggered_by",
                    f"Event '{triggered_by}' not found in context '{ctx_name}'.",
                    f"Expected one of: {sorted(ctx_evt_set)}",
                    "rename to a valid event, or add the event to an aggregate",
                ))

            issues_command = pol.get("issues_command")
            if issues_command and issues_command not in all_commands:
                errors.append(_fmt_ref_error(
                    f"{pol_prefix}.issues_command",
                    f"Command '{issues_command}' not found in any bounded context.",
                    f"Expected one of: {sorted(all_commands)}",
                    "rename to a valid command, or add the command to an aggregate",
                ))

        # Check 4: relationship targets reference existing contexts
        for j, rel in enumerate(ctx.get("relationships") or []):
            if not isinstance(rel, dict):
                continue
            target = rel.get("target")
            if target and target not in context_names:
                errors.append(_fmt_ref_error(
                    f"{ctx_prefix}.relationships[{j}].target",
                    f"Relationship target '{target}' is not a known bounded context.",
                    f"Known contexts: {sorted(context_names)}",
                    "rename the target to match an existing bounded context name",
                ))

        # Check 7: read_models built_from events exist across all contexts
        for rm in (ctx.get("read_models") or []):
            if not isinstance(rm, dict):
                continue
            rm_name = rm.get("name") or "?"
            rm_prefix = f"{ctx_prefix}.read_models[{rm_name}]"
            for evt_name in (rm.get("built_from") or []):
                if not isinstance(evt_name, str):
                    continue
                if evt_name not in all_events:
                    errors.append(_fmt_ref_error(
                        f"{rm_prefix}.built_from",
                        f"Event '{evt_name}' not found in any bounded context.",
                        f"Known events: {sorted(all_events.keys())}",
                        "rename to a valid event name, or add the event to an aggregate",
                    ))

    # Check 5: gaps affects reference existing contexts
    for i, gap in enumerate(data.get("gaps") or []):
        if not isinstance(gap, dict):
            continue
        gap_id = gap.get("id") or f"[{i}]"
        for ctx_ref in (gap.get("affects") or []):
            if isinstance(ctx_ref, str) and ctx_ref not in context_names:
                errors.append(_fmt_ref_error(
                    f"gaps[{gap_id}].affects",
                    f"Context '{ctx_ref}' referenced in gap affects is not a known bounded context.",
                    f"Known contexts: {sorted(context_names)}",
                    "rename to a valid bounded context name, or add the context",
                ))

    # Check 6: questions affects reference existing contexts
    for i, q in enumerate(data.get("questions") or []):
        if not isinstance(q, dict):
            continue
        q_id = q.get("id") or f"[{i}]"
        for ctx_ref in (q.get("affects") or []):
            if isinstance(ctx_ref, str) and ctx_ref not in context_names:
                errors.append(_fmt_ref_error(
                    f"questions[{q_id}].affects",
                    f"Context '{ctx_ref}' referenced in question affects is not a known bounded context.",
                    f"Known contexts: {sorted(context_names)}",
                    "rename to a valid bounded context name, or add the context",
                ))

    # Check 8: glossary definitions context references existing context or "Shared Kernel"
    glossary = data.get("glossary") or {}
    if isinstance(glossary, dict):
        glossary_items = glossary.items()
    else:
        glossary_items = []
    for term, entry in glossary_items:
        if not isinstance(entry, dict):
            continue
        for defn in (entry.get("definitions") or []):
            if not isinstance(defn, dict):
                continue
            ctx_ref = defn.get("context")
            if ctx_ref and ctx_ref != "Shared Kernel" and ctx_ref not in context_names:
                errors.append(_fmt_ref_error(
                    f"glossary[{term}].definitions.context",
                    f"Context '{ctx_ref}' in glossary definition is not a known bounded context.",
                    f"Known contexts: {sorted(context_names)} (or 'Shared Kernel')",
                    "rename to a valid bounded context name, or use 'Shared Kernel'",
                ))

    return errors


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _find_context(data, name):
    """Find a bounded context by name. Returns the dict or None."""
    for ctx in data.get("bounded_contexts", []) or []:
        if ctx.get("name") == name:
            return ctx
    return None


def _require_blueprint(cwd: Path):
    """Load blueprint or exit with error if not found."""
    blueprint = cwd / BLUEPRINT_PATH
    if not blueprint.exists():
        print(f"Blueprint not found at {BLUEPRINT_PATH}", file=sys.stderr)
        sys.exit(1)
    return blueprint, _load(blueprint)


def _find_aggregate(ctx, name):
    """Find an aggregate by name within a context. Returns the dict or None."""
    for agg in ctx.get("aggregates", []) or []:
        if agg.get("name") == name:
            return agg
    return None


_PREFIX_SECTION = {"GAP": "gaps", "Q": "questions"}


def _next_id(data, prefix):
    """Generate next sequential ID like GAP-001, Q-002."""
    section = _PREFIX_SECTION.get(prefix)
    if section is None:
        raise ValueError(f"Unknown ID prefix '{prefix}'")
    existing = []
    for item in data.get(section, []) or []:
        id_val = item.get("id", "")
        if id_val.startswith(prefix + "-"):
            try:
                existing.append(int(id_val.split("-")[1]))
            except ValueError:
                pass
    return f"{prefix}-{max(existing, default=0) + 1:03d}"


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

def cmd_init(args, cwd: Path):
    blueprint = cwd / BLUEPRINT_PATH
    features = cwd / FEATURES_DIR

    if blueprint.exists():
        print(f"Error: blueprint already exists at {BLUEPRINT_PATH}", file=sys.stderr)
        sys.exit(1)

    blueprint.parent.mkdir(parents=True, exist_ok=True)
    for subdir in ("features", "workbench", "plans", "backlog"):
        (blueprint.parent / subdir).mkdir(parents=True, exist_ok=True)

    today = date.today().isoformat()

    data = CommentedMap()
    meta = CommentedMap()
    meta["project"] = args.project
    meta["created_at"] = today
    meta["updated_at"] = today
    meta["version"] = 1
    data["meta"] = meta
    data["tech_stack"] = CommentedMap()
    data["bounded_contexts"] = CommentedSeq()
    data["glossary"] = CommentedMap()
    data["gaps"] = CommentedSeq()
    data["questions"] = CommentedSeq()

    _save(blueprint, data)
    print(f"Initialised blueprint at {BLUEPRINT_PATH}")


def cmd_validate(args, cwd: Path):
    blueprint = cwd / BLUEPRINT_PATH

    if not blueprint.exists():
        print(f"ERROR [schema] <root>\n  Blueprint not found at {BLUEPRINT_PATH}\n  Fix: Run 'blueprint.py init --project ...' first.", file=sys.stderr)
        sys.exit(1)

    data = _load(blueprint)
    strict = getattr(args, "strict", False)
    errors = validate_schema(data, strict=strict)

    if not errors:
        errors += validate_referential_integrity(data, cwd)

    if errors:
        for err in errors:
            print(err, file=sys.stderr)
        schema_count = sum(1 for e in errors if "[schema]" in e)
        ref_count = sum(1 for e in errors if "[referential]" in e)
        file_count = sum(1 for e in errors if "[file-not-found]" in e)
        parts = []
        if schema_count:
            parts.append(f"{schema_count} schema")
        if ref_count:
            parts.append(f"{ref_count} referential")
        if file_count:
            parts.append(f"{file_count} file-not-found")
        print(f"\n{len(errors)} errors ({', '.join(parts)}). Blueprint NOT stamped.", file=sys.stderr)
        sys.exit(1)

    print("Blueprint is valid.")


def cmd_stamp(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    errors = validate_schema(data)
    if not errors:
        errors += validate_referential_integrity(data, cwd)

    if errors:
        for err in errors:
            print(err, file=sys.stderr)
        sys.exit(1)

    today = date.today().isoformat()
    data["meta"]["updated_at"] = today
    data["meta"]["version"] = int(data["meta"].get("version", 0)) + 1

    _save(blueprint, data)
    print(f"Stamped blueprint: version={data['meta']['version']}, updated_at={today}")


def cmd_add_context(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    if _find_context(data, args.name) is not None:
        print(f"Error: bounded context '{args.name}' already exists.", file=sys.stderr)
        sys.exit(1)
    ctx = CommentedMap()
    ctx["name"] = args.name
    ctx["description"] = ""
    ctx["aggregates"] = CommentedSeq()
    ctx["policies"] = CommentedSeq()
    ctx["read_models"] = CommentedSeq()
    ctx["external_systems"] = CommentedSeq()
    ctx["domain_services"] = CommentedSeq()
    ctx["relationships"] = CommentedSeq()
    if data.get("bounded_contexts") is None:
        data["bounded_contexts"] = CommentedSeq()
    data["bounded_contexts"].append(ctx)
    _save(blueprint, data)
    print(f"Added bounded context '{args.name}'.")


def cmd_add_aggregate(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    ctx = _find_context(data, args.context)
    if ctx is None:
        print(f"Error: bounded context '{args.context}' not found.", file=sys.stderr)
        sys.exit(1)
    if _find_aggregate(ctx, args.name) is not None:
        print(f"Error: aggregate '{args.name}' already exists in context '{args.context}'.", file=sys.stderr)
        sys.exit(1)
    agg = CommentedMap()
    agg["name"] = args.name
    agg["root_entity"] = args.name
    agg["entities"] = CommentedSeq()
    agg["value_objects"] = CommentedSeq()
    agg["commands"] = CommentedSeq()
    agg["events"] = CommentedSeq()
    agg["invariants"] = CommentedSeq()
    if ctx.get("aggregates") is None:
        ctx["aggregates"] = CommentedSeq()
    ctx["aggregates"].append(agg)
    _save(blueprint, data)
    print(f"Added aggregate '{args.name}' to context '{args.context}'.")


def cmd_add_event(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    ctx = _find_context(data, args.context)
    if ctx is None:
        print(f"Error: bounded context '{args.context}' not found.", file=sys.stderr)
        sys.exit(1)
    agg = _find_aggregate(ctx, args.aggregate)
    if agg is None:
        print(f"Error: aggregate '{args.aggregate}' not found in context '{args.context}'.", file=sys.stderr)
        sys.exit(1)
    payload_fields = [f.strip() for f in args.payload.split(",") if f.strip()] if args.payload else []
    evt = CommentedMap()
    evt["name"] = args.name
    seq = CommentedSeq()
    seq.extend(payload_fields)
    evt["payload_fields"] = seq
    if agg.get("events") is None:
        agg["events"] = CommentedSeq()
    agg["events"].append(evt)
    _save(blueprint, data)
    print(f"Added event '{args.name}' to aggregate '{args.aggregate}' in context '{args.context}'.")


def cmd_add_command(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    ctx = _find_context(data, args.context)
    if ctx is None:
        print(f"Error: bounded context '{args.context}' not found.", file=sys.stderr)
        sys.exit(1)
    agg = _find_aggregate(ctx, args.aggregate)
    if agg is None:
        print(f"Error: aggregate '{args.aggregate}' not found in context '{args.context}'.", file=sys.stderr)
        sys.exit(1)
    feature_files = [f.strip() for f in args.feature_files.split(",") if f.strip()] if args.feature_files else []
    cmd = CommentedMap()
    cmd["name"] = args.name
    seq = CommentedSeq()
    seq.extend(feature_files)
    cmd["feature_files"] = seq
    if agg.get("commands") is None:
        agg["commands"] = CommentedSeq()
    agg["commands"].append(cmd)
    _save(blueprint, data)
    print(f"Added command '{args.name}' to aggregate '{args.aggregate}' in context '{args.context}'.")


def cmd_add_glossary(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    if data.get("glossary") is None:
        data["glossary"] = CommentedMap()
    # Find or create term entry (glossary is a map keyed by term name)
    term_entry = data["glossary"].get(args.term)
    if term_entry is None:
        term_entry = CommentedMap()
        term_entry["definitions"] = CommentedSeq()
        data["glossary"][args.term] = term_entry
    # Check for duplicate context definition
    for defn in (term_entry.get("definitions") or []):
        if isinstance(defn, dict) and defn.get("context") == args.context:
            print(f"Error: glossary term '{args.term}' already has a definition for context '{args.context}'.", file=sys.stderr)
            sys.exit(1)
    defn = CommentedMap()
    defn["context"] = args.context
    defn["meaning"] = args.meaning
    if term_entry.get("definitions") is None:
        term_entry["definitions"] = CommentedSeq()
    term_entry["definitions"].append(defn)
    _save(blueprint, data)
    print(f"Added glossary term '{args.term}' for context '{args.context}'.")


def cmd_add_gap(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    gap_id = _next_id(data, "GAP")
    affects = [a.strip() for a in args.affects.split(",") if a.strip()] if args.affects else []
    gap = CommentedMap()
    gap["id"] = gap_id
    gap["description"] = args.description
    gap["severity"] = args.severity
    seq = CommentedSeq()
    seq.extend(affects)
    gap["affects"] = seq
    if data.get("gaps") is None:
        data["gaps"] = CommentedSeq()
    data["gaps"].append(gap)
    _save(blueprint, data)
    print(f"Added gap '{gap_id}'.")


def cmd_add_question(args, cwd: Path):
    blueprint, data = _require_blueprint(cwd)
    q_id = _next_id(data, "Q")
    affects = [a.strip() for a in args.affects.split(",") if a.strip()] if args.affects else []
    q = CommentedMap()
    q["id"] = q_id
    q["question"] = args.question
    q["severity"] = args.severity
    q["raised_during"] = args.raised_during
    seq = CommentedSeq()
    seq.extend(affects)
    q["affects"] = seq
    q["status"] = "open"
    if data.get("questions") is None:
        data["questions"] = CommentedSeq()
    data["questions"].append(q)
    _save(blueprint, data)
    print(f"Added question '{q_id}'.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="BDD Pipeline blueprint management CLI",
        prog="blueprint.py",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # init
    p_init = sub.add_parser("init", help="Initialise a new blueprint")
    p_init.add_argument("--project", required=True, help="Project name")

    # validate
    p_val = sub.add_parser("validate", help="Validate the blueprint schema")
    p_val.add_argument("--strict", action="store_true", help="Require all sections; bounded_contexts must be non-empty")

    # stamp
    sub.add_parser("stamp", help="Validate then bump updated_at and version")

    # add-context
    p_add_ctx = sub.add_parser("add-context", help="Add a bounded context")
    p_add_ctx.add_argument("name", help="Context name")

    # add-aggregate
    p_add_agg = sub.add_parser("add-aggregate", help="Add an aggregate to a context")
    p_add_agg.add_argument("--context", required=True, help="Bounded context name")
    p_add_agg.add_argument("--name", required=True, help="Aggregate name")

    # add-event
    p_add_evt = sub.add_parser("add-event", help="Add an event to an aggregate")
    p_add_evt.add_argument("--context", required=True, help="Bounded context name")
    p_add_evt.add_argument("--aggregate", required=True, help="Aggregate name")
    p_add_evt.add_argument("--name", required=True, help="Event name")
    p_add_evt.add_argument("--payload", default="", help="Comma-separated payload field names")

    # add-command
    p_add_cmd = sub.add_parser("add-command", help="Add a command to an aggregate")
    p_add_cmd.add_argument("--context", required=True, help="Bounded context name")
    p_add_cmd.add_argument("--aggregate", required=True, help="Aggregate name")
    p_add_cmd.add_argument("--name", required=True, help="Command name")
    p_add_cmd.add_argument("--feature-files", default="", help="Comma-separated feature file names")

    # add-glossary
    p_add_glos = sub.add_parser("add-glossary", help="Add a glossary term definition")
    p_add_glos.add_argument("--term", required=True, help="Term")
    p_add_glos.add_argument("--context", required=True, help="Bounded context name")
    p_add_glos.add_argument("--meaning", required=True, help="Meaning of the term in this context")

    # add-gap
    p_add_gap = sub.add_parser("add-gap", help="Add a gap")
    p_add_gap.add_argument("--description", required=True, help="Gap description")
    p_add_gap.add_argument("--severity", required=True, choices=list(ALLOWED_SEVERITIES), help="Severity")
    p_add_gap.add_argument("--affects", required=True, help="Comma-separated context names")

    # add-question
    p_add_q = sub.add_parser("add-question", help="Add a question")
    p_add_q.add_argument("--question", required=True, help="The question")
    p_add_q.add_argument("--severity", required=True, choices=list(ALLOWED_SEVERITIES), help="Severity")
    p_add_q.add_argument("--raised-during", required=True, help="Session or event where question was raised")
    p_add_q.add_argument("--affects", required=True, help="Comma-separated context names")

    args = parser.parse_args()
    cwd = Path.cwd()

    if args.command == "init":
        cmd_init(args, cwd)
    elif args.command == "validate":
        cmd_validate(args, cwd)
    elif args.command == "stamp":
        cmd_stamp(args, cwd)
    elif args.command == "add-context":
        cmd_add_context(args, cwd)
    elif args.command == "add-aggregate":
        cmd_add_aggregate(args, cwd)
    elif args.command == "add-event":
        cmd_add_event(args, cwd)
    elif args.command == "add-command":
        cmd_add_command(args, cwd)
    elif args.command == "add-glossary":
        cmd_add_glossary(args, cwd)
    elif args.command == "add-gap":
        cmd_add_gap(args, cwd)
    elif args.command == "add-question":
        cmd_add_question(args, cwd)


if __name__ == "__main__":
    main()
