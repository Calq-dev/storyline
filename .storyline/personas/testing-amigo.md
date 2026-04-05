# Testing Amigo — Project Notes

## Blueprint Architecture & Risks
- Blueprint.yaml is a single file. 690 lines for this meta-project, 2500+ for real projects.
- Referential integrity crosses bounded context boundaries: events, policies, relationships, glossary all have cross-references.
- The PostToolUse hook only validates Edit/Write operations, NOT Bash-based `blueprint add-*` CLI calls. This is a significant validation gap — most structural mutations go through Bash.
- The CLI commands (add-event, add-command, etc.) do validate internally before writing, so there IS a safety net, but there is no external vangnet if the CLI call itself fails or is malformed.

## Housekeeping & Cleanup Risks
- No mechanism currently enforces validate+stamp+cleanup at phase boundaries.
- PostToolUse validates after Edit/Write but does not stamp. There is no PreCommit hook in Claude Code.
- Workbench files are declared "transient" but nothing enforces cleanup. No scenario specifies when cleanup happens.
- Key invariant I proposed: commit-before-cleanup ordering must be enforced. Otherwise git history cannot serve as the archive.
- Estimation reports (workbench) should NEVER be auto-cleaned — they are user-facing artifacts.

## Blueprint Views (Summary/View Approach)
- Agreed direction: `blueprint summary` + `blueprint view --context X` is safer than splitting the file.
- Summary reduces READ tokens but not EDIT tokens. Agent must still read full file (or use CLI) for mutations.
- Estimated real-world token reduction: 40-60%, not the 80% the Developer estimated.
- Critical gap: `view --context X` does not include dependency contexts. Needs a `--with-deps` flag.
- Core design tension: views are a read optimization; validation must remain global (whole-file).

## Implementation Priority (My Position)
1. Fix validation gap (PostToolUse for Bash calls) — without this, views are dangerous
2. Add summary/view CLI commands — token reduction
3. Add housekeeping command — defensive design, idempotent, refuses cleanup without commit

## Missing Test Coverage
- No sad-path scenarios for: blueprint size thresholds, corrupted YAML, concurrent edits, empty feature files
- No scenarios for workbench cleanup lifecycle at all
- No scenarios for agent failure mid-build in Crew mode
- No scenarios for housekeeping command (does not exist yet)

## Session Patterns
- Three Amigos Ronde 1 dispatches persona agents in parallel (write to separate files, no shared-resource contention)
- Ronde 2 is sequential read-react — no concurrency risk here
- Crew mode is sequential (Developer then Testing) — but blueprint could change between the two

## Things To Watch Out For
- Any solution that relies on agent discipline (prompt instructions alone) will fail in long sessions. Already proven by the housekeeping problem.
- String matching on Bash command content for PostToolUse is fragile — commands can be chained with `&&`, wrapped in subshells, etc.
- Phase names are not formally defined as an enum anywhere. Any CLI that accepts `--phase` must validate strictly or agents will pass inconsistent values.
