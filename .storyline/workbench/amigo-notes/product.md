# Product Amigo — Ronde 1

Feature: Turn skills into Gherkin format
Session date: 2026-04-06

---

## Wat de gebruiker écht wil

The request is: "Express pipeline skills — or parts of them — in Gherkin format instead of free-form Markdown."

But Gherkin is a specification language for system behavior. Skills are not system behavior — they are *instruction prompts* that tell an AI model how to behave. So before anything else, I need to name what the user is actually asking:

**Is the goal to specify how skills behave (for documentation, quality assurance, or tooling), or to replace the Markdown instruction files themselves with Gherkin?**

These are very different intentions with completely different implications:

- **Interpretation A — Skills-as-specs**: Convert SKILL.md files into Gherkin `.feature` files that describe what the skill should produce. The feature files become the authoritative spec; Markdown instructions are derived from or replaced by them. This is a radical architectural shift.

- **Interpretation B — Skills-as-tested-behaviors**: Write Gherkin scenarios that describe observable skill behavior — what outputs are produced given certain inputs — for automated or manual verification. The Markdown files stay, Gherkin is added as a quality layer.

- **Interpretation C — Skills use Gherkin internally**: Parts of a SKILL.md include Gherkin-formatted examples or acceptance criteria to make expected behavior more concrete, while the broader instruction structure stays Markdown. A lighter touch.

I'm going to analyze all three, but flag immediately: the answer to "which interpretation?" is the most critical product question in this session.

---

## What already exists

The pipeline already produces Gherkin (`.storyline/features/*.feature` files) for the *target project's features*. There are 11 feature files today covering orchestration, discovery, specification, implementation, blueprint management, etc. These specify the pipeline itself as a software product — from the outside.

So the question is really: we already have Gherkin specs *about* the pipeline. Now do we want Gherkin *inside* the pipeline skills?

The existing skills are pure natural language instruction prompts. They contain:
- Role definitions (who the skill is)
- Step-by-step instructions (what to do, in what order)
- Decision trees (dot digraphs, tables, conditionals)
- Bash command blocks
- Hard gates and tool requirements
- Example outputs and templates

None of this is currently Gherkin. The skills are read by Claude Code at invocation time — they are configuration-as-prose.

---

## What pain does this solve?

I can think of several legitimate pains this might address:

**Pain 1: Skill drift — no way to know if a skill does what it's supposed to**
Skills are written once and accumulate edits. There's no automated check. A developer adds a new step to the Foreman but forgets to update the Three Amigos SKILL.md. Nobody notices until a user gets confused behavior. Gherkin scenarios for skills could serve as executable acceptance criteria — if you can run them (or manually verify them), drift becomes visible.

**Pain 2: Skills are hard to reason about**
A SKILL.md like the Foreman's is 337 lines of prose, diagrams, and code blocks. Someone trying to understand "what does the Foreman do in Scenario 4?" has to read carefully. Gherkin scenarios are scannable — you can read the title and get the behavior. This is a readability/discoverability improvement.

**Pain 3: Skill behavior isn't formally specified**
The feature files for the pipeline (`.storyline/features/orchestration.feature` etc.) exist, but they were generated from a survey of existing behavior (`@surveyed`). They describe what was built, not what was intended. Converting skills to Gherkin could make the intent explicit and testable before implementation — a shift from as-built documentation to living specification.

**Pain 4: New skill authors have no template for "correct behavior"**
If someone writes a new skill, what does "correct" look like? Gherkin acceptance scenarios could serve as a contract: "the skill is done when these scenarios pass."

---

## Business rules I can identify

These are the rules that would need to be true for this feature to work, regardless of interpretation:

**R1 — Skills must remain executable as Claude Code instructions**
Whatever format they take, skills are consumed by Claude Code at runtime as prompt text. If Gherkin replaces Markdown, Claude must be able to interpret Gherkin as instructions. If Gherkin is added alongside Markdown, the skill file grows in size (token cost). The execution model cannot break.

**R2 — Gherkin in skills must follow the same quality rules as Gherkin in feature files**
If Mister Gherkin's own principles (declarative, no implementation details, one behavior per scenario) apply to feature files, they must apply to skill-level Gherkin too — otherwise we have two classes of Gherkin with different standards, which is confusing.

