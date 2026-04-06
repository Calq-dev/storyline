# Testing Amigo — Ronde 1

Feature: Turn skills into Gherkin format
Session date: 2026-04-06

---

## The Verification Problem

Before I get to edge cases and sad paths, I need to name the foundational problem with this feature: **there is no test runner for skill behavior**. Skills are LLM prompts. Their output is non-deterministic. There is no Cucumber, no RSpec, no assertion framework that invokes `/storyline:the-foreman` and checks whether it used `TodoWrite`. This changes every other quality question.

What does "testable" even mean here?

For deterministic software, a Gherkin scenario describes a contract: "Given X / When Y / Then Z must be true." Z is verifiable by a machine. For skills, Z is "Claude produced output that a human judges to be consistent with the scenario." That's not testability — that's a review checklist with Gherkin syntax. It is valuable, but it's a different thing.

This matters because the entire quality layer we're discussing operates at a different level depending on how we answer this. If the goal is **living documentation** (human-readable spec), the quality bar is: is this Gherkin accurate and readable? If the goal is **executable acceptance criteria**, the quality bar is: can these scenarios drive automated verification? Today, and for the foreseeable future in this codebase, the answer to the second question is no.

I'll proceed with both bars in mind, but I want the team to be clear: anything we build here is human-verification tooling, not automated quality assurance.

---

## What's Hard to Verify Today

These are the verification gaps that exist right now, regardless of format:

**1. Skill drift is invisible**
There is no mechanism to detect when a SKILL.md diverges from the `.feature` files that describe its behavior. The `.feature` files are all tagged `@surveyed` — they were written from observed behavior, once. Since then, skills have been edited. Nobody knows whether `orchestration.feature` still accurately describes `the-foreman/SKILL.md`. The gap exists and is growing.

**2. Decision tree branches are not verified**
The Foreman has a decision tree. Only the happy paths (detected in the survey) appear in the feature file. The branch where "blueprint exists but is stale" has one scenario. The branch where "blueprint exists and is current" has one scenario. None of the branch boundaries (what counts as stale? what if staleness is borderline?) have coverage.

**3. Hard gates are not tested**
Skills contain `<HARD-GATE>` blocks — explicit refusal instructions. "Do NOT explore the codebase." "If you see X, stop and ask." These are safety constraints. No existing scenario verifies that a hard gate is respected. You could remove a hard gate from a skill and nothing in the test suite would catch it.

**4. The SubagentStop hook warning has one scenario and it is vacuous**
`discovery.feature` has: "Given a persona agent finishes a session / And its memory file was not updated within 30 seconds / When the SubagentStop hook fires / Then a warning is emitted." That scenario describes the hook as if it works, but there is no scenario for: what happens if memory IS updated? What if the hook fires but the file was updated 31 seconds ago? What's the tolerance? The existing scenario is a description, not a test.

**5. Tool-requirement enforcement is unverifiable**
Skills say things like "ALWAYS use `AskUserQuestion` for choices" and "ALWAYS use `TodoWrite` for todos." There is no automated check that these were followed. Gherkin cannot change that — but it should at least name these as expectations that a human reviewer looks for.

---

## What Could Go Wrong If Skills Are Converted

### Risk 1: Gherkin in a SKILL.md is treated as instructions, not documentation

A SKILL.md is consumed by Claude Code as prompt context. If I add a Gherkin block:

```gherkin
Given the user has no blueprint
When the Foreman is invoked
Then it asks what to build
```

Claude may try to "execute" this scenario when the Foreman skill is loaded. Or it may read it as an instruction to produce Gherkin output. The surrounding prose determines how Claude interprets embedded content — but that is not a guarantee. The mister-gherkin skill already embeds Gherkin code blocks safely because they are inside fenced code blocks labeled as examples. Bare Gherkin in a SKILL.md (not inside a code fence) is ambiguous.

Failure mode: skill starts producing Gherkin output instead of following its instructions.

