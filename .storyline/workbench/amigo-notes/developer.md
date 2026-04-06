# Developer Amigo — Technical Analysis

Feature: Technical task entry point in the pipeline

---

## What I Found in the Code

### The Foreman is the single entry point — Scenario 4 is the only path into Three Amigos

The Foreman skill (`skills/the-foreman/SKILL.md`) has one branch that leads to feature development: **Scenario 4** — "Blueprint exists AND user specifies a feature". In that branch, the Foreman reframes whatever the user said into a user story format before dispatching Three Amigos:

> "If not already a user story, reframe it and confirm: 'As a [role] I want [action] so that [value]. Does that capture what you mean?'"

This is the reframe step we need to bypass or fork for technical tasks. There's no conditional — it always tries to cast input as a user story.

### Three Amigos is hardwired around the "user story" structure

Three Amigos (`skills/three-amigos/SKILL.md`) opens with:

> "**User Story** — formulate before mapping rules: As a [role] I want [action] So that [value]"

And the Example Map format (`example-map.yaml`) has a top-level `story:` field for exactly this. The whole session ritual (NFR probe, MoSCoW, story size check) is framed around user-visible behavior.

Some of this is still useful for technical tasks. NFR probing, MoSCoW, assumption audit — all apply. The forced user story framing does not.

### The example-map.yaml format is the key contract

The example map feeds Mister Gherkin, which feeds the Changeset, which The Onion builds from. Whatever we produce in the new entry point needs to be structurally compatible with what comes after, OR we need to define a new artifact format that Mister Gherkin (or a replacement) understands.

Let me be specific about the shape. From `skills/three-amigos/example-map-format.yaml` (not fully read, but referenced):

- `feature`: name
- `story`: the user story string
- `rules[]`: each with examples, MoSCoW, assumptions
- `questions[]`
- `assumptions[]`
- `risks`

For a technical task, `story` becomes a **task description** (what changes, why, acceptance criteria). The `rules` become **constraints and acceptance criteria**. Everything else carries over cleanly.

### Mister Gherkin also assumes a user story

Mister Gherkin reads the example map and writes Gherkin scenarios. It doesn't enforce the user story format structurally — it reads rules and examples. But its persona and framing ("pickling requirements") is user-story-centric.

For technical tasks, Gherkin may still be appropriate (e.g., "Given the scaffold script receives a TypeScript target / When it runs / Then it generates the expected file tree"). But for pure internal refactors (e.g., "migrate file format from JSON to YAML"), Gherkin is awkward and the scenario-per-rule pattern doesn't fit well.

This raises a genuine branch question: does the technical entry point produce an example map that flows into Mister Gherkin, or does it produce a **direct changeset** (bypassing Gherkin entirely)?

### The blueprint domain model has no concept of a "technical task"

Looking at `orchestration.feature` and the Orchestration context, every pipeline path routes through Discovery → Specification. There's no `StartTechnicalTask` command, no `TechnicalTaskStarted` event. We'd be adding a new command to `PipelineSession` and a new event — the blueprint needs updating alongside the skill.

The Discovery context's `DiscoverySession` aggregate has `RunQuickScan` and `RunFullSession` as its commands. A technical task could be modeled as a third command: `RunTechnicalBrief` or similar. Or it could be a separate aggregate entirely: `TechnicalTask`. That's a design question.

---

## Technical Constraints

**1. The Foreman reframe is unconditional.** Right now Scenario 4 always tries to impose a user story frame. The simplest fix is a conditional branch: detect if the input is a technical change (CLI, migration, refactor, dependency) and route differently. But "detect technical change" is fuzzy — we'd need the user to signal intent, or we need an explicit argument/flag.

**2. The example map format assumes `story:`.** If we keep the same downstream pipeline (Mister Gherkin), we either:
   - Extend the format with `task:` as an alternative to `story:`, and teach Mister Gherkin to handle both, or
   - Define a separate "technical brief" format that plugs into a different downstream, or
   - Leave `story:` as optional/nullable in the schema and document the convention

**3. Mister Gherkin may not add value for pure internal changes.** The Gherkin phase is valuable when there's observable behavior to specify. For "restructure the internal module layout" or "replace yaml library v1 with v2", there's no meaningful Given/When/Then. We'd either write awkward scenarios ("Given the codebase / When I run the tests / Then they all pass") or skip Gherkin entirely.

