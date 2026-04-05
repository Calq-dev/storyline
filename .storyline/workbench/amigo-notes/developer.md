# Developer Amigo -- Ronde 1: Technische Analyse

## De twee problemen, bekeken vanuit de code

### Probleem 1: Blueprint te groot (2500+ regels)

**Wat ik in de code vond.** De huidige `blueprint.yaml` voor dit project (de plugin zelf) is al 690 regels. Een echt project met 6+ bounded contexts, 20+ aggregates, en uitgebreide glossary/gaps/questions komt makkelijk op 2500+. Elke skill begint met "Read `.storyline/blueprint.yaml`" -- dat is de eerste instructie in zowel The Foreman, Three Amigos, als alle subagents.

Het tokenverbruik is dubbel: de agent leest het bestand (input tokens), en bij elke Edit moet de `old_string` voldoende context bevatten om uniek te zijn (meer tokens, meer kans op mismatch).

**Technische opties voor opsplitsing:**

1. **Blueprint-per-context bestanden** -- bijv. `.storyline/contexts/Payment.yaml`, `.storyline/contexts/Ordering.yaml`, met een dun root-bestand dat alleen `meta`, `tech_stack`, en een lijst van context-namen bevat. Dit is de meest ingrijpende optie.
   - *Pro:* Agents lezen alleen de context die ze nodig hebben.
   - *Contra:* Referentiele integriteit (relaties, policies, glossary) gaat over meerdere bestanden. De hele `blueprint.py` CLI moet herschreven worden. Elke skill die "lees de blueprint" zegt moet weten welke context(en) relevant zijn. De `validate` stap moet alle bestanden laden.

2. **Blueprint views via CLI** -- `blueprint view --context Payment` dat alleen dat deel van de YAML teruggeeft, of `blueprint summary` dat een compact overzicht geeft (namen, counts, geen details). De blueprint zelf blijft een enkel bestand.
   - *Pro:* Geen schema-wijziging. Backward compatible. Skills vragen een "view" in plaats van het hele bestand te lezen.
   - *Contra:* Nog steeds een groot bestand op disk. Edit-operaties vereisen nog steeds het hele bestand.

3. **Sectie-gebaseerde reads** -- Skills lezen het blueprint-bestand met offset/limit, of de CLI biedt `blueprint get-section bounded_contexts[Payment]` dat een specifiek YAML-pad teruggeeft.
   - *Pro:* Eenvoudigste wijziging. Geen schemabreuk.
   - *Contra:* YAML-bestanden hebben geen stabiele byte-offsets. De CLI-aanpak is robuuster.

4. **Blueprint summary als standaard** -- Een nieuw CLI-commando `blueprint summary` dat een compacte weergave geeft: context-namen, aggregate-namen, command/event counts, gap/question counts. Skills lezen standaard de summary en pas wanneer ze een specifieke context nodig hebben, vragen ze het detail.
   - *Pro:* Token-reductie van 80%+ voor de meeste leesbeurten. Backward compatible.
   - *Contra:* Vereist dat skills weten wanneer ze detail nodig hebben vs. summary.

**Mijn aanbeveling:** Optie 2+4 gecombineerd. Voeg twee CLI-commando's toe: `blueprint summary` (compact overzicht) en `blueprint view --context X` (detail per context). Pas de skills aan om standaard de summary te lezen en alleen bij gerichte bewerkingen het detail op te vragen. Het bestand blijft een enkel YAML -- geen schemabreuk, geen migratie.

### Probleem 2: Housekeeping niet afgedwongen

**Wat ik in de code vond.** Er zijn al drie hook-types actief in `hooks/hooks.json`:

- **SessionStart**: Installeert dependencies, toont blueprint status, synct crew agents.
- **PostToolUse** (matcher: `Edit|Write`): Valideert automatisch als een bestand dat op `blueprint.yaml` eindigt wordt bewerkt. Dit werkt al -- maar alleen voor directe Edit/Write. Als een agent `blueprint add-event` via Bash aanroept, triggert de PostToolUse hook op Bash niet.
- **SubagentStop** (matcher op amigo-namen): Checkt of persona memory is bijgewerkt.

**Waar de handhaving faalt:**