**R3 — The relationship between existing `.feature` files and skill-internal Gherkin must be clear**
There are already 11 `.feature` files that specify pipeline behavior. If skills also contain Gherkin, there's a risk of duplication or contradiction. The architectural question of "where does the spec live?" needs an answer.

**R4 — Skills cannot grow so large they degrade Claude's context window performance**
Skills are injected into context at invocation. Larger files cost more tokens. If we add Gherkin sections to every skill, all 8+ skills get heavier. This is a real cost, not a theoretical one.

**R5 — Any Gherkin added to skills must be maintainable by plugin contributors**
If skill-internal Gherkin duplicates the `.feature` files in `.storyline/features/`, contributors must update two places when behavior changes. That's a maintenance trap.

---

## Concrete examples (proto-scenarios)

To make this tangible, here are the scenarios I'd want to verify depending on what interpretation we pick:

**If Interpretation A (replace SKILL.md with Gherkin):**

- Scenario: Foreman invoked with no blueprint and no source code
  - Given: no blueprint, no source code
  - When: Foreman skill is invoked
  - Then: it asks what to build (Scenario 1 behavior)

- Scenario: Three Amigos skill invoked in quick scan mode
  - Given: an example map exists in workbench/
  - When: user selects "Quick scan"
  - Then: all three perspectives are applied in a single session

This is the most ambitious interpretation — the Gherkin becomes the skill.

**If Interpretation B (add Gherkin as quality layer):**

- Scenario: New contributor verifies Foreman behavior in Scenario 4
  - Given: the acceptance scenarios for the-foreman skill exist
  - When: contributor invokes the Foreman with a user-facing feature
  - Then: they can compare observed behavior against the Gherkin spec

**If Interpretation C (Gherkin examples inside SKILL.md):**

- Scenario: A decision table in Three Amigos SKILL.md is replaced with a Scenario Outline
  - Given: the story size gate currently uses a Markdown table
  - When: it's rewritten as a Scenario Outline with examples
  - Then: the logic is clearer and more testable

---

## Scope observations

**What might be IN scope (minimum viable version):**

If the intent is readability and specification quality (Interpretation C), the MVP is narrow:
- Identify 2-3 specific decision points in existing skills where Gherkin is clearer than a table or prose
- Add Gherkin `Rule:` + `Scenario:` blocks for those specific decision points
- No change to skill execution model; Gherkin is illustrative/documentary

If the intent is quality assurance (Interpretation B):
- Write Gherkin acceptance scenarios for each skill, stored alongside or within the skill
- These serve as manual verification checklists for contributors
- They do NOT replace SKILL.md files
- Possibly: integrate with existing `.storyline/features/` pipeline specs

**What is likely OUT of scope:**
- Automated execution of skill-level Gherkin (skills are AI prompts, not deterministic functions — automating this is hard)
- Full replacement of SKILL.md narrative with Gherkin (skills need prose instructions, not just scenarios)
- Adding Gherkin to all skills at once (8+ skills is a large scope for one session)

**Biggest scope risk:**
This could easily balloon into a full audit and rewrite of all skill files. We need to pick one skill as a pilot and validate the approach before applying it broadly.

---

## Business risks

**Risk 1: We're solving a problem that doesn't actually hurt**
The existing skills work. Users can follow them. Contributors can modify them. Is there evidence that the free-form Markdown is causing confusion, drift, or defects? If not, this is an improvement-in-theory with unknown real-world value.

**Risk 2: Gherkin inside skills is semantically confusing**
Gherkin is a specification language for *system behavior*. Skills are AI instructions. A Gherkin scenario inside a SKILL.md doesn't describe what a user does — it describes what a skill does. That's a different thing. We risk using the right syntax for the wrong semantic layer, confusing future contributors about what the Gherkin represents.