**4. Cross-cutting vs. scoped is an architecture decision, not just a parameter.** The user confirmed technical changes can be scoped (one context) or cross-cutting. This affects how The Onion builds it — cross-cutting changes likely need a changeset that touches multiple contexts and may have ordering constraints. The changeset format already supports `touches[]` per task, so this is not a new technical problem. But it's a thing the "technical brief" phase needs to capture.

**5. The bin/storyline dispatcher would need a new subcommand or the Foreman needs a new branch.** If we add a `tech-task` skill, it needs to be callable via an argument: `/storyline:the-foreman tech my task description` or a separate `/storyline:tech-task`. Given the plugin architecture, a separate skill is cleanest — it doesn't require changing every existing Foreman branch.

---

## Complexity Assessment

**Low complexity:**
- Adding the entry point branch to the Foreman (one new `elif` in the decision tree)
- Extending the example map format with `task:` as an optional field

**Medium complexity:**
- Deciding whether the technical task path flows into Mister Gherkin or bypasses it — this is a design call that affects two skills
- Defining what the "technical brief" artifact looks like and what makes it "complete enough" to hand off to The Onion

**Hard part:**
- The "is this a user story or a technical task?" detection. We should NOT try to auto-detect — the user must signal intent explicitly. Otherwise the Foreman will misclassify ambiguous inputs ("add CLI command for X" — is that a user feature or a technical task?). An explicit `--tech` flag or a separate skill invocation is much safer.

---

## Architecture Considerations

Three viable architectures:

**Option A: Fork inside Three Amigos**
The Foreman routes everything through Three Amigos. Three Amigos gets a third mode alongside Quick Scan and Full Session: "Technical Brief mode". The example map format gets a `task:` alternative. Mister Gherkin becomes optional (the facilitator asks "does this need Gherkin scenarios or go straight to changeset?").

Pro: minimum new skill files, everything reuses the existing pipeline infrastructure.
Con: Three Amigos skill gets three modes — complexity grows. The user story framing in Step 2 needs careful conditional logic.

**Option B: New skill — `the-brief`**
A standalone skill: `/storyline:the-brief "migrate YAML format from v1 to v2"`. It runs a structured technical brief session (what changes, why, scope, acceptance criteria, risks), produces a `technical-brief.yaml` in workbench, and then either invokes Mister Gherkin (if scenarios are warranted) or The Onion directly.

Pro: clean separation, no conditional clutter in Three Amigos, independent evolution.
Con: new skill file, new artifact format, The Foreman needs to know about it.

**Option C: Foreman flag, shared downstream**
The Foreman gets an explicit `tech` mode. When triggered, it runs a lightweight inline brief (no separate amigo session) and produces a minimal example map (with `task:` instead of `story:`). Mister Gherkin is still invoked but in a technical mode.

Pro: fewest new files.
Con: too much logic in The Foreman, which is supposed to be a coordinator, not a facilitator.

My read: **Option B is cleanest**. The Brief is a first-class pipeline entry point alongside Three Amigos. The Foreman gets a new branch in its decision tree: "technical task specified" → dispatch The Brief. The Brief produces a `technical-brief.yaml` that The Onion can consume directly or via a light Mister Gherkin pass.

The blueprint would get:
- New command `StartTechnicalTask` in Orchestration/PipelineSession
- New command `RunTechnicalBrief` in Discovery/DiscoverySession (or a new context?)
- New event `TechnicalBriefProduced`

---

## What I Still Need to Understand

- Does the example map format already have an optional `story:` or is it required? I didn't read the full format file.
- Does The Onion read the example map directly or only via the changeset? If only via changeset, the upstream format matters less.
- What does "acceptance criteria" look like for a technical task in terms of verifiability — is it always "tests pass + no regressions" or can it be more specific?

---

## Mijn top-3 vragen voor de sessie

1. **Does the technical entry point produce Gherkin scenarios, or does it hand off directly to The Onion?** This is the biggest fork in the road. If we require Gherkin for technical tasks too, we need Mister Gherkin to handle both modes. If we bypass Gherkin, we skip a layer of specification but gain speed and avoid awkward scenarios. My inclination: Gherkin should be optional — the Brief facilitator asks "are there observable behaviors we can specify as scenarios, or is this a pure internal change?"