Mitigation: any Gherkin embedded in a SKILL.md must be inside a clearly labeled code fence ("```gherkin"). Bare Gherkin in prose sections is unsafe.

### Risk 2: Dual maintenance trap

If we add Gherkin to SKILL.md files AND keep the `.feature` files in `.storyline/features/`, we have two specifications for the same behavior. When the Foreman's decision tree changes:
- Developer edits `the-foreman/SKILL.md` (the "how")
- Developer should update `orchestration.feature` (the "what")
- If we added Gherkin inside SKILL.md, developer should also update that

Three-way sync with no enforced relationship. This is how specifications die — through slow divergence that nobody notices until the behavior doesn't match any of them.

The question is not "should Gherkin be in SKILL.md" but "what is the single authoritative location for skill behavior specs?"

### Risk 3: Coverage appears better than it is

If we write Gherkin scenarios for skills, there's a psychological risk: contributors will feel the skill is "covered." But Gherkin scenarios for non-deterministic LLM behavior are not coverage — they are documentation of intent. The gap between "scenario says X" and "skill produces X" is not closed by adding more scenarios. It's closed by running the skill against the scenario — which we cannot do automatically.

This is the "false confidence" risk. A test suite with lots of green tests that don't actually verify the thing they claim to verify.

### Risk 4: The wrong scenarios get written

Gherkin is designed for observable behavior from a user perspective. Skill behavior has two layers: external behavior (what the user sees) and internal behavior (what the skill does internally — reads files, runs CLI commands, dispatches agents). If we write Gherkin for skills, there's a strong pull toward specifying internal behavior ("Given the blueprint exists / When the Foreman runs `storyline summary`..."). That violates Gherkin's first principle: scenarios describe observable outcomes, not implementation.

Who enforces that the skill-level Gherkin stays declarative? There's no Mister Gherkin reviewing skill-level scenarios. The quality gate that exists for feature files doesn't exist for skill files.

### Risk 5: Skills grow in size at a bad layer

Interpretation B (parallel spec files per skill) or even Interpretation C (embedded sections) increases SKILL.md size. The Foreman is already 336 lines. Adding a `## Behavior Specification` section with 10 scenarios is another 60-80 lines. That's ~20% more tokens injected into context on every invocation. Multiplied across all 8 skills. This is a real cost with every pipeline run, paid by every user.

The more Gherkin we add to skills, the higher the token cost per invocation. At some point this degrades performance in ways users notice (slower responses, context window pressure).

---

## Invariants That Must Hold Regardless of Format

These must be true no matter which interpretation is chosen:

**INV-1: Skills must remain executable as Claude Code prompt instructions.**
The frontmatter `name`/`description` must stay. The instruction content must remain prose-first. No format change may cause Claude to interpret a skill as something other than an instruction prompt.

**INV-2: There must be exactly one authoritative location for each skill's behavior spec.**
If Gherkin lives in SKILL.md AND in `.storyline/features/`, there must be a documented rule for which is authoritative. If both claim authority, the spec is undefined. If neither is authoritative, there is no spec.

**INV-3: The validation chain must cover any new spec artifact.**
`storyline validate` checks referential integrity for commands → feature_files. If skill-level `.feature` files are added outside `.storyline/features/`, they are invisible to validation. Either they must be added to the validation scope, or they must be understood as advisory-only (not linked to blueprint commands).

**INV-4: Gherkin quality rules apply uniformly.**
If Mister Gherkin's rules (declarative, one behavior per scenario, no implementation steps) apply to feature files, they apply to skill-level Gherkin too. There cannot be two classes of Gherkin with different quality standards in the same codebase.

**INV-5: Any Gherkin scenarios written for skills must be human-verifiable, not just plausible.**
A scenario that no human can meaningfully verify against real skill invocation output is a documentation lie. Scenarios must be written at a level of specificity that a contributor can actually compare against Claude's behavior in a real invocation.

---

## Boundary Conditions and Edge Cases

