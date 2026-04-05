# Product Amigo — Ronde 1

## Wat de gebruiker eigenlijk wil

De gebruiker heeft twee problemen die allebei hetzelfde symptoom delen: **de pipeline schaalt niet naar echte projecten**. Een 2500-regel blueprint is het bewijs dat de pipeline werkt — projecten worden complex genoeg om er serieus mee te modelleren. Maar juist dat succes ondermijnt de bruikbaarheid.

De diepere behoefte: **voorspelbaarheid en controle bij langere sessies.** De gebruiker wil niet hoeven twijfelen of de agent z'n huiswerk heeft gedaan (validate, stamp, opruimen). En de gebruiker wil niet betalen (in tokens en in risico op edit-fouten) voor het lezen van 2500 regels blueprint terwijl de agent maar 1 context nodig heeft.

Het todo-idee is eigenlijk een verzoek om **zichtbaarheid**: de gebruiker wil kunnen zien wat er gebeurt en controleren dat het afgemaakt wordt.

## Wat er al bestaat

**Blueprint-lezen:** Elke skill begint met "read .storyline/blueprint.yaml". De Foreman doet dat, Three Amigos doet dat, Sticky Storm doet dat. Er is geen mechanisme om een deel te lezen.

**Housekeeping-instructies:** De CLAUDE.md en skills schrijven voor dat agents moeten valideren, stampen, en committen na edits. Maar het is puur tekst-gebaseerde discipline — er is geen afdwinging behalve de PostToolUse hook die auto-validateert bij blueprint edits.

**PostToolUse hook:** Er bestaat al een hook die na blueprint edits valideert. Dat is een goed fundament, maar het dekt stamp en cleanup niet.

**Workbench:** Gedefinieerd als "transient" maar er is geen automatisch opruim-mechanisme. De definitie zegt "replaced each run" maar wie doet dat replacen?

## Scope-observaties

### Moet erin (MVP)

1. **Blueprint partitionering of slimmer lezen** — de kern van probleem 1. Zonder dit wordt elk real-world project duurder en foutgevoeliger naarmate het groeit. Dit raakt direct de value proposition: "alle kennis in een file" werkt alleen als die file beheersbaar blijft.

2. **Housekeeping als afdwingbare stap** — niet "hopen dat de agent het doet" maar structureel inbouwen. Of dat via todos gaat, via hooks, of via een combinatie maakt me niet uit — maar het resultaat moet zijn dat validate+stamp+cleanup ALTIJD gebeurt.

### Kan erin als het past

3. **Todo-zichtbaarheid per fase** — het idee van de gebruiker om werk in todos op te splitsen zodat ze kunnen meekijken. Dit is waardevol voor vertrouwen, maar het is een UX-verbetering, geen correctheidsprobleem.

4. **Workbench-cleanup automatisering** — specifiek: na een fase, ruim de workbench-bestanden op die bij die fase horen. Handig, maar als we het niet doen is het ergste dat er stale bestanden blijven liggen.

### Expliciet buiten scope

- Blueprint opsplitsen in meerdere YAML-bestanden (te grote refactor van alle tooling)
- Herstructureren van de blueprint-schema (de structuur is prima, het probleem is het leesvolume)
- Wijzigingen aan de blueprint.py CLI voor probleem 1 (tenzij Developer Amigo zegt dat het nodig is)

## Gebruikerstypen

Er zijn twee gebruikers:

1. **Plugin-consument** (het doelproject-team) — zij ervaren de pijn direct. Langzame sessies, agents die huiswerk vergeten, onvoorspelbaar gedrag in lange runs. Dit is de primaire gebruiker.

2. **Plugin-auteur** (de maker van nieuwe skills/agents) — zij moeten weten hoe ze blueprint-lezen en housekeeping inbouwen. Als de conventie verandert, moeten hun skills meedoen.

De fix moet transparant zijn voor plugin-consumenten (het werkt gewoon beter) en eenvoudig te volgen voor plugin-auteurs (duidelijke conventie).

## Business-risico's

1. **Token-kosten worden een dealbreaker.** Als elk agent-aanroep 2500 regels blueprint leest, en een Three Amigos sessie 3-5 agents dispatcht die elk de blueprint lezen, dan praat je over 7500-12500 regels alleen aan blueprint-reads per discovery sessie. Dat is niet duurzaam. Projecten die groeien worden gestraft.

2. **Vertrouwensverlies door vergeten housekeeping.** Als de blueprint niet gestampt is, of als er stale workbench-bestanden liggen die de volgende sessie vervuilen, dan verliest de gebruiker vertrouwen in de pipeline. Het hele punt van de pipeline is dat het betrouwbaarder is dan ad-hoc werken. Als het dat niet waarmaakt, waarom dan de overhead?

