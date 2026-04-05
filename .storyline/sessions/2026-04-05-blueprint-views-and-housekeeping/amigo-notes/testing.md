# Testing Amigo — Ronde 1: Blueprint Size & Housekeeping

Two problems on the table: blueprints that grow too large to handle, and housekeeping that agents forget to do. Both are real — I have seen the evidence in the existing blueprint (690 lines for a meta-project, real projects hit 2500+). But the proposed solutions each come with their own failure modes. Let me walk through what can go wrong.

## Problem 1: Blueprint Too Large — What Breaks When You Split It

### The referential integrity problem

The blueprint has cross-references everywhere. Events reference aggregates. Policies reference events AND commands (potentially in different contexts). Relationships reference other context names. Glossary references context names. Gaps and questions reference context names via `affects`.

If you split the blueprint into sections (say, one file per bounded context plus a shared glossary/gaps/questions file), every agent now needs to know which sections to read. But the whole point of the blueprint was that agents read ONE file and understand the system. Split it, and you have a coordination problem: which sections does Sticky Storm need? All of them — because events must be unique across ALL aggregates in the entire blueprint (that is an existing invariant). Doctor Context needs all of them too — relationships cross context boundaries by definition.

**Edge case: partial reads lead to false validation.** If an agent reads only the "Payment" context and adds an event called "OrderPlaced" — that name might already exist in the "Ordering" context. The agent would not know. Validation only catches this if you validate the reassembled whole, but the agent does not have the whole in memory.

**Edge case: merge conflicts on reassembly.** Two agents edit different sections simultaneously. Agent A adds an event to Payment. Agent B adds a relationship from Ordering to Payment. When you reassemble, the YAML might be structurally valid but semantically broken — the relationship might reference something Agent A renamed.

### The "minimum viable section" question

What is the smallest piece an agent can work with safely? I see three possible granularities:

1. **Per bounded context** — but policies and relationships cross boundaries
2. **Per aggregate** — too small, loses the context-level invariants and relationships
3. **Context + its dependencies** — dynamic, hard to compute, and might end up being most of the blueprint anyway for a well-connected system

For a 2500-line blueprint with 6 bounded contexts, cutting by context gives you ~400 lines per context plus ~200 for shared sections. That is better but not transformative. And you have added complexity that every agent must understand.

### The "smart extraction" alternative and its risks

Instead of splitting the file, you could have a CLI command like `blueprint extract --context Payment --with-deps` that produces a read-only view. The agent reads the extract, works on it, and the CLI merges changes back.

**What can go wrong:** The extract is a snapshot. If another agent changes the blueprint while this agent is working on the extract, the merge will conflict. There is no locking mechanism. Claude Code agents run sequentially in practice (one subagent at a time within a session), but "The Crew" mode dispatches Developer and Testing amigos in sequence — what if the Developer's commit changes the blueprint structure before Testing reviews it?

### Stale data after splitting

If sections are cached or extracted, staleness becomes a real risk. Right now, reading the full blueprint guarantees you see the current state. Any caching layer introduces a window where agents work with outdated information. The PostToolUse hook currently auto-validates on blueprint edits — this works because there is one file. With multiple files or extracts, what triggers validation?

## Problem 2: Housekeeping Not Enforced — What Breaks When You Force It

### The "last todo is always housekeeping" approach

The idea: every phase ends with a housekeeping todo that validates, stamps, and cleans up. This is sensible. But I have concerns about what happens when that housekeeping step fails.

**Scenario: Validate finds errors mid-phase.** Agent has been working for 15 minutes. Makes 12 edits. The housekeeping step runs `blueprint validate` and finds 3 errors. Now what?

- The agent tries to fix the errors. But it has already moved on mentally — its context window has scrolled past the blueprint edits.
- The fix introduces new errors (agent is tired, token budget is depleting).
- The user is stuck in an error-fix loop at the end of the phase, which feels worse than catching errors early.

**Better alternative already exists:** The PostToolUse hook already auto-validates on every blueprint edit. This catches errors immediately, not at the end. The problem the user reported is that agents "forget" to validate — but the hook does it for them automatically. The real gap might be that the hook output is not forceful enough, or that agents do not act on the validation warnings.

