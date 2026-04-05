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
