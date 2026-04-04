#!/usr/bin/env python3
"""
Scaffold generator for The Onion phase.

Reads blueprint.yaml (or domain-model.json for backwards compatibility) and generates
directory structure + skeleton files for the bounded contexts, aggregates, and value
objects defined in the model.

Usage:
    python scaffold.py --model .storyline/blueprint.yaml --output src/ --lang typescript
    python scaffold.py --model .storyline/blueprint.yaml --output src/ --lang python
    python scaffold.py --model domain/domain-model.json --output src/ --lang typescript
"""

import json
import os
import sys
import argparse
from pathlib import Path

try:
    from ruamel.yaml import YAML
    _yaml = YAML()
    _yaml.preserve_quotes = True
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


def load_model(path: str) -> dict:
    """Load a model from a YAML or JSON file."""
    p = Path(path)
    suffix = p.suffix.lower()

    if suffix in ('.yaml', '.yml'):
        if not HAS_YAML:
            sys.exit(
                "Error: ruamel.yaml is required to read YAML files.\n"
                "Install it with:  pip install ruamel.yaml"
            )
        with open(p) as f:
            return dict(_yaml.load(f))
    else:
        with open(p) as f:
            return json.load(f)


def extract_event_names(events: list) -> list[str]:
    """
    Extract event name strings from a list that may contain either:
      - plain strings: "OrderPlaced"
      - blueprint objects: {"name": "OrderPlaced", "payload_fields": [...]}
    """
    names = []
    for e in events:
        if isinstance(e, dict):
            names.append(e["name"])
        else:
            names.append(str(e))
    return names


def extract_command_names(commands: list) -> list[str]:
    """
    Extract command name strings from a list that may contain either:
      - plain strings: "PlaceOrder"
      - blueprint objects: {"name": "PlaceOrder", "feature_files": [...]}
    """
    names = []
    for c in commands:
        if isinstance(c, dict):
            names.append(c["name"])
        else:
            names.append(str(c))
    return names


def _print_summary(model: dict, output_dir: str):
    """Print scaffold generation summary."""
    contexts = model.get('bounded_contexts', [])
    print(f"Scaffold generated in {output_dir}")
    print(f"  Bounded contexts: {len(contexts)}")
    total_aggs = sum(len(c.get('aggregates', [])) for c in contexts)
    print(f"  Aggregates: {total_aggs}")
    print(f"  Next step: write your first acceptance test!")


def to_snake_case(name: str) -> str:
    """Convert PascalCase to snake_case."""
    result = []
    for i, char in enumerate(name):
        if char.isupper() and i > 0:
            result.append('_')
        result.append(char.lower())
    return ''.join(result)


def to_kebab_case(name: str) -> str:
    """Convert PascalCase to kebab-case."""
    return to_snake_case(name).replace('_', '-')


