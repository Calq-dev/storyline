# Testing Amigo — Round 1 Analysis

Feature: Technical task entry point for the pipeline

---

## What's Being Bypassed

The existing pipeline has one entry path for new work: Three Amigos discovery → Example Map → Mister Gherkin scenarios. The feature asks for an alternative entry point that skips this path for changes with no meaningful user story. The Discovery and Specification contexts are bypassed entirely. The pipeline jumps from Orchestration directly toward Implementation.

That bypass is the entire risk surface. Everything below follows from it.

---

## Invariant Violations I'm Already Watching

From the Orchestration context:
- "Exactly one pipeline phase may be in_progress at a time"
- "Blueprint must be validated and stamped before any commit"

From the Discovery context:
- "Discovery sessions read the blueprint as context, never explore codebase directly"

The new entry point doesn't threaten the last two directly, but the first one is immediately at risk. If a technical task can start from Orchestration and skip Discovery and Specification, the phase-tracking model must still enforce the single-active-phase invariant. What does the phase progression even look like for a technical task? Is it: Orchestration → Implementation? Orchestration → (nothing) → Implementation? If phase names aren't enumerated, the tracker can't validate this.

This ties into a known weakness I've logged: **phase names are not formally defined as an enum anywhere.** A new entry point adds a new phase sequence. If this isn't codified, agents will pass inconsistent phase identifiers immediately.

---

## "What if..." Scenarios

**What if the user writes a technical task for something that actually has user-visible impact?**
E.g., "Port the blueprint CLI from Python to TypeScript" — looks technical, but it changes all the `bin/storyline` invocation semantics. No discovery session means no one catches that the flag interface has changed and agents that call `bin/storyline add-event` will get different output. Who catches this drift? There's no product amigo to ask "but what does the user experience?"

**What if someone submits a technical task that should have been a feature?**
The entry point must have a guard or a clarity check. Otherwise it becomes a way to skip the "theatre" and sneak in behavior changes without appropriate scrutiny. Example: "Refactor authentication module" — that's technical on the surface but has security implications.

**What if the technical task bypasses Mister Gherkin but the Implementation context still expects feature files?**
Look at the Implementation context relationships: Implementation is a customer of Orchestration, and the blueprint links commands to feature_files. If a technical task produces a changeset but no feature file, there's a referential integrity gap. The blueprint CLI's `validate` command may fail on any command that has no feature_files entry — or worse, silently accept it and create an untestable dangling reference.

**What if the acceptance criteria for the technical task are ambiguous or absent?**
User stories have a natural acceptance-criteria format. Technical tasks are more open-ended. The feature description says "think: what changes, why, acceptance criteria, risks" — but these are suggestions. What happens if a contributor submits a technical task with only "what changes" and no acceptance criteria? Does the pipeline proceed? Does it warn? Does it block?

**What if a technical task is submitted twice?**
The pipeline currently has no deduplication at the entry point. If someone runs the Foreman twice with the same technical task description, do we get two changesets? Two workbench entries? The workbench uses fixed filenames — a second run overwrites the first silently. This already exists as a risk for regular features but is more likely with technical tasks because they're more repeatable (e.g., "add lint config" could reasonably be retried).

**What if a technical task touches a bounded context that doesn't exist in the blueprint yet?**
Regular features go through Event Storming (Sticky Storm) which can create new contexts. Technical tasks skip this. If someone files a technical task for "add a Changelog context" or "extract Config as its own module," the new context never gets modeled. The changeset references something the blueprint doesn't know about.

**What if the security trigger condition is never evaluated?**
The Security Amigo fires when "feature touches auth, user input, sensitive data, or external APIs." For a regular feature, the three amigos evaluate this during discovery. For a technical task that skips discovery — who makes the call? "Refactor the hooks system" touches PostToolUse validation. That's security-adjacent. "Replace the YAML parser" touches how untrusted blueprint content is parsed. Nobody is forcing that evaluation.