1. **PostToolUse vangt niet alles.** De matcher is `Edit|Write`, maar blueprint-mutaties via `blueprint add-*` CLI-commando's gaan via Bash. Die worden niet gevangen. De matcher zou uitgebreid moeten worden naar `Bash` met een check of het commando `blueprint` bevat, maar dat is fragiel -- je wilt niet elke Bash-call valideren.

2. **Er is geen "einde-van-fase" hook.** Claude Code hooks zijn gebonden aan tool-gebruik (PostToolUse), sessie-events (SessionStart, Stop), en agent-events (SubagentStop). Er is geen "PhaseComplete" of "BeforeCommit" hook. Je kunt niet automatisch "validate + stamp + cleanup" triggeren op het moment dat een fase klaar is.

3. **Stamp wordt vergeten.** Validate zit in PostToolUse, maar stamp niet. De redenering is dat stamp niet na elke edit moet -- alleen voor een commit. Maar er is geen PreCommit hook in Claude Code hooks.

4. **Workbench cleanup bestaat niet.** Nergens in de huidige code wordt workbench/ opgeruimd. De Foreman SKILL.md zegt "workbench/ files are transient -- replaced each run" maar er is geen mechanisme dat dit afdwingt.

**Technische opties voor handhaving:**

1. **PostToolUse op Bash uitbreiden** -- matcher `Edit|Write|Bash`, met een shell-check: als de output van de Bash-call `blueprint.yaml` bevat OF het commando `blueprint add` matcht, dan validate. Dit vangt CLI-mutaties.
   - *Pro:* Automatisch, geen agent-discipline nodig.
   - *Contra:* PostToolUse hooks ontvangen de tool_input via stdin. Voor Bash is dat het commando zelf. We kunnen parsen of het een `blueprint` commando was. Maar het wordt een complexer shell-script.

2. **Housekeeping als verplichte todo-stap** -- In elke skill een laatste todo-item: "Housekeeping: validate, stamp, cleanup workbench". Dit is beschreven in de prompt, niet afgedwongen door code.
   - *Pro:* Zichtbaar voor de gebruiker. Past in het bestaande TodoWrite patroon.
   - *Contra:* Vereist agent-discipline -- precies het probleem dat we proberen op te lossen.

3. **Housekeeping-script** -- Een nieuw CLI-commando `blueprint housekeeping` dat: (a) validate runt, (b) stamp als valid, (c) bestanden in workbench/ opruimt die ouder zijn dan de huidige sessie (of een expliciete lijst), (d) git add + git status toont.
   - *Pro:* Een enkel commando dat alles doet. Kan in PostToolUse, in SubagentStop, of in de skill-prompt.
   - *Contra:* Het "opruimen" is context-afhankelijk -- niet alle workbench-bestanden moeten weg na elke fase.

4. **SubagentStop hook uitbreiden** -- Na elke subagent (niet alleen amigos), controleer of de blueprint dirty is (gewijzigd maar niet gestampt). Als ja, waarschuw.
   - *Pro:* Vangt het geval dat een agent klaar is maar vergeten is te stampen.
   - *Contra:* Matcher moet breder worden. En het is een waarschuwing, geen afdwinging.

5. **PreCommit-achtige check via PostToolUse op git** -- matcher `Bash`, check of het commando `git commit` bevat, en als `.storyline/blueprint.yaml` in de staged files zit, validate dat het gestampt is.
   - *Pro:* Laatste vangnet voor de commit.
   - *Contra:* Complexe shell-logica in een hook. PostToolUse runt na de tool, niet ervoor -- dus de commit is al gedaan als de hook faalt.

**Mijn aanbeveling:** Combinatie van opties 1, 3, en de todo-aanpak:
- Breid PostToolUse uit om ook Bash-calls die `blueprint` bevatten te valideren.
- Maak een `blueprint housekeeping [--phase X]` commando dat validate + stamp + cleanup doet.
- Laat elke skill eindigen met een verplichte "Housekeeping" todo-stap die dat commando aanroept.
- De todo-stap maakt het zichtbaar; de PostToolUse hook vangt wat erdoorheen glipt.

## Complexiteitsbeoordeling

