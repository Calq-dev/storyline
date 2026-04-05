# Feature: Fill scaffold.feature gaps found during implementation

**Source:** Post-implementation refinement (Developer + Testing Amigo, 2026-04-05)
**Priority:** Should have

## Missing scenarios to add

- Value object file generation (TypeScript: `payment/domain/money.ts`, Python: `payment/domain/money.py`)
- Python event file generation and Python command handler file generation
- `root_entity` falls back to aggregate name when field is absent
- TypeScript empty aggregate: `infrastructure/` also skipped (not just `application/`)
- Python vs TypeScript divergence: Python always creates `application/` and `infrastructure/`, TypeScript skips them when no commands
- Sad path: invalid `--lang` value (e.g. `--lang ruby`) → clear error message
- Sad path: missing required argument (`--model`, `--output`, or `--lang`) → usage error
- `toSnakeCase` acronym behaviour (`InvoiceID` → `invoice_i_d`) documented in spec
- Idempotency: running scaffold twice on same output dir silently overwrites (document this as expected behaviour)
- Legacy `events_produced`/`commands_handled` alias fields still work