2. **Is "The Brief" a new skill file, a mode inside Three Amigos, or a branch inside The Foreman?** I lean toward new skill (Option B) because it keeps the code clean and the concepts separate. But the Product Amigo and Testing Amigo should weigh in on whether they expect a "full session" variant with all personas, or a lighter single-agent flow.

3. **How does the Foreman distinguish user stories from technical tasks at intake?** The safest answer is: the user signals it explicitly (either via an argument flag, a separate command, or an MCQ choice). Auto-detection is unreliable. What's the right UX — a flag like `/storyline:the-foreman tech "..."`, a choice at Scenario 4/5, or a dedicated skill invocation?

---

## Reactie op de anderen

**Op Product Amigo:**

The "minimum viable bypass" framing aligns closely with Option B (new `the-brief` skill). You named it cleanly: the problem is not the pipeline depth — it's the forced user story framing at the entry gate. I agree that the Changeset infrastructure is already good enough for the output side; the gap is only at the intake side.

One point of friction: you put "a fully new skill file" in the NOT-in-scope column, preferring a branch inside the Foreman or an agent file. I understand the conservatism, but I want to push back on it. The Foreman is a coordinator, not a facilitator. Putting intake logic for a new kind of work inside the Foreman's decision tree would be like putting the Three Amigos session logic inside the Foreman — it's the wrong abstraction layer. A new `the-brief` agent file (even a lightweight one, not a full multi-persona session) keeps the Foreman's job as "route to the right thing" rather than "also do the thing." The boundary matters for future maintainability.

On your twijfelzone: "Should there be a `technical-amigo` agent?" — I think the right answer is no standalone persona, but yes a brief-facilitator agent. It's one agent running a structured intake, not a multi-agent session. The Brief has no business perspective to negotiate and no quality risks to anticipate in advance — those concerns get embedded in the brief template as required fields.

@product-amigo — your Scenario 3 question: "Is the problem only the framing, or is it the full Three Amigos overhead?" From the code: it's both, but in different proportions. The user story reframe is the first friction point. The NFR probe, MoSCoW scoring, and assumption audit that follow are still useful for technical tasks. So the answer might be: keep the structured thinking, drop the user story frame. That suggests a shared brief template that borrows the NFR/MoSCoW/assumption structure from the example map but replaces `story:` with `task:`.

**Op Testing Amigo:**

You surfaced the hardest structural issue in this session: if the technical path creates blueprint commands without feature files, `storyline validate` will either reject the blueprint or silently allow dangling `feature_files` references. This is real — I've read the validation code and referential integrity on `feature_files` is enforced.

Here's where the `the-brief` architecture has an answer, though not a complete one. Two options:

**Option 1: Technical tasks produce a `technical-brief.yaml`, not blueprint commands.** The blueprint only gains new entries when `StartTechnicalTask` is commanded — and for that event, we define that `feature_files` is not required (or is allowed to be `[]`). This requires a schema change: the `feature_files` field on a command must become conditionally required based on whether a `technical_task: true` flag is set on that command (or the changeset). The validation logic would need a corresponding exemption path.

**Option 2: Require a brief feature file.** `the-brief` always produces at least one feature file — a lightweight one with technical acceptance criteria in a non-Gherkin format (or lightweight Gherkin: "Given the build passes / When the migration runs / Then the existing test suite remains green"). This is less elegant but requires no schema changes to validation.

My preference: Option 2 initially, with Option 1 as a follow-on. Option 2 preserves the validation invariant unchanged. Option 1 is cleaner long-term but requires a schema decision and a validation code change — scope that's better handled when we know the exact command taxonomy for technical tasks.

@testing-amigo — your question "Who decides a change is technical?" needs a concrete answer before Mister Gherkin writes scenarios. Here's my proposal: the Foreman presents an MCQ at intake — "Is this a user-facing feature or a technical/internal change?" — and routes accordingly. No auto-detection. The user's answer is the signal. This means the guard condition is simple: an explicit user choice, not a heuristic. Is that firm enough for you to write a scenario against, or do you need a validation step within the brief itself?

@testing-amigo — on the security bypass concern: I fully agree an explicit security triage step is needed in the brief. For the blueprint, this maps cleanly to a required field in the `technical-brief.yaml` format: `security_surface: none | input-handling | auth | external-api | data-storage`. If `security_surface` is anything other than `none`, the brief dispatches the Security Amigo before handing off to The Onion. This makes the triage explicit and machine-readable rather than relying on agent judgment.

