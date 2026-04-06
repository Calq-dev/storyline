# Product Amigo — Ronde 1

## Wat de gebruiker écht wil

De aanvrager is een plugin contributor — iemand die de pipeline zelf verbetert of uitbreidt. Ze willen een structured entry point voor technische wijzigingen die geen "Als een gebruiker wil ik..." framing verdienen. Denk aan: een module porten naar TypeScript, een dependency vervangen, de blueprint CLI uitbreiden, een agent herschrijven.

De kernbehoefte: *structuur zonder theater*. De huidige pipeline gooit een technische taak door een ontdekkingssessie die is ontworpen voor user-facing features. Dat voelt als bureaucratie. Maar — en dit is cruciaal — de vraagsteller wil niet géén structuur. Ze willen een lichtgewicht alternatief dat nog steeds antwoord geeft op: wat verandert, waarom, criteria om te weten dat het klaar is, en risico's.

## Wat er al bestaat

De Foreman heeft Scenario 4: "Blueprint exists AND user specifies a feature." Daarin herformuleert hij de input als user story en bevestigt dat met de gebruiker, voordat hij Three Amigos dispatcht. Dit is precies waar het frictie veroorzaakt: technische taken gedwongen in een user-story-mal.

De pipeline is lineair: Three Amigos → Mister Gherkin → Quartermaster → Sticky Storm / Doctor Context → The Onion. Voor technische taken zijn meerdere stappen overbodig:
- Three Amigos discovery: zinvol voor scope en aannames, maar "Als bijdrager wil ik..." is mager
- Mister Gherkin Gherkin scenarios: redelijk nuttig voor acceptance criteria, maar technische criteria zijn anders dan gebruikersgedrag
- Sticky Storm / Doctor Context: zinvol als de change domeinwijzigingen raakt, overbodig als het een refactor is

De Changeset-structuur (CS-YYYY-MM-DD-slug.yaml) is al aanwezig en biedt structured phases, touches, en acceptance criteria. Dat is precies de infrastructuur die een technische entry point kan gebruiken.

## Scope observaties

**Wat is IN scope (minimum viable versie):**

1. Een nieuw Foreman-scenario (noem het "Scenario T: Technical Task") dat wordt getriggerd wanneer de input geen user story is en ook niet als zodanig geherformuleerd kan worden
2. Een lightweight discovery-formaat voor technische taken — denk: wat verandert, waarom, risico's, done-criteria — als alternatief voor het voorbeeld-kaartje
3. Een rechtstreekse pad naar Changeset + The Onion, waarbij Three Amigos en Mister Gherkin worden overgeslagen of vervangen door een technisch equivalent
4. Opname in The Foreman's beslisboom — niet als apart skill-entry-point, maar als tak van Scenario 4/5

**Wat is NIET in scope (nu):**
- Een volledig nieuw skill-bestand (de logica hoort in the-foreman/SKILL.md en eventueel een nieuw agent-bestand voor de technical intake)
- Wijzigingen aan de Changeset-structuur (die is goed genoeg)
- Een apart Three Amigos equivalent voor technische taken — dat zou overengineering zijn

**Twijfelzone:**
- Moet er een "technical-amigo" agent komen die een lichtgewicht technische discovery doet? Of handelt The Foreman dit zelf af?
- Geldt dit ook voor backlog-items? Als een backlog-item technisch van aard is, loopt het nu ook door de user-story-trechter

## Gebruikersdoel en journey

Huidige journey (pijnlijk):
1. Contributor wil de CLI uitbreiden met een nieuw commando
2. Foreman vraagt: "Als welke rol wil je dit?"
3. Contributor bedenkt iets als "Als plugin-auteur wil ik een nieuw CLI-commando..." — geforceerd en leeg
4. Three Amigos genereert discussie over business rules die er niet zijn
5. Mister Gherkin schrijft Gherkin voor technische acceptatiecriteria — werkt, maar voelt vreemd
6. De rest werkt redelijk goed vanaf Changeset