**Boundary: The Foreman's decision tree has 4 branches — only 2 have scenarios today.**
`orchestration.feature` covers: empty project, stale blueprint. It does not cover: blueprint exists and is current (detected state but no scenario), corrupt blueprint (invalid YAML — what happens?). If we're adding Gherkin for skill behavior, the complete branch table must be covered, not just the cases that were easy to observe in the survey.

**Edge case: A skill that embeds Gherkin examples already (mister-gherkin/SKILL.md).**
Mister Gherkin's skill already embeds Gherkin code blocks inside fenced sections — as quality examples. If we "add Gherkin to skills," does this skill get a second Gherkin layer? How do contributors distinguish "Gherkin as quality example" from "Gherkin as behavior spec"? Naming conventions or section headers must be unambiguous.

**Edge case: The persona-memory skill is only 71 lines and has no corresponding feature file.**
`persona-memory/SKILL.md` defines conventions but has no spec in `.storyline/features/`. If we're writing Gherkin for skills, this is the simplest case (small, no decision trees). It's also the one where Gherkin would be most obviously redundant — the conventions are already declarative prose.

**Edge case: A contributor writes a Scenario Outline with an Examples table for a decision tree.**
Who validates it? Mister Gherkin only runs on user-facing feature files. Skill-internal Gherkin has no quality gate. An agent could write a scenario outline with correct syntax but wrong semantics — and nothing catches it.

**Boundary: token cost at scale.**
The current 8 skills total ~1,897 lines. If Interpretation B adds companion `.feature` files averaging 50 lines each, that's 400 additional lines per session. But those companion files are NOT injected into context (they're not in SKILL.md). Interpretation C (embedded in SKILL.md) adds those lines to every invocation. At the extreme (Interpretation A — replace prose with Gherkin), token cost decreases but skill function breaks. The boundary where "more Gherkin" becomes "slower pipeline" needs to be explicitly defined and tested.

**Edge case: what happens when the pipeline builds itself?**
This project is its own consumer — the pipeline builds the pipeline. When the Foreman runs in this project, it reads skill files that include Gherkin. If Gherkin in skills is misread as instructions and the Foreman starts producing Gherkin output instead of following instructions, the pipeline's self-application breaks. This is a real test scenario because Storyline is used on itself.

---

## Missing Sad Paths in Existing Feature Files

Reviewing the current feature files for coverage relevant to this feature proposal:

**`specification.feature` (Mister Gherkin):**
- No scenario for Mister Gherkin being invoked on a skill-level spec (if we add those)
- No scenario for Mister Gherkin detecting conflicting scenarios across two spec layers (SKILL.md and `.feature` file)
- No scenario for the quality gate finding a scenario that describes internal behavior instead of observable output
- No scenario for Mister Gherkin refusing to formalize a scenario that is not human-verifiable

**`discovery.feature`:**
- No scenario for Three Amigos being asked to specify a change to a skill file itself (meta-use of the pipeline)
- No scenario for full session where the feature is "meta" (pipeline improving itself)

**`blueprint-management.feature`:**
- No scenario for `validate` running against a blueprint that references a `technical-brief.yaml` or a skill-level `.feature` file
- No scenario for `validate --strict` mode on a blueprint with mixed spec types (gherkin vs brief vs skill-spec)