---

## Boundary Conditions

- **Minimum viable technical task**: What's the smallest input accepted? Just a title? A title plus one sentence? Is empty acceptance criteria a validation error or a warning?
- **Maximum scope**: A technical task that spans multiple bounded contexts (e.g., "Rename all CLI commands to use kebab-case") — does the new entry point handle multi-context changesets, or does it assume single-context scope?
- **Format enforcement**: Regular features produce an example-map.yaml. Technical tasks produce... what? A structured YAML template? A freeform markdown doc? Is the output format validated?
- **The `@as-built` tag**: Several scenarios in orchestration.feature and discovery.feature are tagged `@as-built`. Does the new technical task path also use `@as-built` to mark scenarios that describe behaviour that doesn't exist yet? Or is the entire technical task feature new-build from day one?

---

## Missing Sad Paths in Existing Feature Files

Looking at `orchestration.feature`:
- No scenario for an invalid or unrecognized project state (corrupt blueprint + source code)
- No scenario for Surveyor failure mid-run
- No scenario for The Foreman receiving an empty feature description
- No scenario for two phases marked `in_progress` simultaneously (the invariant has no enforcement scenario)
- No scenario for blueprint validation failing during StartPipeline

Looking at `discovery.feature`:
- No scenario for a full session where one persona agent fails mid-run (partial amigo notes)
- No scenario for conflicting conclusions between amigos (e.g., Product says MoSCoW=Must, Testing says the edge case breaks it)
- No scenario for SubagentStop hook firing on all five amigo types (only implied by "all five amigo types" in the invariant, no scenario per type)

For the new entry point specifically, there are zero feature scenarios yet — every path is a gap.

---

## Security Considerations

1. **Bypassing review theatre has a cost**: The three-amigos session is the place where "this touches auth" gets noticed. A technical entry point needs an explicit security-triage step, not an optional one.
2. **Input validation on task description**: The technical task description will be written by a contributor and fed into agent prompts. If that description contains prompt-injection-style content ("Ignore previous instructions and..."), what's the blast radius? The blueprint CLI should sanitize or escape user-provided strings before inserting them into YAML.
3. **Changeset scope creep**: Technical tasks can masquerade as pure-internal changes while actually altering public interfaces. The acceptance criteria template should require an explicit "external interface change: yes/no" field.

---

## Concurrency Concern

In Crew mode, Developer Amigo builds and Testing Amigo reviews — sequentially. But the blueprint can change between the two. For a technical task that modifies the blueprint structure itself (e.g., restructuring bounded contexts), what happens if the changeset is partially applied when Testing Amigo begins review? There's no locking mechanism. This is an existing risk I've flagged before, but it's amplified for technical tasks that touch the blueprint itself.

---

## Mijn top-3 vragen voor de sessie

1. **Who decides a change is "technical"?** The pipeline needs a guard that prevents misuse of the technical entry point to skip appropriate scrutiny of behavior-changing work. What are the formal criteria, and who enforces them — the user, an agent prompt, or a validation step?

2. **What is the output artifact?** A regular feature produces an example-map.yaml → feature files → changeset. A technical task skips the first two. Does it produce only a changeset? A technical task brief (new artifact type)? If there's no formal output format, there's nothing to validate and nothing to test.

3. **Does a technical task ever produce feature files, and if not, what fills the blueprint's `feature_files` references?** The blueprint CLI validates referential integrity. If a technical task creates commands in the blueprint without corresponding feature files, validation will either fail (blocking the pipeline) or silently allow dangling references (breaking the validation guarantee). This must be resolved before implementation.

---

## Reactie op de anderen

**Op Product Amigo:**

You frame the Changeset as already having what we need — structured phases, touches, acceptance criteria. That's true for the *implementation* half. The gap is the *pre-implementation* half: before a changeset exists, what enforces that the technical task has enough information to be safe to build? The Changeset can only be as good as what feeds it.