**Risk 3: The spec already exists in .storyline/features/**
There are 11 feature files specifying the pipeline. They already describe skill behavior in Gherkin. Adding Gherkin inside SKILL.md files creates a second spec — now we have two places to maintain. If they diverge, which one is authoritative?

**Risk 4: Skills can't be mechanically tested**
Unlike a REST API or a UI component, skill behavior depends on an LLM's interpretation. You can't write a test runner that invokes `/storyline:the-foreman` and checks whether it used TodoWrite correctly. Gherkin implies testability. If it can't be tested, what does it mean to "pass" the scenario?

**Risk 5: Token cost creep**
Gherkin sections in skills add tokens. If we add 20-30 lines of Gherkin to each of 8 skills, that's 160-240 extra lines injected into context on every invocation. Small but real cost, multiplied across all pipeline users.

---

## Assumptions I'm making

1. The existing `.storyline/features/*.feature` files are the correct location for pipeline specs, not SKILL.md files. (Medium confidence — this is worth challenging.)

2. Skills will continue to be consumed as natural language instructions by Claude Code, not as machine-executable specifications. (High confidence — nothing in the brief suggests the execution model is changing.)

3. The user has a specific pain in mind — this proposal isn't abstract. Something made them think "I wish this skill were in Gherkin." I don't know what that trigger was. (Low confidence — I need to ask.)

4. "Parts of them" in the feature description implies not a full replacement but a selective addition. (Medium confidence — the hedge "or parts of them" suggests the user is still exploring the shape of this.)

---

## Mijn top-3 vragen voor de sessie

1. @user — what specifically triggered this idea? Was there a moment where you found a SKILL.md hard to understand, modify, or verify? Knowing the concrete pain shapes whether this is a readability fix, a specification quality fix, or something else entirely.

2. @user — given that `.storyline/features/` already contains Gherkin specs for pipeline behavior, what would skill-internal Gherkin add that those files don't already provide? What's the gap?

3. @developer-amigo — skills are read by Claude Code as prompt context. If we add Gherkin blocks to SKILL.md files, does Claude treat them as instructions (executing the scenarios as steps) or as documentation (reading them but not acting on them literally)? The answer determines whether Gherkin in skills is safe to add without breaking skill execution behavior.

@testing-amigo — skill behavior is non-deterministic (it depends on an LLM). How do you plan to define "a scenario passes" for a skill? What does verification look like if there's no test runner?

---

## Round 2

### @developer-amigo — format change vs. authoring discipline: which is the actual pain?

This is the right question, and the Developer Amigo has already answered it more clearly than I did in Round 1.

The pain is **authoring discipline**, not format.

Here's the tell: the 11 `.feature` files are all tagged `@surveyed`. They were generated after the skills existed. Nobody wrote `orchestration.feature` before touching `the-foreman/SKILL.md` — the survey happened after. That's the current working mode: write the skill, then document what it does. BDD reversed.

The Developer Amigo's framing is right: if someone proposes changing the Foreman's decision tree, should they update `orchestration.feature` first — spec change before skill change — or should they edit SKILL.md directly? Today, nothing enforces option (b). There is no gate, no convention, no reminder. The `@surveyed` tag is actually a confession: this codebase has as-built documentation, not a living specification.

So the actual gap this feature is filling is: **there is no BDD discipline for skills**. Gherkin format inside SKILL.md files is not the goal — it's one possible solution someone reached for when they noticed that skill changes happen without a spec step.

This reframes everything:

- The minimum viable version is **not** "add Gherkin to SKILL.md files." It is: establish and document the convention that skill changes require a spec update first, and ensure the relevant scenarios exist to update against.
- The deliverable that creates the most value is: complete missing scenario coverage in the existing `.feature` files (the branches the Foreman survey missed, the hard gate behaviors, the Three Amigos mode branching), and add a note to `skills/CONVENTIONS.md` that says: "Before editing a SKILL.md, update the relevant scenario in `.storyline/features/` first."
- That is Interpretation C, but applied at the process layer rather than the file format layer.

Interpretation B (parallel `.feature` files per skill) creates the dual-maintenance trap the Testing Amigo correctly named. Interpretation A is off the table. The cleanest path is: extend existing feature files + formalize the authoring order.

One architectural note I'm adding from the Developer Amigo's analysis: the Level 1 / Level 2 collision problem is real and underappreciated. Right now, `orchestration.feature` and a user's `shopping-cart.feature` would coexist in `.storyline/features/`. That's confusing. If we extend the pipeline spec coverage, we should also surface this structural question. It may be out of scope for this session, but it is a consequence we should flag.

@user — the Developer Amigo identified the real pain as authoring discipline (BDD: spec first, then skill change). Does that match what triggered this idea? If yes, the deliverable is "convention update + missing scenario coverage," not "Gherkin inside SKILL.md files."

### @testing-amigo — value delivered when testing ceiling is a 5-minute manual check

The Testing Amigo asked me to frame the product value given that "verification" means a human comparing Claude's output to a Then clause in under 5 minutes. I'll be direct.

**The value is real but it is documentation value, not quality assurance value.**

Here is what that 5-minute human check actually delivers:

1. **Contributor onboarding.** A new contributor who has never used the Foreman can read three scenarios, invoke the skill, and answer: "is this behaving the way it's supposed to?" Without the scenarios, they'd need to read 336 lines of prose and form their own mental model. The Gherkin collapses that to three scannable Then clauses. That is time saved and defects surfaced earlier — even if the "test" is a human eyeball.

2. **Change validation.** When someone edits a skill and wants to know if they broke anything, they currently have no checklist. Scenarios give them a checklist. Not automated, but real. The counterfactual is: without scenarios, contributors either skip verification entirely, or re-read the whole SKILL.md. Either way is worse than a 5-minute manual check.

3. **Drift detection.** Right now, nobody knows if `orchestration.feature` matches `the-foreman/SKILL.md`. Scenarios written with behavioral intent (not just as-built documentation) create a reference point. When the skill is edited and the scenario is not updated, the gap becomes visible the next time someone does a manual check — not automatically, but visibly.

**What the 5-minute ceiling does NOT deliver:**

- It does not catch regressions before they reach users. Human checks happen when someone thinks to do them, not on every commit.
- It does not enforce the quality bar across contributors — the Testing Amigo is right that "false confidence" risk is real. A scenario that looks covered but was never actually checked against the skill is worse than no scenario, because it implies someone validated it.

**My product recommendation on this:**

The value is proportional to how many contributors engage with the skill regularly. For a plugin with a small contributor base (which this is), the 5-minute manual check is meaningful because contributors are likely to use it. For a plugin used by many independent contributors who never read the spec, the value drops fast.

Given the current state of the project: Gherkin for skills is worth doing if and only if it fills gaps that currently have no coverage at all (the missing decision branches, the hard gates, the Three Amigos mode split). Adding Gherkin to scenarios that already exist in `.feature` files as `@surveyed` descriptions — without improving their specificity — is documentation theater. It looks like quality work but produces no new verifiability.

**So the product value frame is: "this replaces zero coverage with a 5-minute manual check."** That's a real step up from nothing. It's not automated testing. Call it what it is.

### @user questions from Round 1 — best-guess assumption on the trigger

I asked two questions about what triggered this idea. Based on what the Developer and Testing Amigos found, I can now make a reasonable assumption without waiting for confirmation.

**My best-guess on the trigger:** Someone edited a SKILL.md — likely the Foreman or Three Amigos, since those are the most actively maintained — and afterward had no way to verify that the change was correct. The `@surveyed` feature files exist but they feel like archaeology, not a working spec. The impulse to add Gherkin was the impulse to have *something to check against*. The format (Gherkin) was reached for because Gherkin is what the rest of the pipeline produces. It felt natural.

**The gap it's actually trying to fill:** The absence of a spec-first discipline for skill changes. Skills are changed ad hoc. There is no "update the scenario first" step. The result is that the pipeline enforces BDD discipline for users (feature → scenario → implementation) but not for itself (skill change → nothing to check against).

**What this means for scope:**

If I'm right about the trigger, the user doesn't need Gherkin *inside* SKILL.md files. They need:
1. Better scenario coverage in the existing `.feature` files (filling the branches that were missed in the survey)
2. A written convention that says: spec changes before skill changes
3. Possibly: a way for the Foreman to detect when a skill and its spec have diverged (the Testing Amigo flagged this as a currently missing scenario in `orchestration.feature` — and it's also the hardest thing to build, so probably not in scope for this session)

Items 1 and 2 are low-complexity, high-discipline changes. Item 3 is a future feature.

@user — is this read of the trigger accurate? If yes, we can scope this session to: pick the top 2-3 missing scenario gaps in existing feature files, fill them using BDD discipline, and add the convention to SKILLS.md. No new file format, no Gherkin inside SKILL.md files. Just better coverage and a written rule about authoring order.