Gewenste journey:
1. Contributor heeft een technische taak
2. Foreman detecteert: dit is geen user-facing feature
3. Foreman vraagt om de 4-6 technische essentials (wat, waarom, risico's, done-criteria)
4. Changeset wordt direct opgezet met die informatie als context
5. The Onion bouwt het — eventueel met technische acceptance criteria in een lichtgewichter formaat dan volledige Gherkin

## Business risks

**Risico 1: De scope-grens is vaag**
Wanneer is een taak "technisch" en wanneer is het een feature? "CLI command toevoegen" is technisch. "Gebruikers kunnen de tool installeren via Homebrew" is een user story. De detectieheuristiek moet helder zijn, anders krijg je een verkeerde route.

**Risico 2: Overslaan van Three Amigos is geen vrije lunch**
Three Amigos discovert ook technische risico's. Als we dat overslaan, missen we misschien edge cases. De lightweight vervanging moet dat compenseren — anders leveren we minder kwaliteit.

**Risico 3: Gherkin is ook waardevol voor technische taken**
Technische acceptance criteria zijn nuttig. "De bestaande 60 tests blijven groen" en "het nieuwe commando geeft een foutmelding bij ontbrekende argumenten" zijn perfectly uitdrukbaar in Gherkin. Misschien is het probleem niet Gherkin zelf maar de user story framing die eraan voorafgaat.

**Risico 4: Fragment the pipeline**
Als technische taken een eigen pad hebben, twee pipelines onderhouden is complexer. Liever een minimale "bypass" op bepaalde fases dan een volledig parallelle pipeline.

## Mijn top-3 vragen voor de sessie

1. Is het probleem de user story framing (geforceerd format) of de volledige Three Amigos fase (te veel overhead)? Want als het alleen de framing is, is de oplossing een kleine wijziging in Scenario 4 van de Foreman — geen nieuw entry point.

2. Zijn technische acceptance criteria in Gherkin-formaat wenselijk? Als ja, kunnen we Three Amigos en Mister Gherkin laten bestaan maar een "technische modus" geven — zonder user story framing, maar mét scenario's voor technische done-criteria.

3. @user — wanneer de feature "technical task entry point" zelf door de pipeline gaat, op welk niveau wil je het opnemen: (a) als een variant in Scenario 4 van The Foreman, (b) als een aparte tak in de beslisboom van The Foreman, of (c) als een volledig nieuw skill (/storyline:tech-task)?

---

## Reactie op de anderen

**Op Developer Amigo:**

The Developer's case for Option B (a standalone `the-brief` skill) is architecturally sound, and I'm largely convinced. A separate skill keeps Three Amigos clean, allows independent evolution, and signals clearly to contributors: "this is a different mode, not a shortcut." That framing matters. If it lives inside the Foreman as a branch, contributors may see it as a way to skip scrutiny. If it's a named skill with its own SKILL.md, it carries weight — it says "you're still doing structured discovery, just a different kind."

However, I want to push back on one thing: the Developer frames this primarily as an architecture question (where does the code live?). But the more important question is *what does the contributor experience feel like*? A new skill means a new invocation — `/storyline:the-brief` — which contributors need to know exists. The Foreman is the stated entry point for everything. If the Foreman doesn't route there automatically, we've solved the architecture problem but broken the UX. The Foreman must be the doorway, even if the-brief is the room.

My revised position: Option B is right, but the Foreman must auto-detect "technical task" at intake and route there. The contributor should not need to choose the entry point — the Foreman should ask one clarifying question ("Is this a user-facing feature or an internal technical change?") and dispatch accordingly. That preserves the "one front door" promise.

On the detection question: the Developer correctly says auto-detection is unreliable. I agree — explicit user signal is safer. But "explicit" doesn't have to mean a flag. An MCQ prompt at Scenario 4 ("This looks like a technical change — is that right?") is low friction and retains the single-entry-point model.

@developer-amigo — if the-brief is a standalone skill, does the Foreman's decision tree need a new Scenario 5 ("Blueprint exists AND user specifies a technical task"), or do we gate on a clarifying question within the existing Scenario 4 branch? The difference matters for how clean the Foreman stays.

**Op Testing Amigo:**

The Testing Amigo identified the security evaluation gap as a scope concern, and I think they're right — but I want to be precise about what kind of concern it is. It's not primarily a testing concern; it's a product design gap. The three-amigos session is the mechanism that catches "this change touches security-sensitive surfaces." Removing it without a replacement means the Security Amigo may never fire, because the trigger condition is never evaluated.

This is a feature completeness issue, not just an edge case. The brief session — whatever form it takes — must include an explicit security triage step: "Does this change touch auth, user input, external APIs, or sensitive data?" If yes, Security Amigo must be flagged for post-implementation review. This is not optional.

On the "wrong route" risk: the Tester asked who enforces that a change is actually technical and not a disguised feature. My answer: the contributor signals it, and the Foreman's clarifying question serves as a lightweight gate. But we should not rely on technical enforcement here — we rely on contributor intent and the brief's own questions surfacing the issue. If the brief asks "does this change affect any user-visible behavior?" and the answer is yes, the pipeline should flag: "Consider routing through Three Amigos instead." That's a prompt-level guardrail, not a code-level one.

The Testing Amigo's point about feature_files referential integrity is critical and I hadn't fully thought through it. If a technical task produces a changeset but no feature files, blueprint validation may break. This needs a resolution before we write a single scenario.

@testing-amigo — can referential integrity validation be relaxed for technical task changesets specifically (a new changeset type: `type: technical`), or would that undermine the validation guarantee too much? I need your read on whether a second changeset type is an acceptable escape hatch or a dangerous precedent.

@developer-amigo — does the changeset format currently support a `type:` field, or is every changeset implicitly assumed to be a feature implementation? If not, adding `type: technical` is the minimal change that lets validation treat these differently.

**Aanvullende scope-verfijning na beide analyses:**

Two things I want to add to my Round 1 scope assessment:

First, the Gherkin question is now clearer to me. The Developer is right that for observable behavior (even technical behavior), Gherkin is appropriate. For pure internal changes with no observable interface, it's awkward. The brief session should end with a gate question: "Are there observable behaviors we can specify as scenarios?" If yes, Mister Gherkin runs in a lightweight technical mode (no user story framing, just acceptance scenarios). If no, we go directly to changeset. This is not a binary "Gherkin or not" — it's a conditional.

Second, the Testing Amigo's concern about the phase-tracking invariant ("exactly one phase in_progress at a time") reveals that the brief session needs to produce a named phase in the todo progression. It can't be a phantom. Whatever we call it — "Technical Brief" — it must appear in the phase sequence so the invariant holds. This feeds back to the blueprint: a new phase name needs to be added to whatever enum or convention governs phase names.

@mister-gherkin — when the technical brief session decides that observable behavior exists and Gherkin scenarios are warranted, you'll receive a technical-brief.yaml instead of an example-map.yaml. The rules become acceptance criteria; the story field is absent or replaced by a task description. Are you able to handle this structural variation, or does the upstream format need to preserve a `story:` field (even if it reads "Technical task: ...")?

## Round 3 — Responses to @mentions

**@product-amigo (from Developer Amigo — framing vs. full overhead):**

You asked: is the problem only the user story framing, or is it the full Three Amigos overhead?

Both — but in a specific ratio. The user story reframe is the first friction point and the most painful one, because it's the gate. Everything downstream feels off because you started wrong. But the overhead question matters too, and the answer differs by task type:

- For scoped technical tasks (replace a library, extend a CLI command): the NFR probe, MoSCoW scoring, and assumption audit from Three Amigos are still valuable. The overhead is justified if the framing is right. The fix is narrow: replace `story:` with `task:` and keep the rest.
- For pure internal restructuring (rename a module, reorganize file layout): the discovery machinery adds genuine overhead with little return. These have no user impact, no business rules to negotiate, no MoSCoW tradeoffs. The brief session for these should be lighter — just: what changes, why, risks, done-criteria.

So my position: the fix is not one-size-fits-all. The brief session should distinguish between "technical task with behavioral acceptance criteria" and "pure internal change." The former borrows most of Three Amigos structure minus the user story frame. The latter gets a stripped-down template. The Foreman can ask a second MCQ to make this distinction, or the-brief can ask it internally after intake.

**@product-amigo (from Testing Amigo — acceptance criteria format and referential integrity):**

You asked: what acceptance criteria format do I have in mind, and how does it connect to the blueprint's referential integrity constraints?

My thinking on format: acceptance criteria for technical tasks should live in `technical-brief.yaml` as a structured list of verifiable criteria — not free text, but also not full Gherkin. Something like:

```yaml
acceptance_criteria:
  - "All existing tests pass after the migration"
  - "The new command returns exit code 1 with a descriptive error when required args are missing"
  - "No public CLI interface is changed"
```

These are human-readable but structured enough to be validated for completeness (non-empty list, each item a string).

On the referential integrity question: I now have a clear position. The `technical-brief.yaml` itself IS the specification artifact — it should be the value that fills `feature_files` for any blueprint commands created by a technical task. This is the Developer's Option 2, and I agree it's the right call. It maintains the validation invariant (everything in the blueprint traces to a file), avoids weakening the schema, and doesn't require introducing `technical_task: true` as a special-cased exemption.

The consequence: `technical-brief.yaml` must be a formally validated format (schema-checked, not freeform markdown). That's a scope addition compared to Round 1, but it's the right call for pipeline integrity. If the brief is just markdown, we've replaced one weak reference with another.

@developer-amigo — this means the-brief must produce a validated YAML artifact, not just a workbench document. Does that change your complexity assessment for Option B?