| Onderdeel | Complexiteit | Toelichting |
|---|---|---|
| `blueprint summary` CLI | Laag | Pure Python, leest YAML, schrijft compact formaat. Halve dag werk. |
| `blueprint view --context X` CLI | Laag | Filter op context-naam, geef YAML-subset terug. |
| Skills aanpassen voor summary-first | Middel | Elke SKILL.md moet herschreven worden. 7 skills + 9 agents. Veel tekst, weinig logica. |
| PostToolUse uitbreiden voor Bash | Laag | Shell-scripting in hooks.json. Parsen van tool_input voor Bash-commando. |
| `blueprint housekeeping` CLI | Laag-Middel | Validate + stamp is triviaal. Cleanup-logica vereist nadenken over welke bestanden wanneer weg mogen. |
| Blueprint opsplitsen in meerdere bestanden | Hoog | Schemabreuk, CLI herschrijven, alle skills/agents aanpassen, migratie voor bestaande projecten. Weken werk. |

## Architectuuroverwegingen

**Wat past in de huidige patronen:**
- CLI-commando's toevoegen aan `blueprint.py` past perfect -- het is al het uitbreidpunt.
- Hooks uitbreiden in `hooks.json` past in het bestaande patroon.
- TodoWrite met housekeeping-stappen past in hoe skills nu al werken.

**Wat tegen de huidige architectuur ingaat:**
- Blueprint opsplitsen in meerdere bestanden breekt de kernbelofte: "single source of truth, one file."
- Elke oplossing die afhankelijk is van agent-discipline (prompt-instructies) zal uiteindelijk falen in lange sessies. We zien dat al.

**Belangrijk inzicht:** De echte waarde zit in de combinatie van token-reductie (summary) en automatische handhaving (hooks + CLI). Geen van beide lost het probleem alleen op.

## Wat ik niet weet / moet onderzoeken

**Over Claude Code hooks:**
- PostToolUse hooks draaien **na** de tool. Voor een Bash `git commit` commando betekent dat: de commit is al gedaan als de hook faalt. Er is geen manier om een commit te blokkeren via Claude Code hooks. Dit beperkt optie 5 hierboven.
- Hook stdout wordt als "system message" teruggestuurd naar de LLM. Een waarschuwing in een hook is dus een hint, geen blokkade.
- Hooks hebben een timeout en draaien synchroon. Een `blueprint validate` in PostToolUse kost ~200ms -- acceptabel.

**Over tool_input in hooks:**
- De PostToolUse hook ontvangt de tool_input via stdin als JSON. Voor Bash-calls bevat dit het commando. Voor Edit/Write bevat het file_path. Dit is al geimplementeerd in de huidige hook en werkt.

## Mijn top-3 vragen voor de sessie

1. Willen we de blueprint als een enkel bestand houden, of zijn we bereid de opsplitsing te doen? De summary/view aanpak is 10x eenvoudiger maar lost het Edit-probleem niet op (de agent moet nog steeds het hele bestand lezen om een Edit te doen).
2. Hoe ver gaan we met automatische handhaving? Een hook kan waarschuwen maar niet blokkeren. Is een waarschuwing + todo-stap genoeg, of willen we een harder mechanisme?
3. Welke workbench-bestanden mogen automatisch opgeruimd worden na welke fase? Dit is domeinkennis, niet techniek -- de Product Amigo moet hier meedenken.

---

## Ronde 2 -- Reacties

### Op de tokenkostenanalyse van Product Amigo

Product Amigo rekent: 5 agents x 2500 regels = 12.500 regels blueprint-reads per discovery sessie. Ik heb dat nagelopen tegen de werkelijke agent-dispatches.

**De werkelijke situatie is erger dan 5x.** Een volledige pipeline-run (Scout -> Three Amigos full session -> Mister Gherkin -> Sticky Storm -> Doctor Context -> The Onion) bevat minstens 8 blueprint-reads:
1. Foreman leest blueprint (detectie)
2. Scout leest blueprint
3. Product Amigo leest blueprint (of zou moeten)
4. Developer Amigo leest blueprint
5. Testing Amigo leest blueprint
6. Mister Gherkin leest blueprint (voor command-tags)
7. Sticky Storm leest blueprint (voor bestaande events)
8. Doctor Context leest blueprint (voor contexten + relaties)
9. The Onion leest blueprint (voor implementatieplan)