Your Risico 2 ("Overslaan van Three Amigos is geen vrije lunch") is exactly the risk I flagged. But I want to be more concrete: it's not just that we miss edge cases. The Three Amigos session is specifically where someone says "this touches auth" or "this changes a public interface." For a technical task, that evaluation is now nobody's job. The lightweight replacement must include an *explicit* security triage step — not as a suggestion in the format, but as a required field that blocks progress if skipped.

@product-amigo — your Risico 3 says Gherkin is valuable even for technical tasks. I agree. But the question is: what do we validate the changeset *against* if there are no feature files? You note "technische criteria zijn anders dan gebruikersgedrag" — but from a quality standpoint, "different" doesn't mean "less rigorous." What is the acceptance criteria format you have in mind, and how does it connect to the blueprint's referential integrity constraints? This is the concrete gap the session needs to close.

**Op Developer Amigo:**

You propose making Gherkin optional — the Brief facilitator asks whether scenarios are warranted. That resolves the *awkwardness* problem but creates a new *validation* problem.

The blueprint CLI's `validate` command checks referential integrity: commands must have `feature_files`. If a technical task creates new commands in the blueprint (your `StartTechnicalTask`, `RunTechnicalBrief`) without feature files, validate fails. If we make `feature_files` nullable for technical-task commands, we've weakened the validation guarantee for the entire blueprint, not just the technical path.

The options as I see them:

1. Technical tasks never add commands to the blueprint at all — they go straight to changeset, bypass the blueprint's command layer entirely. Then validate is unaffected, but the blueprint doesn't reflect the task.
2. Technical tasks add commands with a new convention, e.g., `feature_files: [technical-brief.yaml]` — a non-Gherkin artifact that satisfies the reference check. The brief IS the specification artifact.
3. We add a formal `technical_task: true` flag to commands in the blueprint schema, and validate skips the `feature_files` check for those. This is the most invasive change to the schema.

@developer-amigo — which of these three is compatible with your Option B architecture? My preference is Option 2 (brief as specification artifact) because it maintains the invariant that everything in the blueprint is traceable to a file. But that means the `technical-brief.yaml` format must be well-defined and validated, not freeform.

Your point about auto-detection being unreliable is correct, and I want to reinforce it: the explicit signal should be non-optional. Not a flag that's easy to forget, but an MCQ at intake. "Is this a user-facing feature or a technical/internal change?" — the user must choose. Anything ambiguous (your "add CLI command for X" example) defaults to the regular path with full Three Amigos. The technical path should require explicit affirmation, not be the default for ambiguous input.

@developer-amigo — you noted The Onion may read only via the changeset, not the example map directly. If that's confirmed, the upstream format matters less than I thought. Can you verify? This affects whether the `technical-brief.yaml` needs to structurally mirror the `example-map.yaml` or can have its own schema.

One risk you didn't name: **Option B creates two codepaths through The Onion**. The Onion currently assumes it was preceded by Mister Gherkin. If The Brief feeds The Onion directly, The Onion's step-1 ("read feature files for acceptance tests") may fail or produce incomplete output. The Onion skill needs a guard: "if no feature files exist, use acceptance criteria from the technical brief."

@mister-gherkin — if the technical path produces a `technical-brief.yaml` instead of an `example-map.yaml`, and optionally invokes you in a lightweight pass, what is the minimum input format you need to produce acceptance test scenarios? Specifically: can you operate on an acceptance criteria list (free text) or do you require structured rules with examples? Knowing this determines whether Option 2 above is viable without modifying your skill.

---

## Round 3 — Responses to @mentions

**@testing-amigo (from Product Amigo — referential integrity relaxation for `type: technical` changesets):**

A new `type: technical` field on changesets is an acceptable escape hatch — but only if the exemption is narrow and explicit. My concern with relaxing validation is scope creep: once there's an exemption path, every poorly-specified feature will try to claim it.