3. **Edit-fouten op grote bestanden.** Claude's Edit tool werkt op exact string matching. In een 2500-regel YAML is de kans op ambigue matches of fout-ingesprongen edits reeel. Dit is geen theoretisch risico — de gebruiker heeft dit in productie gezien.

4. **Scope creep naar blueprint-herstructurering.** Het is verleidelijk om te zeggen "we moeten de blueprint opsplitsen in meerdere bestanden." Dat is een enorme refactor die alle tooling raakt. We moeten een oplossing vinden die het leesvolume reduceert ZONDER de structuur te veranderen.

## Succescriteria

- Een agent die maar 1 bounded context nodig heeft, leest niet de hele blueprint
- Na elke fase is de blueprint gevalideerd en gestampt (aantoonbaar, niet op vertrouwen)
- De gebruiker kan in de todo-lijst zien dat housekeeping gepland staat en uitgevoerd is
- Workbench-bestanden van vorige fasen vervuilen de huidige fase niet
- Geen breaking changes voor bestaande skills (backward compatible)

## Mijn top-3 vragen voor de sessie

1. Kunnen we blueprint-lezen partitioneren (bijv. alleen meta + 1 context lezen) zonder de blueprint.py CLI te herschrijven, of is daar een nieuwe CLI-command voor nodig?
2. Is een "housekeeping todo als laatste stap van elke fase" voldoende afdwingbaar, of hebben we een hook nodig die het forceert (bijv. een SubagentStop-achtig mechanisme)?
3. Wat is de grens tussen "workbench opruimen" en "waardevolle context weggooien"? De example-map.yaml is transient, maar als Mister Gherkin er later naar terug wil verwijzen, is-ie weg.

---

## Ronde 2 — Reacties op de anderen

### Op Developer Amigo

De summary+view aanpak (optie 2+4) is precies wat ik had gehoopt. Het lost het leesvolume op zonder de architectuur te breken. Maar ik wil scherper worden op de **echte vraag van de gebruiker**, want die is subtieler dan "maak het kleiner."

De gebruiker zei: *"Wat heeft een agent eigenlijk NODIG in context om een werkend mentaal model van de software te hebben? En wat is makkelijk uitbreidbaar als je delen toevoegt of wijzigt?"*

Dat is geen vraag over tokens. Dat is een vraag over **informatie-architectuur**. De gebruiker wil weten: als ik de blueprint ontwerp (of herontwerp), welke informatie is *structureel noodzakelijk* voor welk type agent, en welke informatie is *nice to have*?

De summary+view aanpak beantwoordt dit indirect: summary = minimaal mentaal model, view = detail wanneer nodig. Maar de Developer Amigo heeft niet gespecificeerd **wat er in de summary zit**. Dat is de cruciale ontwerpbeslissing. Mijn voorstel:

- **Summary moet bevatten:** context-namen + hun verantwoordelijkheid (1 zin), aggregate-namen per context, relaties tussen contexten, en de glossary. Dit is het "mentaal model" -- je begrijpt het systeem op systeemniveau.
- **Summary mag NIET bevatten:** commando's, events, policies, feature_files, gaps, questions. Die zijn detail.
- **View per context moet bevatten:** alles van die context + de glossary-termen die bij die context horen + de relaties waar die context bij betrokken is.

Dit beantwoordt de vraag "wat is makkelijk uitbreidbaar": je voegt een context toe, de summary groeit met 2-3 regels, en de detail is geencapsuleerd in de view.

Wat betreft het Edit-probleem dat de Developer noemt -- de agent moet nog steeds het hele bestand lezen om een Edit te doen. Dat klopt. Maar in de praktijk doet de CLI (`blueprint add-*`) de meeste structurele mutaties, en voor scalar updates (bijv. een context-omschrijving wijzigen) kun je de view lezen, de edit targeten op een unieke string binnen die context, en het werkt. Het hele-bestand-lezen-voor-edit probleem is reeel maar minder erg dan het hele-bestand-lezen-voor-begrip probleem.

Over de complexiteitsinschatting: "skills aanpassen voor summary-first" als "middel" klopt, maar het is wel het grootste risico. Je moet 7 skills en 9 agents herschrijven, en elk daarvan moet de juiste keuze maken: lees ik summary of view? De conventie moet glashelder zijn, anders krijg je inconsistentie.

**Concreet voorstel:** definieer een beslisboom in de skill-conventies:
1. Begin altijd met `blueprint summary`
2. Als je een specifieke context gaat **lezen of bewerken**, gebruik `blueprint view --context X`
3. Als je cross-context validatie doet (Sticky Storm, Doctor Context), lees het hele bestand