Dat is 9x de volledige blueprint. Bij 2500 regels is dat 22.500 regels aan input tokens, alleen aan blueprint-reads.

**Maar niet elke agent heeft dezelfde behoefte.** En dat brengt me bij de kernvraag van de gebruiker.

### De kernvraag: wat heeft een agent MINIMAAL nodig?

De gebruiker zei: "Wat heeft een agent eigenlijk NODIG in context om een werkend mentaal model van de software te hebben?" Dat is de juiste vraag. Ik heb per agent-type uitgewerkt wat er minimaal nodig is:

| Agent | Moet lezen | Kan skippen |
|---|---|---|
| Foreman | meta + context-namen + gap/question counts + tech_stack | aggregate details, glossary details |
| Scout | meta + tech_stack + context-namen | alles met detail |
| Product Amigo | meta + tech_stack + context descriptions + glossary + gaps + questions | aggregate internals (commands, events, policies) |
| Developer Amigo | meta + tech_stack + VOLLEDIGE context(en) waar de feature leeft + relaties van die context | andere contexten (alleen namen), glossary voor andere contexten |
| Testing Amigo | meta + VOLLEDIGE context(en) + invariants + gaps + questions die de feature raken | andere contexten (alleen namen) |
| Mister Gherkin | meta + de specifieke aggregate + command waar scenarios bij horen | alles buiten die context |
| Sticky Storm | ALLE contexten (event-uniciteit is een invariant), maar alleen events + commands + aggregates | glossary, gaps, questions, tech_stack details |
| Doctor Context | ALLE contexten volledig + glossary + relationships | gaps, questions (die maakt hij zelf) |
| The Onion | meta + tech_stack + specifieke context(en) voor de feature | andere contexten, glossary |

**Conclusie:** Alleen Sticky Storm en Doctor Context hebben echt het hele blueprint nodig. Alle andere agents kunnen met 20-40% van de blueprint toe. De Testing Amigo had gelijk dat sommige agents 60-80% nodig hebben -- maar dat geldt alleen voor de DomainModeling agents, niet voor het merendeel.

### Op Testing Amigo's punt over referentiele integriteit

Testing Amigo stelt: "referentiele integriteit vereist 60-80% van het blueprint." Dat klopt voor VALIDATIE, maar niet voor LEZEN.

Het onderscheid is cruciaal: een agent die de Payment-context bewerkt hoeft niet alle andere contexten in z'n context window te hebben. De agent hoeft alleen te weten dat die andere contexten BESTAAN (namen) en welke RELATIES er naar Payment verwijzen. Na de edit runt de PostToolUse hook `blueprint validate` op het VOLLEDIGE bestand -- die stap heeft altijd het hele bestand, want het is een CLI-commando dat het bestand van disk leest.

**De view hoeft dus niet referentieel volledig te zijn. De validatie is dat wel, en die draait al automatisch.**

Dit verandert het ontwerp van `blueprint view`: het hoeft geen "veilige subset" te zijn waar de agent blind mee kan werken. Het is een **leeshulp** die context geeft. De agent werkt met `blueprint add-*` CLI-commando's (die het hele bestand laden intern) of met Edit op het volledige bestand (waar de agent specifieke old_strings target). In beide gevallen is het de validatie-stap die integriteit borgt, niet de leesomvang.

**Concreet ontwerp voor blueprint views:**

```
blueprint summary
  -> meta + tech_stack + per context: naam, beschrijving, aggregate-namen, counts
  -> geschat 80-120 regels voor een 2500-regel blueprint

blueprint view --context Payment
  -> volledige Payment context + relationship targets (alleen namen)
  -> geschat 300-500 regels

blueprint view --context Payment --with-deps
  -> Payment context volledig + gerelateerde contexten volledig
  -> geschat 600-1200 regels (afhankelijk van hoeveel relaties)

blueprint view --section glossary
blueprint view --section gaps
blueprint view --section questions
  -> alleen die sectie
```

De skills worden aangepast om standaard `blueprint summary` te lezen, en pas bij gerichte edits het relevante detail op te vragen. Token-reductie: gemiddeld 70-85% per agent-read.

### Op Testing Amigo's punt over cleanup-timing