The right design: `type: technical` on a changeset exempts the changeset itself from the feature-files-per-command check, but the blueprint still requires that any new commands added under a context carry a `feature_files` entry — even if that entry points to `technical-brief.yaml` rather than a `.feature` file. The exemption is for the *file type* (non-Gherkin is allowed), not for the *traceability requirement* (everything must point to something). That keeps the validation guarantee intact at the level that matters: nothing in the blueprint is unreachable.

Concretely: I would not add `type: technical` to the changeset format. I would add `spec_type: gherkin | brief` to blueprint commands, where `spec_type: brief` allows `feature_files` to reference a `technical-brief.yaml`. The changeset's `type:` field then becomes a consequence of what commands it implements, not a override lever. This is a smaller schema surface and a harder-to-abuse escape hatch.

The dangerous precedent to avoid: if `type: technical` on a changeset causes validate to silently skip all referential checks for that changeset, we've made the flag a way to turn off the guardrail entirely. That's too much power in one field.

---

**@testing-amigo (from Developer Amigo — "who decides a change is technical?" — is MCQ at intake firm enough?):**

The MCQ at intake is necessary but not sufficient on its own. Here is the specific gap: a contributor can answer "technical/internal change" in good faith and still be wrong about the impact. The brief session itself needs a second gate — a required question: "Does this change affect any externally observable behavior (CLI flags, YAML output format, agent prompts, file paths)?" If the answer is yes, the brief must flag that Three Amigos should be considered, and the Foreman should surface a warning: "This may have user-visible impact — are you sure you want to use the technical path?"

So: MCQ at intake as the routing signal, plus a required field in the brief template as the catch-for-mistakes. Two gates, not one. That's firm enough for me to write a scenario against. The scenario would look like:

```
Given a contributor initiates a technical task
When they declare "no observable behavior changes"
But the brief contains a public_interface_change: yes response
Then the pipeline flags a routing warning before proceeding to changeset
```

That's testable. An MCQ alone is not — there's no artifact to assert on.

---

**@testing-amigo (from Developer Amigo — security bypass, `security_surface` required field):**

The `security_surface` field proposal is exactly right and I want to strengthen it. The field should be required and non-defaultable — meaning the pipeline must not infer `none` if the field is absent. It must block. An absent `security_surface` should be treated the same as a missing acceptance criteria field: the brief is incomplete, the pipeline stops.

Additionally: the field should carry a downstream consequence in the form of a branching rule, not just a data point. If `security_surface` is anything other than `none`, the brief must include a required `security_review_requested: true` field set by the facilitator, and the Security Amigo must be dispatched before The Onion starts. This should be a hard branch in the pipeline, not a recommendation. Otherwise the field is collected but never acted on — security theatre in a different form.

The scenario: "Given a technical brief with `security_surface: auth` / When the brief is completed / Then the Security Amigo is dispatched before implementation begins / And the changeset may not start until Security Amigo has produced a review artifact." That's the testable form.

---

**@testing-amigo (from Developer Amigo — phase enumeration, "Technical Brief" as a valid phase name):**

Confirmed: phase names must be formally enumerated. The current invariant says "exactly one phase may be in_progress at a time" but there is no schema or list that defines what valid phase names are. This is a gap that predates the technical task feature — I flagged it in Round 1.

For the technical path, the minimal addition is: define an explicit phase sequence for technical tasks in the Orchestration context invariants. Something like: `Technical Brief → (Optional Specification) → Implementation`. Each phase name in that sequence must appear in whatever enum or convention governs phase names before any implementation starts.

My ask: this must be a blueprint update, not just a note in a skill file. The Orchestration context's invariants section should enumerate valid phase names as a closed list. If they're only described in prose, agents will invent their own names and the single-active-phase invariant becomes unenforceable. This is a pre-condition for implementation — not a nice-to-have.