### Cleanup deleting things still needed

The workbench is described as "transient" — replaced each pipeline run. But what counts as "the current run"?

**Edge case: user runs Three Amigos, pauses, comes back 3 days later, runs Mister Gherkin.** If the pause triggered cleanup, the example-map.yaml is gone. Mister Gherkin has no input.

**Edge case: user re-runs Three Amigos for the same feature.** The old example-map should be replaced. But what if the user wants to compare old vs. new? Git history is the answer according to the design — but only if the old version was committed. If cleanup happens before commit, the old version is lost entirely.

**Edge case: estimation-report.md tied to a specific plan.** The report references task counts and files from a particular plan. If a new phase runs and cleanup deletes the report, the user loses the estimate they might have shared with stakeholders.

### What if the agent ignores the housekeeping todo?

Todos are advisory. There is no mechanism to prevent an agent from marking a todo "completed" without actually doing the work. The SubagentStop hook checks persona memory updates — there is precedent for checking post-conditions. But there is no equivalent hook that checks "was the blueprint validated and stamped before this agent stopped?"

**Proposed invariant that is not yet enforced:** "Blueprint must be validated and stamped before any commit." This is stated in the blueprint invariants but there is no hook that blocks `git commit` if the blueprint is dirty or unstamped. A PreCommit hook could enforce this, but Claude Code hooks currently support SessionStart, PostToolUse, and SubagentStop — not PreCommit or PreGitCommit.

### The "validate after stamp" ordering problem

The stamp command validates first, then stamps. Good. But what if the agent runs `blueprint validate` (passes), then makes one more edit, then runs `blueprint stamp`? The stamp re-validates, but the agent might have introduced an error in that last edit that the PostToolUse hook flagged but the agent ignored.

This is a timing window. Small but real in longer sessions.

## Concurrent Access

Claude Code runs one main thread, but subagents are dispatched. In "The Crew" mode, agents run sequentially (Developer builds, then Testing reviews). But there is no explicit lock on blueprint.yaml. If the architecture ever changes to parallel subagents editing the blueprint — and the Three Amigos Ronde 1 already dispatches agents in parallel — there is a race condition waiting to happen.

Right now, Ronde 1 agents write to their own notes files (no shared resource contention). But if blueprint splitting introduces per-context files, and two agents are assigned to contexts that have relationships... that is a real conflict.

## Workbench Lifecycle — When Is Cleanup Safe?

Based on my reading:

| Artifact | Created by | Consumed by | Safe to clean after |
|---|---|---|---|
| example-map.yaml | Three Amigos | Mister Gherkin | Mister Gherkin completes |
| events-raw.md | Sticky Storm | Doctor Context | Doctor Context completes |
| amigo-notes/*.md | Three Amigos agents | Foreman (synthesis), Crew (build) | Build completes |
| estimation-report.md | The Appraiser | User/stakeholders | Never auto-clean (user artifact) |

The problem: "safe to clean after X completes" requires knowing what phase you are in. There is no explicit phase tracking beyond the TodoWrite items (which are per-session, not persisted). If the session ends between phases, there is no way to know whether cleanup already happened.

**Missing scenario in feature files:** There is no scenario for "workbench cleanup" in any existing feature file. The concept is described in SKILL.md ("replaced each pipeline run") but there is no behavioral specification for WHEN cleanup happens, WHO triggers it, or WHAT happens if it fails.

## Missing Sad Paths in Existing Feature Files

After reading all six feature files, here is what I see missing:

### blueprint-management.feature
- No scenario for: stamp fails because of file permission errors
- No scenario for: validate on a corrupted YAML file (syntax errors, not schema errors)
- No scenario for: concurrent edits (two CLI commands running simultaneously)
- No scenario for: blueprint exceeds a size threshold (the exact problem being discussed)
- No scenario for: add-command references a feature file that exists but is empty

### orchestration.feature
- No scenario for: Surveyor subagent fails or times out
- No scenario for: Foreman invoked with `build` but no plans exist
- No scenario for: plan file exists but is corrupted or empty
- No scenario for: Crew mode but one amigo fails mid-build
- No scenario for: as-built survey finds major deviations from the plan
- No scenario for: security audit finds critical issues (the scenario says "must be fixed" but there is no scenario for what happens if the fix fails)

### discovery.feature
- No scenario for: persona agent produces empty notes file
- No scenario for: persona agent writes to the wrong file
- No scenario for: full session with all 5 amigos (core 3 + frontend + security simultaneously)
- No scenario for: Ronde 2 but one agent's Ronde 1 notes are missing
- No scenario for: example-map.yaml already exists from a previous run

### implementation.feature
- No scenario for: acceptance test cannot be written because the Gherkin scenario is too vague
- No scenario for: scaffold overwrites existing code
- No scenario for: plan references bounded contexts that no longer exist in the blueprint

## Security Considerations

- Blueprint splitting introduces more files that could be tampered with. Currently there is one file to protect; splitting creates N+1 files.
- The PostToolUse hook passes tool_input through Python's json.loads — GAP-005 already flags this, but with blueprint splitting the attack surface grows.
- Workbench files are committed to git. If cleanup is automated, an agent could accidentally commit a cleanup that removes evidence of a security audit finding.

## Mijn top-3 vragen voor de sessie

1. **If blueprint validation catches errors at the end of a phase (housekeeping todo) instead of immediately (PostToolUse hook), what is the recovery path?** The hook already validates on every edit — the real question is why agents are not acting on the hook's output, and whether the fix is behavioral (better prompting) or structural (blocking further edits until errors are resolved).

2. **What is the minimum viable "blueprint view" that an agent can safely work with while still maintaining referential integrity?** Before implementing any splitting strategy, we need to define exactly which cross-references must be visible. My analysis suggests that for most agents, you need at least the target context + all contexts it has relationships with + the full glossary — which might be 60-80% of the blueprint anyway.

3. **Who decides when workbench cleanup happens, and what happens if the user wants to keep old artifacts?** The design says "git history is the archive" — but only if artifacts were committed before cleanup. There is no scenario that ensures commit-before-cleanup ordering, and no hook that enforces it.

## Ronde 2 — Reacties

### Op Developer Amigo

**De summary/view CLI-aanpak is verstandig, maar creert nieuwe faalscenario's.**

De aanbeveling `blueprint summary` + `blueprint view --context X` is de veiligste weg. Ik ben het eens dat dit beter is dan het bestand opsplitsen. Maar er zijn concrete risico's die ik wil vastleggen:

1. **Stale summary.** Een agent leest de summary, besluit op basis daarvan om context "Payment" te bewerken, vraagt het detail op met `view --context Payment`. Maar tussen de summary-read en de view-read heeft een andere stap de blueprint al gewijzigd. De summary toonde 3 aggregates in Payment, maar nu zijn het er 4. De agent werkt met een mentaal model dat niet klopt. In de praktijk is dit risico klein (sequentiele uitvoering), maar het is een scenario dat getest moet worden.

2. **De summary liegt door weglating.** Dit is het kernprobleem. De gebruiker vroeg: "Wat heeft een agent NODIG voor een werkend mentaal model?" Het antwoord hangt af van de taak. Sticky Storm moet ALLE events over ALLE contexten zien om uniciteit te garanderen. Doctor Context moet ALLE relaties zien om refactoring-adviezen te geven. Three Amigos hoeft misschien alleen de relevante context + glossary te zien. Er is geen one-size-fits-all summary. De Developer moet per skill defnieren welke "view" nodig is, en dat is domeinkennis, niet techniek.

3. **View retourneert geen referentiele context.** `blueprint view --context Payment` geeft Payment terug. Maar als Payment een relatie heeft met Ordering ("Payment consumes OrderPlaced from Ordering"), dan mist de agent de definitie van OrderPlaced. De view moet optioneel de dependencies meenemen: `blueprint view --context Payment --with-deps`. Zonder die optie krijg je agents die verwijzingen leggen naar dingen die ze niet volledig begrijpen.

4. **Edit na view werkt niet.** Developer Amigo zegt zelf: "De agent moet nog steeds het hele bestand lezen om een Edit te doen." Dit is cruciaal. De view vermindert de READ-kosten maar niet de EDIT-kosten. Voor Edit moet de old_string exact matchen met wat in het echte bestand staat. Als de agent alleen de view heeft gelezen, kent het de exacte string niet (de view is een gefilterde weergave). Dus het patroon wordt: lees summary -> besluit wat je wilt doen -> lees het hele bestand OF gebruik CLI-commando's voor mutaties. De token-besparing is dan alleen bij de orientatiefase, niet bij de bewerkingsfase. Dat is nog steeds waardevol, maar het is niet de 80% reductie die de Developer schatte.

**PostToolUse mist Bash `blueprint add-*` calls -- dit is een significante gap.**

De Developer identificeert terecht dat PostToolUse alleen triggert op Edit|Write, niet op Bash. Alle `blueprint add-event`, `blueprint add-command`, etc. gaan via Bash. Dit betekent dat de meest voorkomende blueprint-mutaties NIET automatisch gevalideerd worden. De validatie die we dachten te hebben, bestaat niet voor het meeste schrijfwerk.

Hoe groot is deze gap? De CLI-commando's valideren intern (de `add-*` functies in blueprint.py roepen validate aan voor ze schrijven). Maar als de CLI-call zelf faalt -- timeout, malformed arguments, of de agent geeft de verkeerde context-naam -- dan is er geen vangnet. De PostToolUse hook was dat vangnet voor Edit-based mutaties. Voor CLI-based mutaties is er geen vangnet.

De voorgestelde fix (PostToolUse matcher uitbreiden naar Bash met command-parsing) is fragiel maar noodzakelijk. Mijn zorg: de Bash tool_input bevat het volledige commando inclusief arguments. Parsen of een Bash-call een `blueprint` commando is, vereist string matching op de command-string. Wat als de agent het commando in een `&&`-chain zet? Bijv. `cd /path && blueprint add-event --context Payment ...`? De string "blueprint" staat er wel in, maar de parser moet robuust genoeg zijn om dit te vangen.

**`blueprint housekeeping --phase` heeft ongeteste randgevallen.**

De Developer stelt een housekeeping-commando voor dat validate + stamp + cleanup doet. Goede richting. Maar het `--phase` argument introduceert problemen:

- Wat als `--phase` ontbreekt? Ruim je dan alles op of niets? "Alles" is gevaarlijk (je verwijdert bestanden die de volgende fase nodig heeft). "Niets" maakt het argument verplicht, maar agents kunnen het verkeerde meegeven.
- Wat als `--phase` een ongeldige waarde heeft? De fases zijn niet formeel gedefinieerd als enum. "three-amigos" vs. "three_amigos" vs. "Three Amigos" vs. "discovery" -- welke spelling is correct? Zonder strikte validatie gaat de cleanup de verkeerde bestanden verwijderen of helemaal niets doen.
- Wat als de cleanup bestanden wil verwijderen die niet gecommit zijn? Dit is het scenario dat ik in Ronde 1 al noemde: commit-voor-cleanup volgorde is niet gegarandeerd. Het housekeeping-commando zou dit moeten checken: `git status` op de te-verwijderen bestanden, en weigeren als er uncommitted changes zijn.
- Wat als de agent het housekeeping-commando twee keer aanroept? Idempotent als validate + stamp niets verandert, maar cleanup zou bestanden proberen te verwijderen die al weg zijn. Moet een no-op zijn, geen error.

**Testscenario's die ik zou schrijven voor `blueprint housekeeping`:**

```
Scenario: housekeeping zonder --phase valideert en stampt maar ruimt niet op
Scenario: housekeeping met ongeldige fase geeft een duidelijke foutmelding
Scenario: housekeeping weigert cleanup als er uncommitted workbench-bestanden zijn
Scenario: housekeeping is idempotent bij herhaalde aanroep
Scenario: housekeeping na een fase die geen workbench-bestanden produceerde
Scenario: housekeeping detecteert dat de blueprint al gestampt is en skipt stamp
Scenario: housekeeping als de blueprint validatie-fouten heeft -- stopt het of gaat het door met cleanup?
```

### Op Product Amigo

**Token-kosten zijn reeel, maar de summary lost het alleen voor reads op.**

Product Amigo schat 7500-12500 regels aan blueprint-reads per Three Amigos sessie. Dat is correct en alarmerend. Maar de summary lost dit alleen op voor de orientatiefase. Zodra een agent moet EDITEN, leest het alsnog het hele bestand (of een groot deel ervan). De echte token-besparing zit bij agents die de blueprint alleen LEZEN en niet bewerken: Three Amigos persona-agents, The Appraiser, de security audit. Dat zijn inderdaad de meeste reads.

Voor agents die WEL bewerken (Sticky Storm, Doctor Context, The Onion), is de besparing kleiner. Die agents doen hun mutaties via CLI-commando's (die het bestand intern lezen), maar ze moeten het bestand ook lezen om te BEGRIJPEN wat er al is. De view helpt hier -- ze lezen een deel in plaats van het geheel.

Netto schat ik een reductie van 40-60%, niet 80%. Nog steeds significant.

**"Agents working with incomplete data" is een nieuw risico, geen oplossing voor een bestaand risico.**

Product Amigo wil dat agents niet meer betalen voor data die ze niet nodig hebben. Fair. Maar het gevaar is dat we gaan naar een model waar agents werken met incomplete informatie en foute aannames maken. De huidige situatie is duur maar correct: lees alles, weet alles. De voorgestelde situatie is goedkoper maar riskanter: lees minder, weet misschien niet genoeg.

De kernvraag van de gebruiker was precies dit: "Wat heeft een agent NODIG?" Het antwoord is niet uniform. Het hangt af van de agent, de taak, en de staat van het project. Dit moet GETEST worden -- niet door een theorie over wat genoeg is, maar door concrete scenario's waarin een agent met een summary een foute beslissing neemt die het niet gemaakt zou hebben met het volledige bestand.

**De spanning tussen "minimale context" en "referentiele integriteit" is het echte ontwerpprobleem.**

Ik formuleer dit als een invariant: **Een agent dat een deel van de blueprint leest, mag geen mutatie doen die een andere agent's werk breekt, tenzij de validatie dit vangt voor de commit.**

Dit betekent in de praktijk: het is ACCEPTABEL dat een agent werkt met een view, zolang de validatie achteraf (PostToolUse of housekeeping) het hele bestand controleert. De view is een lees-optimalisatie; de validatie blijft globaal. Dit model werkt, maar alleen als de validatie ALTIJD draait na elke mutatie. En dat is precies de gap die de Developer identificeerde: CLI-mutaties via Bash triggeren geen PostToolUse validatie.

Dus de prioriteit is helder:
1. Eerst: fix de validatie-gap (PostToolUse voor Bash-calls)
2. Dan: voeg summary/view toe (token-reductie)
3. Dan: housekeeping-commando (cleanup)

De volgorde is belangrijk. Views zonder waterdichte validatie is gevaarlijker dan het huidige systeem.

### Samenvatting van mijn positie

De summary/view aanpak is de juiste richting. Maar de volgorde van implementatie moet zijn: **fix de validatie-gap eerst, dan views, dan cleanup.** Anders introduceren we token-besparing ten koste van correctheid, en dat is precies het soort afweging dat op de lange termijn duurder uitvalt.

De housekeeping-command is nodig maar moet defensief ontworpen worden: weiger gevaarlijke acties (cleanup zonder commit), wees idempotent, valideer fase-namen strikt.

## Mijn top-3 vragen voor de sessie (bijgewerkt na Ronde 2)

1. **Moeten we de validatie-gap (PostToolUse mist Bash-calls) fixen VOOR we summary/view bouwen?** Mijn positie: ja. Views zonder waterdichte validatie is riskanter dan het huidige systeem. Maar ik hoor graag of de Developer denkt dat de interne validatie in de CLI-commando's voldoende vangnet is.

2. **Hoe testen we of een summary voldoende informatie bevat voor een specifieke agent-taak?** Ik stel voor: neem een concreet scenario (bijv. Sticky Storm moet een nieuw event toevoegen), voer het uit met alleen de summary, en kijk of het resultaat correct is. Dit is een integratietest op agent-niveau.

3. **Moet `blueprint housekeeping` weigeren om bestanden te verwijderen die niet gecommit zijn?** Ik zeg ja -- het is de enige manier om dataverlies te voorkomen. Maar dit betekent dat de agent eerst moet committen voor het housekeeping draait, wat een extra stap is die ook vergeten kan worden.