Testing Amigo noemt een reeel edge case: "commit before cleanup ordering." Als cleanup voor de commit draait, is het artifact weg zonder dat het in git zit.

**Mijn voorstel:** Cleanup wordt NOOIT automatisch getriggerd. In plaats daarvan:

1. De `blueprint housekeeping` CLI krijgt een `--cleanup` vlag die optioneel is.
2. Zonder `--cleanup` doet het commando alleen validate + stamp.
3. Met `--cleanup` doet het validate + stamp + archiveer-naar-git + verwijder workbench-bestanden.
4. Het `--cleanup` commando weigert te draaien als er uncommitted changes zijn in `.storyline/workbench/`.

Dit maakt de volgorde expliciet: commit eerst, cleanup daarna. En het is altijd een bewuste keuze, nooit een automatische actie die per ongeluk waardevolle bestanden weggooit.

**Wat betreft de estimation-report.md:** Testing Amigo heeft gelijk dat dit een user-artifact is. Mijn voorstel: verplaats het naar `.storyline/plans/` (naast de implementation plans) in plaats van workbench/. Dan overleeft het cleanup per definitie.

### Op Testing Amigo's catalogus van ontbrekende sad paths

De catalogus is grondig. Ik sorteer op implementatie-impact:

**Moeten we nu adresseren (raken de huidige feature):**
- "blueprint exceeds a size threshold" -- direct relevant, dit IS het probleem. Een scenario hiervoor scherpt onze oplossing aan.
- "validate finds errors mid-phase" -- relevant voor het housekeeping-ontwerp. Maar de PostToolUse hook vangt dit al per edit. Het scenario zou moeten beschrijven wat er gebeurt als de agent de hook-output negeert.

**Waardevol maar niet voor nu:**
- De concurrent-access scenarios zijn theoretisch zolang Claude Code agents sequentieel draaien. Als dat verandert, hebben we een groter probleem dan sad paths.
- De scaffold/plan-corruptie scenarios zijn edge cases die een robuustheidslaag toevoegen maar de kernfeature niet raken.
- De "Ronde 2 maar Ronde 1 notes ontbreken" is een goede catch -- dit scenario kan ik direct beschrijven omdat het nu letterlijk het patroon is dat we volgen.

**Niet nodig:**
- File permission errors op stamp -- dat is een OS-probleem, niet een domeinprobleem. De CLI kan een nette foutmelding geven maar er is geen domeinlogica voor.

### Samenvatting: wat ik nu zou bouwen

In volgorde van prioriteit:

1. **`blueprint summary` CLI-commando** -- laag-complex, hoge impact op token-reductie. Halve dag werk.
2. **`blueprint view --context X` CLI-commando** -- laag-complex, nodig voor gerichte edits. Samen met summary een dag.
3. **`blueprint housekeeping` CLI-commando** -- validate + stamp, optioneel cleanup. Halve dag.
4. **PostToolUse uitbreiden** -- Bash-calls met `blueprint` matchen. Een paar uur.
5. **Skills herschrijven voor summary-first** -- middel-complex, veel tekst. Twee dagen.
6. **estimation-report.md verplaatsen naar plans/** -- triviale wijziging.

Totaal: 4-5 dagen werk voor een oplossing die token-verbruik met 70-85% reduceert en housekeeping structureel borgt.

## Mijn top-3 vragen voor de sessie (herzien na Ronde 2)

1. Zijn we het eens dat de view-aanpak (summary + context-view) de juiste richting is, en dat we het blueprint-bestand NIET opsplitsen? De Testing Amigo's referentiele-integriteitsargument is geldig voor validatie maar niet voor leescontext -- de PostToolUse hook borgt integriteit los van wat de agent in z'n window heeft.
2. Accepteert iedereen dat cleanup NOOIT automatisch draait, maar altijd een expliciete stap is na een commit? Dit voorkomt het "artifact weg voor het gecommit is" probleem dat Testing Amigo aankaart.
3. Moeten we een scenario schrijven voor "agent negeert PostToolUse hook-output"? Testing Amigo vraagt terecht waarom agents niet op de hook-output reageren. Het antwoord is waarschijnlijk dat de hook-output niet dwingend genoeg is geformuleerd -- maar is dat een scenario of een prompt-tweak?