### Op Testing Amigo

De Testing Amigo levert waar. Drie punten die mijn perspectief veranderen:

**1. De 60-80% observatie is een realiteitscheck.**
De Testing Amigo zegt: "voor de meeste agents heb je de target context + alle gerelateerde contexten + glossary nodig, en dat is misschien 60-80% van de blueprint." Als dat waar is, is de tokenwinst van summary+view bescheidener dan ik dacht voor sommige agents (Sticky Storm, Doctor Context). Maar het is nog steeds significant voor de meest-gebruikte agents: Three Amigos persona's hoeven alleen de summary te lezen (ze werken op business-niveau, niet op aggregate-detail-niveau). De Foreman hoeft alleen de summary. Mister Gherkin hoeft alleen de relevante context.

Mijn inschatting: voor 80% van de agent-aanroepen is summary voldoende. Voor 15% is een single-context view genoeg. Slechts 5% (Sticky Storm, Doctor Context) heeft het hele bestand nodig. Die 80% is waar de tokenwinst zit.

**2. Het cleanup-timing-probleem is echt en ik had het onderschat.**
Het scenario "gebruiker pauzeert 3 dagen tussen Three Amigos en Mister Gherkin" is niet hypothetisch -- dat is hoe echte teams werken. De example-map.yaml moet er dan nog zijn.

Mijn voorstel vanuit productperspectief: **cleanup hoort bij het BEGIN van een fase, niet aan het einde.** Elke fase begint met "verwijder artifacts van de vorige run van DEZE fase" (niet van de voorgaande fase). Mister Gherkin verwijdert oude Gherkin-drafts, niet de example-map. Three Amigos verwijdert oude amigo-notes, niet de events-raw.md.

Dit lost het timing-probleem op: je hoeft niet te weten of de vorige fase "klaar" is. Je ruimt je eigen rommel op aan het begin, en je laat de input van je voorganger staan.

De estimation-report.md is inderdaad een user-facing artifact dat nooit automatisch opgeruimd mag worden. De Testing Amigo heeft gelijk: dat is een ander soort bestand.

**3. Hooks waarschuwen maar blokkeren niet -- en dat is OK.**
De Developer en Testing Amigo maken zich allebei zorgen dat hooks niet kunnen blokkeren. De Developer zegt "hook stdout is een hint, geen blokkade" en de Testing Amigo vraagt "wat als de agent de waarschuwing negeert?"

Vanuit productperspectief: **een waarschuwing die er altijd is, is beter dan een blokkade die er niet is.** We hebben geen PreCommit hook. We hebben geen tool-blokkade. Maar we hebben PostToolUse die na elke edit valideert en een bericht terugstuurt dat de agent ziet. Combineer dat met de housekeeping-todo en je hebt twee vangnetten. Perfecte handhaving is onmogelijk binnen de huidige Claude Code hook-architectuur -- maar "altijd een waarschuwing + een zichtbare todo" is goed genoeg voor 95% van de gevallen.

De 5% waar het misgaat is wanneer een agent de waarschuwing negeert EN de todo overslaat. Dat is een agent-kwaliteitsprobleem, geen architectuurprobleem.

### Herziening van mijn scope

Na het lezen van beide amigos pas ik mijn scope aan:

**MVP (moet erin):**
1. `blueprint summary` en `blueprint view --context X` CLI-commando's
2. Summary-first conventie in alle skills (beslisboom)
3. `blueprint housekeeping` CLI-commando (validate + stamp)
4. Housekeeping als verplichte laatste todo-stap per fase

**Kan erin als het past:**
5. PostToolUse uitbreiden voor Bash-calls met `blueprint` commando's
6. Cleanup-per-fase-begin (elke fase ruimt eigen vorige artifacts op)

**Buiten scope:**
- Blueprint opsplitsen in meerdere bestanden
- PreCommit hook (bestaat niet in Claude Code)
- Automatische workbench cleanup van cross-fase artifacts

### Herziene top-3 vragen voor de sessie

1. **Wat zit er in de summary?** Dit is de kernontwerpbeslissing. De summary bepaalt het "minimale mentale model" dat 80% van de agents nodig heeft. Te weinig en agents missen context; te veel en we besparen geen tokens.
2. **Cleanup aan het begin van een fase of aan het einde?** Mijn voorstel is "begin" maar dat vereist dat elke fase weet welke artifacts van ZICHZELF zijn (niet van de voorgaande fase). Is dat haalbaar?
3. **Is de waarschuwings-aanpak (hook + todo) acceptabel voor de gebruiker, of verwachten ze harde blokkade?** We kunnen geen harde blokkade bieden. Als de gebruiker dat verwacht, moeten we die verwachting managen.