def generate_typescript(model: dict, output_dir: str):
    """Generate TypeScript scaffold from domain model."""
    base = Path(output_dir)

    for context in model.get('bounded_contexts', []):
        ctx_dir = base / to_kebab_case(context['name'])

        # Domain layer
        domain_dir = ctx_dir / 'domain'
        events_dir = domain_dir / 'events'
        os.makedirs(events_dir, exist_ok=True)

        # Application layer
        app_dir = ctx_dir / 'application'
        os.makedirs(app_dir, exist_ok=True)

        # Infrastructure layer
        infra_dir = ctx_dir / 'infrastructure'
        os.makedirs(infra_dir, exist_ok=True)

        for aggregate in context.get('aggregates', []):
            agg_name = aggregate['name']
            root = aggregate.get('root_entity', agg_name)

            # Normalise events and commands — blueprint uses objects, legacy uses strings
            event_names = extract_event_names(aggregate.get('events', aggregate.get('events_produced', [])))
            command_names = extract_command_names(aggregate.get('commands', aggregate.get('commands_handled', [])))

            # Aggregate root
            agg_file = domain_dir / f'{to_kebab_case(agg_name)}.ts'
            invariants = aggregate.get('invariants', [])
            invariant_comments = '\n'.join(f'   * - {inv}' for inv in invariants)

            with open(agg_file, 'w') as f:
                f.write(f"""/**
 * {agg_name} Aggregate Root
 * Bounded Context: {context['name']}
 *
 * Invariants:
{invariant_comments}
 */

// Value Objects
{chr(10).join(f"// import {{ {vo} }} from './{to_kebab_case(vo)}';" for vo in aggregate.get('value_objects', []))}

// Events
{chr(10).join(f"// import {{ {ev} }} from './events/{to_kebab_case(ev)}';" for ev in event_names)}

export class {root} {{
  // TODO: Implement aggregate root
  // Commands handled: {', '.join(command_names)}
  // Events produced: {', '.join(event_names)}
}}
""")

            # Value objects
            for vo in aggregate.get('value_objects', []):
                vo_file = domain_dir / f'{to_kebab_case(vo)}.ts'
                with open(vo_file, 'w') as f:
                    f.write(f"""/**
 * {vo} Value Object
 * Bounded Context: {context['name']}
 */

export class {vo} {{
  // TODO: Implement as immutable value object
  // - Implement equals()
  // - Implement toString()
  // - No identity, defined by attributes only

  constructor() {{
    // TODO: Add constructor parameters
  }}

  equals(other: {vo}): boolean {{
    throw new Error('Not implemented');
  }}

  toString(): string {{
    throw new Error('Not implemented');
  }}
}}
""")

            # Events
            for event in aggregate.get('events', aggregate.get('events_produced', [])):
                if isinstance(event, dict):
                    event_name = event['name']
                    payload_fields = event.get('payload_fields', [])
                else:
                    event_name = str(event)
                    payload_fields = []

                payload_lines = '\n'.join(
                    f'  readonly {field}: unknown; // TODO: type this field'
                    for field in payload_fields
                )

                event_file = events_dir / f'{to_kebab_case(event_name)}.ts'
                with open(event_file, 'w') as f:
                    f.write(f"""/**
 * {event_name} Domain Event
 * Produced by: {agg_name} aggregate
 * Bounded Context: {context['name']}
 */

export interface {event_name} {{
  readonly type: '{event_name}';
  readonly occurredAt: Date;
{payload_lines}
}}
""")

            # Command handlers
            for cmd in aggregate.get('commands', aggregate.get('commands_handled', [])):
                if isinstance(cmd, dict):
                    cmd_name = cmd['name']
                    feature_files = cmd.get('feature_files', [])
                else:
                    cmd_name = str(cmd)
                    feature_files = []

                feature_refs = '\n'.join(
                    f' * - features/{ff}'
                    for ff in feature_files
                ) or ' * - (no feature files linked yet)'

                cmd_file = app_dir / f'{to_kebab_case(cmd_name)}-handler.ts'
                with open(cmd_file, 'w') as f:
                    f.write(f"""/**
 * {cmd_name} Command Handler
 * Targets: {agg_name} aggregate
 * Bounded Context: {context['name']}
 *
 * Implements behavior from:
{feature_refs}
 */

// import {{ {root} }} from '../domain/{to_kebab_case(agg_name)}';
// import {{ {root}Repository }} from '../domain/{to_kebab_case(root)}-repository';

export interface {cmd_name}Command {{
  // TODO: Define command fields
}}

export class {cmd_name}Handler {{
  // constructor(private repository: {root}Repository) {{}}

  async handle(command: {cmd_name}Command): Promise<void> {{
    // TODO: Implement
    // 1. Load aggregate from repository
    // 2. Execute command on aggregate
    // 3. Save aggregate
    // 4. Publish domain events
    throw new Error('Not implemented');
  }}
}}
""")

            # Repository interface
            repo_file = domain_dir / f'{to_kebab_case(root)}-repository.ts'
            with open(repo_file, 'w') as f:
                f.write(f"""/**
 * {root} Repository Interface
 * Bounded Context: {context['name']}
 *
 * This interface is defined in the domain layer.
 * Implementations go in the infrastructure layer.
 */

// import {{ {root} }} from './{to_kebab_case(root)}';

export interface {root}Repository {{
  findById(id: string): Promise<{root} | null>;
  save(aggregate: {root}): Promise<void>;
}}
""")

            # In-memory repository (for testing)
            inmem_file = infra_dir / f'in-memory-{to_kebab_case(root)}-repository.ts'
            with open(inmem_file, 'w') as f:
                f.write(f"""/**
 * In-Memory {root} Repository
 * For testing purposes only.
 */

// import {{ {root} }} from '../domain/{to_kebab_case(root)}';
// import {{ {root}Repository }} from '../domain/{to_kebab_case(root)}-repository';

export class InMemory{root}Repository /* implements {root}Repository */ {{
  private store: Map<string, any> = new Map();

  async findById(id: string): Promise<any | null> {{
    return this.store.get(id) || null;
  }}

  async save(aggregate: any): Promise<void> {{
    // this.store.set(aggregate.id, aggregate);
    throw new Error('Not implemented');
  }}
}}
""")

    _print_summary(model, output_dir)


