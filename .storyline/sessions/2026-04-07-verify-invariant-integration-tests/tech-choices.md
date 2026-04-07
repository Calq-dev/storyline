# Tech Choices — Scaffold from Blueprint (scaffold.ts port)

Generated: 2026-04-05
Tech stack: TypeScript / Node.js 18+ via tsx, npm

---

## YAML parsing

**Recommendation:** `yaml` ^2.7.0 (already installed)
**Reason:** The project already depends on `yaml` and uses it in `scripts/blueprint.ts` via `parseDocument` / `.toJSON()`. The same two-line pattern (`readFileSync` + `yaml.parse`) covers the scaffold's needs: load `blueprint.yaml`, call `.toJSON()`, done. `ruamel.yaml`'s preserve-quotes behaviour was only relevant in Python because ruamel was also used for round-trip writes. The scaffold only reads YAML — no write-back needed — so plain parse is sufficient.
**Alternatives considered:** none warranted. `js-yaml` (~1M weekly downloads, MIT) is the only other credible option, but adding a second YAML library when `yaml` is already present would be wasteful.
**Install:** already present — no action required.

---

## JSON parsing

**Recommendation:** Build it yourself
**Reason:** `JSON.parse(readFileSync(path, 'utf-8'))` is one line. No package is needed or appropriate.

---

## File and directory I/O

**Recommendation:** `node:fs` and `node:path` (built-ins)
**Reason:** `mkdirSync({ recursive: true })`, `writeFileSync`, and `existsSync` from `node:fs` map exactly to Python's `os.makedirs(exist_ok=True)` and `open(..., 'w')`. Already used extensively in `scripts/blueprint.ts`. No third-party package (e.g. `fs-extra`) is justified — the built-ins do everything the scaffold needs.

---

## CLI argument parsing

**Recommendation:** `node:util` `parseArgs` (built-in)
**Reason:** `parseArgs` (stable since Node.js 18.3) handles `--model`, `--output`, and `--lang` without boilerplate. This is the exact pattern used in `scripts/blueprint.ts` and `scripts/changeset.ts`. `commander` or `yargs` would be over-engineered for three flags.

---

## String case conversion (PascalCase to kebab-case / snake_case)

**Recommendation:** Build it yourself
**Reason:** The Python script implements `to_snake_case` and `to_kebab_case` in ~10 lines total. The TypeScript equivalent is the same length — a single regex replace (`/([A-Z])/g`) plus a `.toLowerCase()` chain. No package (e.g. `change-case`, 200KB+) is warranted for two pure functions this small.

---

## Code template generation (multi-line file content)

**Recommendation:** Build it yourself — ES2015 template literals
**Reason:** All scaffolded file content is produced via tagged template literals in the Python script. TypeScript's native template literals are a direct replacement. No templating engine (Handlebars, EJS, Mustache) is needed: the templates are static structure with a handful of string interpolations, not dynamic partials or loops that a template engine would simplify.

---

## Summary

No new packages are required for this port. The entire scaffold.ts can be implemented using:

- `yaml` (already installed) — YAML loading
- `node:fs` — file and directory creation
- `node:path` — path joining
- `node:util` `parseArgs` — CLI flags
- Native TypeScript — case conversion, template literals, JSON.parse

The `bin/storyline` dispatcher needs one line added: when the first argument is `scaffold`, shift and exec `scripts/scaffold.ts`. This follows the existing pattern for `changeset`.