@testing-amigo — on phase enumeration: you're right that phase names are not formally defined as an enum. For the technical path, the simplest model is: Orchestration → Technical Brief → (optional Specification) → Implementation. The `in_progress` tracking needs to know about "Technical Brief" as a valid phase name. This is a small addition to the Orchestration invariants — but it must be made or the phase tracker will reject the new sequence. I'll flag this as a blueprint update required before any implementation.

@mister-gherkin — the brief's output format is the key handoff question for you. If `the-brief` produces a `technical-brief.yaml` with a `task:` field instead of `story:`, and `criteria[]` instead of `rules[]`, can you consume that as an alternative input to produce acceptance-criteria scenarios? Or do you need the standard example map shape? Your answer determines whether we need to extend your input format or produce a transformed example map as an intermediary.

On your "what if" scenario about blueprint CLI porting changing flag semantics: that's a real gap that the brief template needs to capture explicitly. A required field like `public_interface_change: yes | no` (which the Testing Amigo also mentioned) would force the contributor to declare it. This feeds directly into whether the changeset needs backward-compatibility tasks in its phases.

---

## Round 3 — Responses to @mentions

**@developer-amigo (from Product Amigo — Scenario 4 branch vs new Scenario 5):**

New Scenario 5. Here is why: Scenario 4 is already doing one thing — "blueprint exists AND user specifies a feature." Adding a conditional inside it ("...unless it looks technical, in which case...") makes it a two-headed scenario. The Foreman's decision tree is readable precisely because each scenario has a single trigger condition. A new Scenario 5 — "Blueprint exists AND user specifies a technical task" — keeps each branch clean and mirrors the existing pattern exactly. The MCQ clarifying question ("user-facing feature or internal technical change?") lives at the top of the Foreman's intake, before the scenario routing. It sets the flag; Scenario 4 or Scenario 5 fires based on the answer. The Foreman stays a coordinator.

**@developer-amigo (from Product Amigo — does the changeset support a `type:` field?):**

No, not at the metadata level. I checked `CS-2026-04-05-scaffold-ts-port.yaml` directly. The changeset has a `meta:` block with `id`, `title`, `blueprint_version`, `created_at`, and `status` — no `type:` field. Each phase inside the changeset has a `type:` (addition / removal / modification), but that is phase-level, not changeset-level. Adding `type: technical` to the `meta:` block would require a schema change in both the changeset YAML template and the `changeset validate` logic in `scripts/blueprint.ts`. It is a two-line addition to the meta block and a corresponding check in the validator — small, but it must be done deliberately so validation does not silently ignore an unknown field.

**@developer-amigo (from Testing Amigo — which of the three options is compatible with Option B?):**

Option 2 is the right fit for Option B. In Option B, `the-brief` is a standalone skill that produces a `technical-brief.yaml` artifact. That artifact can be listed in `feature_files` for any blueprint commands the task adds — the file exists on disk, the referential integrity check passes, and no schema changes are needed. The brief IS the specification artifact, just not Gherkin-formatted. Option 1 (conditional `feature_files` exemption) is architecturally cleaner but requires changes to both the blueprint schema and the validation code — scope better deferred. Option 3 (a `technical_task: true` flag on commands) is the most invasive and creates a two-tier command model I would not want to maintain. Start with Option 2; migrate to Option 1 if the brief format proves stable enough to warrant first-class schema support.

**@developer-amigo (from Testing Amigo — does The Onion read only via the changeset, or also directly from feature files?):**

Confirmed: both. The Onion's Step 0 explicitly reads `.storyline/features/*.feature` alongside the blueprint. It does not operate solely through the changeset — the opening instruction says "Also read: Glob: `.storyline/features/*.feature`." This means if a technical task produces no feature files, The Onion's opening read finds nothing and has no acceptance tests to make red. The Tester's concern is valid. Option 2 (the `technical-brief.yaml` listed as a feature file reference) resolves this: The Onion reads the brief as its outermost acceptance artifact and uses the `criteria[]` list as its acceptance test inputs. We will need to add one line to The Onion's Step 0: "If feature files are absent but a `technical-brief.yaml` exists, use its `criteria[]` as the acceptance test inputs." That is a small guard, not a restructuring of The Onion.