def generate_python(model: dict, output_dir: str):
    """Generate Python scaffold from domain model."""
    base = Path(output_dir)

    for context in model.get('bounded_contexts', []):
        ctx_dir = base / to_snake_case(context['name'])

        # Domain layer
        domain_dir = ctx_dir / 'domain'
        events_dir = domain_dir / 'events'
        os.makedirs(events_dir, exist_ok=True)
        (events_dir / '__init__.py').touch()

        # Application layer
        app_dir = ctx_dir / 'application'
        os.makedirs(app_dir, exist_ok=True)
        (app_dir / '__init__.py').touch()

        # Infrastructure layer
        infra_dir = ctx_dir / 'infrastructure'
        os.makedirs(infra_dir, exist_ok=True)
        (infra_dir / '__init__.py').touch()

        # Context __init__
        (ctx_dir / '__init__.py').touch()
        (domain_dir / '__init__.py').touch()

        for aggregate in context.get('aggregates', []):
            agg_name = aggregate['name']
            root = aggregate.get('root_entity', agg_name)

            # Normalise events and commands — blueprint uses objects, legacy uses strings
            event_names = extract_event_names(aggregate.get('events', aggregate.get('events_produced', [])))
            command_names = extract_command_names(aggregate.get('commands', aggregate.get('commands_handled', [])))

            # Aggregate root
            agg_file = domain_dir / f'{to_snake_case(agg_name)}.py'
            invariants = aggregate.get('invariants', [])
            invariant_lines = '\n'.join(f'    - {inv}' for inv in invariants)

            with open(agg_file, 'w') as f:
                f.write(f'''"""
{agg_name} Aggregate Root
Bounded Context: {context['name']}

Invariants:
{invariant_lines}
"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class {root}:
    """
    {agg_name} aggregate root.

    Commands handled: {', '.join(command_names)}
    Events produced: {', '.join(event_names)}
    """
    # TODO: Add fields
    # TODO: Implement command methods
    # TODO: Enforce invariants
    pass
''')

            # Value objects
            for vo in aggregate.get('value_objects', []):
                vo_file = domain_dir / f'{to_snake_case(vo)}.py'
                with open(vo_file, 'w') as f:
                    f.write(f'''"""
{vo} Value Object
Bounded Context: {context['name']}
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class {vo}:
    """
    Immutable value object. Equality is based on attributes, not identity.
    """
    # TODO: Add fields
    pass
''')

            # Events
            for event in aggregate.get('events', aggregate.get('events_produced', [])):
                if isinstance(event, dict):
                    event_name = event['name']
                    payload_fields = event.get('payload_fields', [])
                else:
                    event_name = str(event)
                    payload_fields = []

                payload_lines = '\n'.join(
                    f'    {field}: object  # TODO: type this field'
                    for field in payload_fields
                )

                event_file = events_dir / f'{to_snake_case(event_name)}.py'
                with open(event_file, 'w') as f:
                    f.write(f'''"""
{event_name} Domain Event
Produced by: {agg_name} aggregate
Bounded Context: {context['name']}
"""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class {event_name}:
    occurred_at: datetime
{payload_lines}
''')

            # Command handlers
            for cmd in aggregate.get('commands', aggregate.get('commands_handled', [])):
                if isinstance(cmd, dict):
                    cmd_name = cmd['name']
                    feature_files = cmd.get('feature_files', [])
                else:
                    cmd_name = str(cmd)
                    feature_files = []

                feature_refs = '\n'.join(
                    f'    - features/{ff}'
                    for ff in feature_files
                ) or '    - (no feature files linked yet)'

                cmd_file = app_dir / f'{to_snake_case(cmd_name)}_handler.py'
                with open(cmd_file, 'w') as f:
                    f.write(f'''"""
{cmd_name} Command Handler
Targets: {agg_name} aggregate
Bounded Context: {context['name']}

Implements behavior from:
{feature_refs}
"""
from dataclasses import dataclass


@dataclass
class {cmd_name}Command:
    """TODO: Define command fields."""
    pass


class {cmd_name}Handler:
    def __init__(self, repository):
        self.repository = repository

    def handle(self, command: {cmd_name}Command):
        """
        TODO: Implement
        1. Load aggregate from repository
        2. Execute command on aggregate
        3. Save aggregate
        4. Publish domain events
        """
        raise NotImplementedError
''')

    _print_summary(model, output_dir)


def main():
    parser = argparse.ArgumentParser(
        description='Generate code scaffold from blueprint.yaml or domain-model.json'
    )
    parser.add_argument(
        '--model', required=True,
        help='Path to blueprint.yaml (preferred) or domain-model.json (legacy)'
    )
    parser.add_argument('--output', required=True, help='Output directory (e.g., src/)')
    parser.add_argument('--lang', required=True, choices=['typescript', 'python'],
                        help='Target language')
    args = parser.parse_args()

    model = load_model(args.model)

    if args.lang == 'typescript':
        generate_typescript(model, args.output)
    elif args.lang == 'python':
        generate_python(model, args.output)


if __name__ == '__main__':
    main()
