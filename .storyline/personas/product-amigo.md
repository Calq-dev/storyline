# Product Amigo — Project Notes

## Het Project

Dit is de BDD Pipeline plugin zelf (storyline). De "gebruiker" is zowel de plugin-consument (teams die de pipeline gebruiken op hun project) als de plugin-auteur (wie nieuwe skills/agents schrijft).

## Belangrijke Inzichten

### De gebruiker denkt in informatie-architectuur, niet in tokens
De eigenaar vroeg: "Wat heeft een agent NODIG in context om een werkend mentaal model te hebben?" Dat is de kernvraag. Tokenkosten zijn het symptoom, niet het probleem. De oplossing moet antwoorden: welke informatie is structureel noodzakelijk per agent-type.

### Summary als "mentaal model" van het systeem
Voorstel uit sessie 2026-04-04: `blueprint summary` bevat context-namen + verantwoordelijkheid, aggregate-namen, relaties, glossary. Geen commando's, events, policies, gaps, questions. Dit is voldoende voor ~80% van agent-aanroepen.

### Cleanup hoort bij het BEGIN van een fase
Niet aan het einde. Elke fase ruimt eigen vorige artifacts op, laat input van voorgaande fase staan. Lost het "3 dagen pauze tussen fasen" probleem op.

### Hooks waarschuwen maar blokkeren niet -- en dat is acceptabel
Claude Code hooks kunnen niet blokkeren. "Altijd waarschuwing + zichtbare housekeeping-todo" is het best haalbare. Perfectie is onmogelijk; 95% dekking is goed genoeg.

## Scope-patronen

- De eigenaar wil GEEN blueprint opsplitsen in meerdere bestanden (te grote refactor)
- CLI-uitbreidingen (summary, view, housekeeping) passen in bestaande patronen
- Conventie-wijzigingen in skills zijn het grootste risico qua omvang (7 skills + 9 agents)

## Gebruikerstypen

- **Plugin-consument**: ervaart trage sessies, vergeten housekeeping, token-kosten. Fix moet transparant zijn.
- **Plugin-auteur**: moet weten wanneer summary vs. view vs. full read. Beslisboom moet glashelder zijn.

## Workbench Artifact Eigenaarschap

| Artifact | Eigenaar (fase) | Opruimen door |
|---|---|---|
| example-map.yaml | Three Amigos | Three Amigos (begin volgende run) |
| events-raw.md | Sticky Storm | Sticky Storm (begin volgende run) |
| amigo-notes/*.md | Three Amigos | Three Amigos (begin volgende run) |
| estimation-report.md | The Appraiser | NOOIT automatisch (user artifact) |

## Technical Task Entry Point (sessie 2026-04-06)

### Kernbehoefte
Plugin contributors willen structured discovery voor technische taken zonder user-story-framing. "Structuur zonder theater."

### Architectuurvoorkeur (product-standpunt)
Option B (standalone `the-brief` skill) is de juiste keuze, maar met een cruciaal voorbehoud: The Foreman blijft de enige voordeur. De Foreman detecteert technische intake via een MCQ-vraag ("Is dit een user-facing feature of een interne technische wijziging?") en dispatcht naar the-brief. Contributors kiezen geen skill — de Foreman kiest voor hen.

### Scope-beslissingen
- Gherkin is conditioneel: brief eindigt met gate-vraag "Zijn er observable behaviors te specificeren?" Ja = Mister Gherkin in technische modus; nee = direct naar changeset
- Security triage is NIET optioneel: brief-sessie moet expliciet evalueren of de taak auth/input/API raakt
- Phase tracking: "Technical Brief" moet een named phase worden in de todo-progressie (invariant: precies één fase in_progress)
- Changeset type: mogelijk `type: technical` toevoegen zodat blueprint-validatie feature_files-check kan overslaan voor technische changesets

### Architectuurbeslissingen (vastgesteld na drie rondes)
- `technical-brief.yaml` IS het specificatie-artifact — vult `feature_files` in het blueprint voor technische taken
- Format moet schema-validated YAML zijn, niet freeform markdown (anders vervangt het één zwakke referentie door een andere)
- Twee subtypes van technische taak: (1) task met behavioral acceptance criteria → borrows NFR/MoSCoW structuur, geen user story framing; (2) pure internal change → stripped-down template (wat, waarom, risico's, done-criteria)
- De-brief bepaalt welk subtype van toepassing is via een interne vraag na intake

### Open vragen (nog niet beantwoord door @user)
- Niveau van integratie: variant in Scenario 4, apart Scenario 5, of aparte skill invocation?
- Complexiteitsimpact van schema-validated technical-brief.yaml op Option B (vraag opengelaten voor developer-amigo)

### Risico's om te bewaken
- "Technical" als manier om Three Amigos te ontwijken voor behavior-changing work — de brief moet vragen stellen die dit blootleggen
- Security Amigo trigger wordt nooit geëvalueerd als discovery wordt overgeslagen
- Dubbele pipeline onderhouden is complexer — minimale bypass is beter dan volledig parallel pad
- Als technical-brief.yaml niet gevalideerd is, is de referentiële integriteitsgarantie hol