**`orchestration.feature`:**
- No scenario for the Foreman detecting that a skill file and its corresponding `.feature` file have diverged (no tool for this today — but it's the core problem this feature is trying to solve)

---

## What "Done" Looks Like

How would we know this feature worked? Specific verification criteria:

**If Interpretation C (selective embedding) is chosen:**
- A contributor can open a SKILL.md and immediately find a labeled section that shows the skill's decision branches as Gherkin scenarios
- The scenarios are declarative (no implementation steps visible)
- The scenarios are consistent with the corresponding `.feature` file in `.storyline/features/` (no contradictions)
- Running the skill and comparing output to the scenarios is possible in under 5 minutes per scenario
- The SKILL.md has not grown in a way that visibly degrades Claude's response time or coherence

**If Interpretation B (parallel spec files) is chosen:**
- A `<skill>.feature` file exists alongside SKILL.md for at least one skill (the pilot)
- The file is not reachable by `storyline validate` in a way that breaks existing validation
- The file has a documented relationship to the existing `.feature` file for that skill (duplicate? extension? replacement?)
- A contributor can use the file as a review checklist when invoking the skill manually
- The file passes Mister Gherkin's quality rules: declarative scenarios, correct Rule:/Scenario: structure, no implementation steps

**What "done" is NOT:**
- "We added Gherkin to a SKILL.md file." That's activity, not outcome.
- "The scenarios look reasonable." That's aesthetics, not quality.
- "Automated tests pass." There are no automated tests for skill behavior — this is not a done criterion.

The quality bar I'm holding: after this feature, can a contributor who is unfamiliar with a skill use the Gherkin to verify that the skill behaved correctly in a real invocation? If yes, done. If they need to read all 336 lines of prose to answer that question, the feature didn't ship.

---

## Concurrency and Maintenance Concerns

The skills in this codebase are modified by contributors across sessions. There is no locking, no version check, and no CI pipeline that would catch a skill edit that violates its spec. Any Gherkin we add is only as good as the discipline of contributors to update it when they change a skill.

This is not a new risk — the existing `.feature` files have the same property. But if we add a second spec layer (inside SKILL.md), we double the maintenance burden for every skill change. The discipline argument breaks down as the codebase grows.

The clean solution is: one spec location per skill. Either the `.feature` file in `.storyline/features/` is the spec and the SKILL.md is the implementation (BDD: spec drives implementation), or the SKILL.md is self-contained and the feature file is generated from it (which is the current as-built direction). You cannot have both without a maintenance burden that compounds over time.

---

## Mijn top-3 vragen voor de sessie

1. **What is the single authoritative location for skill behavior specs — and what happens when it diverges from the skill implementation?** The core problem is drift, not format. If we don't answer "which file wins when they disagree," we're adding documentation without solving the underlying quality problem.

2. **What does "a human reviewer verifies a scenario" look like in practice?** I need to see one concrete example: pick a scenario, invoke the skill, compare output. If that process takes more than 5 minutes and requires reading the full SKILL.md anyway, the Gherkin layer adds cost without adding verifiability. The answer determines whether Interpretation B or C is worth the investment.

3. **Who enforces quality on skill-level Gherkin?** For feature files, Mister Gherkin runs the quality gate. Who runs it for skill-level scenarios? If the answer is "nobody — contributors self-review," the quality will decay. If the answer is "Mister Gherkin also reviews skill specs," that's a scope extension to the Specification context that needs a scenario of its own.

@product-amigo — you asked: what does "a scenario passes" mean for a skill given no test runner exists? My answer: "passes" means a human reviewer can execute the skill, compare Claude's observable behavior to the scenario's Then clause, and make a binary judgment in under 5 minutes. If the Then clause is too vague to allow that judgment, the scenario is not verifiable and should not be written. What's your framing for "value delivered" if verifiability is this limited?

@developer-amigo — you flagged that Gherkin in SKILL.md is only safe if wrapped in code fences. I agree. But I want to be more specific about the risk: fenced Gherkin in Mister Gherkin's SKILL.md is safe because that skill is about Gherkin — the context makes the intent clear. Fenced Gherkin in the Foreman's SKILL.md is semantically ambiguous — Claude might treat it as a description of what it should produce (outputs) or what it should do (instructions). Have you tested this? Running the Foreman with a fenced Gherkin block in its skill file and verifying the output doesn't change is the one test we can actually run here. @developer-amigo — can you do that test before we commit to Interpretation C?

---

## Round 2

### @testing-amigo (from Developer Amigo — does authoring discipline close the skill-drift and hard-gate coverage gaps?)

The Developer Amigo's Round 2 conclusion is: the real fix is authoring discipline — add a spec-first rule to `skills/CONVENTIONS.md` and fill 4-5 missing scenarios in the existing feature files. No SKILL.md format changes.

Does this satisfy my quality invariants? Let me be precise about each gap I named.

**Skill-drift gap: partially closed, not fully closed.**

The authoring discipline rule ("update the scenario before editing SKILL.md") addresses future drift — changes made after the convention is written. It does not address the existing drift. Every SKILL.md has already been edited since the `@surveyed` files were written. I do not know how large that gap is today. The convention closing the gap going forward is real value. But claiming the drift problem is "solved" after adding a CONVENTIONS.md rule would be false confidence.

What would actually close the existing drift: a one-time audit pass where a contributor reads each `SKILL.md` alongside its corresponding feature file and verifies that no currently-specified branches are missing from the Gherkin. This is not a code change — it is a manual reconciliation task. It probably takes 2-3 hours for all 8 skills. It is out of scope for this session but should be flagged as a follow-up task.

**Hard-gate coverage gap: not closed by convention alone.**

The Developer Amigo's Layer 2 (coverage gaps) lists: "Foreman's hard gate being respected (no scenario today)." I see that as a line item — good. But it is one scenario. The hard gate coverage gap I named in Round 1 is broader: multiple skills have `<HARD-GATE>` blocks, and NONE of them have scenarios verifying the gate is respected.

Filling one scenario (the Foreman's hard gate) is a start, not a close. The complete fix is: for each skill that contains a `<HARD-GATE>` block, at least one scenario in the corresponding feature file tests that the gate fires when the trigger condition is met.

How many skills have hard gates? I should note: based on what the Developer Amigo found (all 8 skills, 1,897 lines total), the `<HARD-GATE>` blocks appear in at least the Foreman and the Three Amigos skill (story size hard gate). Mister Gherkin may also have one. That is at minimum 3 skills needing hard gate scenarios — not 1.

**My amended requirement for this session's deliverable:**

The 4-5 scenarios the Developer Amigo proposes are directionally correct. I want to be explicit about the minimum set needed to close the gaps I identified:

1. Foreman: "blueprint exists and is current" (currently no scenario — decision tree branch is unspecified)
2. Foreman: hard gate fires when user attempts to skip spec step (no scenario today)
3. Three Amigos: hard gate fires when story size >= 8 (the Scenario Outline the Developer proposed covers this, but it must exist in a feature file, not only in a SKILL.md)
4. Mister Gherkin: quality gate rejects a scenario with implementation-level steps (sad path — currently missing per my Round 1 analysis)
5. Foreman: MCQ is presented before routing decision (internal behavior not directly observable, but its absence is observable — "Foreman routes without asking" is a failure mode we can specify)

Those 5 cover the highest-risk gaps. The convention rule in CONVENTIONS.md is necessary but not sufficient — the scenarios must actually exist before the convention has anything to enforce.

**Answer: yes, the Developer Amigo's proposal satisfies my invariants if and only if:**
- The convention is written (spec-first rule, explicit)
- All 5 scenario gaps above are filled (not just "some" of them)
- The existing drift from before the convention is logged as a follow-up audit task

---

### @testing-amigo (from Developer Amigo — is `@spec-first` tag distinction enough, or is something stronger needed?)

The Developer Amigo proposes: new scenarios written spec-first carry no `@surveyed` tag (or an explicit `@spec-first` tag). The absence of `@surveyed` signals the authoring order.

My position: the tag distinction is necessary but not sufficient on its own. Here is why.

**What the tag does:**

It makes authoring intent visible. A contributor reading the feature file can see which scenarios were written after behavior (surveyed) and which were written before (spec-first). That is useful for reasoning about coverage quality.

**What the tag does not do:**

It does not prevent a contributor from editing SKILL.md without updating the scenario. The tag is retrospective — it describes how the scenario was authored, not whether the discipline was followed for a subsequent change. Scenario A is tagged `@spec-first` on day 1. On day 30, a contributor edits the Foreman's routing logic without updating Scenario A. Scenario A still has the `@spec-first` tag. Nothing changed in the tag. The drift just started.

**What would be stronger:**

A CI check or pre-commit hook that verifies: if `the-foreman/SKILL.md` is modified in this commit, `orchestration.feature` must also be modified in this commit. This is a structural enforcement rule — skill change without corresponding feature file change fails the check.

Is this feasible in this codebase? The `storyline validate` command could potentially include this check if it were given access to `git diff`. A simpler version: a pre-commit hook script that checks for paired edits. This is low-cost to implement and would be the first automated quality gate on skill authoring discipline.

**My recommendation:**

For this session: tag convention (`@spec-first` vs. absence of `@surveyed`) as the immediate deliverable. It is zero-code and visible.

As a follow-up: add a validation rule to the `storyline validate` pipeline or a pre-commit hook: "if SKILL.md is modified without a corresponding feature file modification in the same commit, emit a warning." Not a hard failure — a warning. Hard failures in commit hooks are friction generators that get disabled. A warning surfaces the discipline without blocking a legitimate "update skill prose without behavior change" commit.

@developer-amigo — the hook or validation warning idea is worth capturing as a gap. Flag it in Layer 3 or as a backlog item. It is the difference between "we have a convention" and "the convention has teeth."

---

### Self-application risk: how serious is it?

My Round 1 question: "the pipeline runs on this very codebase. If a skill scenario is wrong, the pipeline misguides its own development. How serious is this?"

Having read the Developer Amigo's Round 2 analysis, I can now answer more concretely.

**The severity is high, but the failure mode is slow, not catastrophic.**

Here is the specific chain of failure:

1. A contributor edits `the-foreman/SKILL.md` to add a new routing branch
2. They update `orchestration.feature` to reflect the new branch (following the new discipline)
3. But the scenario they write is wrong — it specifies the OLD behavior (spec was written too quickly, contributor was unsure)
4. Now `orchestration.feature` claims the Foreman does X. The Foreman actually does Y.
5. Someone in a future Three Amigos session uses `orchestration.feature` as ground truth to understand what the Foreman does
6. The Three Amigos session produces recommendations based on a false understanding of the Foreman
7. The Developer Amigo implements changes based on those recommendations
8. The implementation diverges from actual Foreman behavior

This failure chain is not fast. It compounds over multiple sessions. By the time it surfaces, the origin — the wrong scenario in Step 3 — is hard to identify.

**What makes self-application especially risky:**

The pipeline uses its own blueprint to understand itself. `storyline summary` and `storyline view` read `blueprint.yaml`. If the blueprint says "The Foreman's decision tree has 3 branches" but the SKILL.md has 4, agents reading the blueprint will plan changes that conflict with the actual behavior. The Storyline codebase has the unique property that its specification artifacts and its implementation artifacts both live in the same repository — and both are read by agents that modify the same repository.

This creates a feedback loop that most codebases don't have: wrong specification propagates into future implementations, which update the specification to describe the now-wrong implementation, which guides the next round of changes.

**The mitigation:**

There is no automated mitigation available today. The structural mitigation is the spec-first discipline — if scenarios are updated thoughtfully before SKILL.md changes (not rushed, not as an afterthought), wrong scenarios are less likely.

The practical mitigation I recommend: before any Three Amigos session on a skill-related feature, a manual "reality check" step should be added to the Foreman's task list. One line: "verify that the feature files for affected skills match current SKILL.md behavior before starting." This does not add code. It adds a checkpoint.

For the current session specifically: the 5 scenarios we're planning to write should each be validated against current skill behavior before being merged. Not assumed correct because they were spec-first — actually checked by invoking the skill (manually, given no test runner) and confirming the Then clause is accurate.

**Summary of severity:**

The self-application risk is high-severity, slow-onset, and currently unmitigated. It is the most important quality concern in this entire session. The tag convention and coverage gaps are tactical. The self-application feedback loop is strategic.

My top-3 questions still stand from Round 1, plus one addition:

4. Who performs the "reality check" before a Three Amigos session on a skill-related feature — and is that step written into the Three Amigos SKILL.md as a conditional step?
