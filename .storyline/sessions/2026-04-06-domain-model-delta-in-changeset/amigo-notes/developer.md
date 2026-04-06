# Developer Amigo — Technical Analysis

Feature: Turn skills into Gherkin format
Session date: 2026-04-06

---

## What I Found in the Code

### Skills are prompt files, not software modules

Skills live at `skills/*/SKILL.md`. They are read by Claude Code at invocation time as prompt context. They are not parsed by any tooling, not executed by a test runner, and not referenced by the blueprint. The only structural contract is the YAML frontmatter (`name`, `description`, `argument-hint`) which is consumed by the Claude Code plugin manifest. Everything below the frontmatter is free-form prose with a few XML tag conventions (`<HARD-GATE>`, `<todo-actions>`, `<bash-commands>`, `<user-question>`, `<agent-dispatch>`, `<branch-todos>`).

Skills range from 71 lines (persona-memory) to 336 lines (the-foreman). Average ~237 lines. All instruction prose, no Gherkin.

### The existing Gherkin is already about skills — just living elsewhere

There are 11 `.feature` files in `.storyline/features/`, all tagged `@surveyed`. They specify the pipeline as a software product, from the outside. These ARE the Gherkin specs for skill behavior:

- `orchestration.feature` → specifies the-foreman
- `discovery.feature` → specifies three-amigos
- `specification.feature` → specifies mister-gherkin
- `implementation.feature` → specifies the-onion
- `blueprint-management.feature` → specifies the CLI (not a skill, but adjacent)
- etc.

This is the key architectural fact. The spec-and-code separation already exists in the codebase. The `.feature` files are the "what." The `SKILL.md` files are the "how-to-instruct-an-LLM-to-do-the-what." The proposal raises the question: what would it mean to add Gherkin to the "how" files?

### What SKILL.md files currently do that Gherkin cannot do

Reading all skills, they contain things that have no Gherkin equivalent:

1. **Persona establishment** — "You are The Foreman — practical, no-nonsense..." — this is not behavior, it's identity
2. **Hard gates** — `<HARD-GATE>` blocks that tell the LLM to refuse certain actions — this is a safety constraint, not a scenario
3. **Tool requirements** — `<TOOL-REQUIREMENTS>` that mandate specific Claude Code tool usage — this is a capability prescription, not observable behavior
4. **Decision trees** — dot digraphs for routing — these could be expressed as Scenario Outlines but only partially
5. **Bash command blocks** — `<bash-commands>` that tell the LLM exactly what to run — this is imperative procedure, not declarative specification
6. **Agent dispatch templates** — `<agent-dispatch>` with full prompt text — this is configuration, not behavior description
7. **Interaction style guidance** — "Be warm but structured, you're running a meeting not lecturing" — this is LLM behavior shaping, not testable output

These categories cannot be replaced by Gherkin without losing their function. Gherkin specifies observable outcomes from a user's perspective. Skills prescribe internal LLM behavior.

---

## The Three Viable Interpretations — Technical Assessment

**Interpretation A: Replace SKILL.md with Gherkin**

Not technically feasible as written. Claude Code reads skills as prompt context — the LLM interprets the text. If a SKILL.md were pure Gherkin, the LLM would receive a list of scenarios with no instruction on how to interpret or execute them. The LLM does not have a Cucumber runner — it has to be told what to do in prose. A SKILL.md that is only Gherkin would be ambiguous about whether to "run" the scenarios, "pass" them, or use them as documentation.

Specific danger: Mister Gherkin's SKILL.md contains a Gherkin syntax reference (showing correct and incorrect examples). Claude Code handles this fine today because the surrounding prose makes clear: "here's what good Gherkin looks like." If the whole file were Gherkin, those examples might be interpreted as step definitions or actual instructions.

Verdict: Technically unsafe. Do not pursue.

**Interpretation B: Add Gherkin as a parallel quality/verification layer**

Gherkin scenarios written for skills as acceptance criteria — "the skill is done when these pass." Stored alongside SKILL.md or in a separate file. Used for human-verification or contributor onboarding, not automated execution.

Technical viability: Yes, but the value proposition is thin. The `.feature` files in `.storyline/features/` already do this. They describe skill behavior. Adding another set of Gherkin files (inside `skills/`) would create two parallel specs with no enforced relationship between them. If `orchestration.feature` says "The Foreman asks what the user wants to build" and a hypothetical `skills/the-foreman/foreman.feature` says the same thing, we now have two files to update when the behavior changes.

The only scenario where this adds value without duplication: if the skill-internal scenarios describe *internal behavior details* that are too fine-grained for the public-facing feature files. E.g., the Foreman's decision tree branching — the existing `orchestration.feature` doesn't verify "does the Foreman present an MCQ before routing?" at that level of detail. A skill-internal spec could.

**Interpretation C: Embed Gherkin examples inside SKILL.md for specific decision points**

Some parts of skill files are already structured enough to express as Gherkin. The Foreman's decision tree is currently a dot digraph (graphviz syntax). Three Amigos' story size gate is a Markdown table. These are behavioral rules with inputs and outcomes — exactly what Gherkin's `Rule:` + `Scenario Outline:` are designed for.

Technical viability: Yes, with caveats. Embedding Gherkin in an otherwise prose SKILL.md is safe only if Claude interprets it as documentation/example material, not as instructions to execute. Based on how the skills are structured today (prose instructions + example snippets), a clearly-labeled `## Behavior Specification` section with Gherkin blocks would be treated as illustrative examples. This is what `mister-gherkin/SKILL.md` already does — it embeds Gherkin code blocks to show correct and incorrect patterns. The LLM reads them as examples, not commands.

---

## Technical Constraints

**1. Skills are LLM prompt context, not parsed files.**
No tooling reads skills except the Claude Code plugin SDK (which only reads the frontmatter). Any Gherkin added to a SKILL.md would be consumed exclusively by an LLM. This has two implications:
- Gherkin embedded in a skill that contains instructions may be treated as instructions by the LLM (ambiguous intent)
- Gherkin embedded in a skill CANNOT be automatically tested — there is no test runner that invokes a skill and asserts on Claude's output

**2. Token cost is real.**
All 8 skills total 1,897 lines today. Adding Gherkin to each would increase that. Interpretation C (selective embedding at decision points) might add 20-40 lines per skill — call it +200-300 lines across the plugin. That's ~15% size increase. Acceptable. Interpretation B (parallel spec files) would roughly double the line count of skill-related content.

**3. The `.feature` files already cover the same territory.**
Any Gherkin written for skills must either:
(a) live inside the `.feature` files that already exist (extending them)
(b) live as new files with a clear non-duplicate scope
(c) live inside SKILL.md as illustrative examples only

Option (a) is the lowest-friction path. The `orchestration.feature`, `discovery.feature` etc. already specify skill behavior. Adding missing or more detailed scenarios to those files is the correct change if the goal is "better Gherkin coverage of skills."

**4. Skills have no programmatic interface.**
A REST endpoint has a URL, an HTTP verb, request/response shapes — all assertable. A skill has an invocation trigger and a prose output. "Given the Foreman is invoked with a stale blueprint / When it detects staleness / Then it presents a refresh option" — how do you automate that assertion? You'd need to invoke Claude, read its output, and check that it followed the scenario. That's an LLM evaluation problem, not a test problem. Nobody has a test runner for this.

**5. Interpretation A breaks the CONVENTIONS.md contract.**
The `skills/CONVENTIONS.md` defines the file structure: YAML frontmatter + structured Markdown. Any change to skills must be backward compatible with this schema. Gherkin as the primary format would violate the convention that the file is a structured Markdown instruction prompt.

---

## Complexity Assessment

**Low complexity:**
- Adding `Rule:` + `Scenario:` blocks to the existing `.feature` files to cover decision-tree cases that are currently missing (e.g., Foreman's MCQ routing behavior, Three Amigos' story size gate edge cases)
- Embedding Gherkin code examples inside SKILL.md to illustrate specific decision points (like Mister Gherkin already does for scenario quality)

**Medium complexity:**
- Creating a parallel `<skill>.feature` file for each skill, stored in `skills/<skill>/` or a new `features/skills/` directory — requires a convention decision about where these live and how they relate to `.storyline/features/`

**Hard part (and probably not the right problem):**
- Creating a test harness that executes skills and asserts Claude's behavior against Gherkin scenarios — this requires LLM-evaluation tooling, determinism assumptions that aren't valid, and infrastructure that doesn't exist in this codebase

---

## Architecture Impact

### What already exists that we'd be building on or around

```
.storyline/features/          <- 11 .feature files specifying pipeline behavior
skills/*/SKILL.md             <- 8 skills as prose instruction files
skills/CONVENTIONS.md         <- skill authoring conventions
.claude-plugin/plugin.json    <- plugin manifest (reads skill frontmatter)
```

No tooling currently reads `.feature` files inside the `skills/` directory. The `storyline validate` and `storyline summary` commands operate only on the `blueprint.yaml`. Feature files in `.storyline/features/` are referenced by blueprint commands, not by skills.

### The key architectural question

The `.feature` files in `.storyline/features/` are the pipeline's specification artifacts. They are produced by the pipeline for target-project features. The fact that they also describe the pipeline's own behavior is somewhat accidental — they were created by a survey (`@surveyed`) of the plugin itself.

There is a conceptual confusion here that this feature surfaces:

- **Level 1 feature files**: specs for a target project's features (what the plugin is *for*)
- **Level 2 feature files**: specs for the pipeline plugin's own behavior (what the plugin *is*)

Right now both levels live in `.storyline/features/`. For a project that uses Storyline to build a shopping cart, this directory would contain both `shopping-cart.feature` (their feature) and `orchestration.feature` (the plugin's behavior). That collision would need resolving if we want to use the same directory for both levels.

### What would a clean architecture look like?

If the goal is "use Gherkin to specify skill behavior more precisely," the cleanest structure would be:

```
skills/the-foreman/SKILL.md               <- instructions
skills/the-foreman/the-foreman.feature    <- behavior spec (new)
```

Or — keeping the plugin's spec files out of the user's `.storyline/features/` directory:

```
.storyline/features/          <- target project feature files only
skills/features/              <- plugin's own behavior specs (new)
  orchestration.feature
  discovery.feature
  ...
```

This would mean moving the existing `@surveyed` feature files out of `.storyline/features/` into a plugin-level location. That's a significant structural change with a clear benefit: the separation of "specs I'm building" from "specs of the tool I'm using."

---

## Concrete Examples

**Where Gherkin would actually improve a skill (Interpretation C):**

Three Amigos, story size gate — currently a Markdown table:

```markdown
| Rules | Action |
|---|---|
| ≤ 4 | Right-sized → continue |
| 5–7 | Warn → offer to split |
| ≥ 8 | Hard gate → propose split immediately |
```

This could be a Scenario Outline in a `Rule:` block, making the branches explicit and assertable:

```gherkin
Rule: Story size determines whether to continue or split

  Scenario Outline: Story size gate
    Given a story has <count> rules
    When the Three Amigos facilitator evaluates size
    Then the outcome is <action>

    Examples:
      | count | action                                        |
      | 3     | continue without warning                      |
      | 5     | warn and offer split choice                   |
      | 8     | hard gate — propose split immediately         |
```

This is clearer than the table, follows existing Gherkin quality rules, and could live in `skills/three-amigos/three-amigos.feature` or be added to `discovery.feature`.

**Where Gherkin would NOT improve a skill:**

The Foreman's character setup:

```
You are The Foreman — practical, no-nonsense. You read the blueprints, assess what's been built, put the right crew to work.
```

There is no Gherkin equivalent for this. "Given an LLM / When it reads this prompt / Then it should respond like a foreman" is not a useful scenario. LLM persona definitions must stay as prose.

---

## My Read on the Real Goal

The `@surveyed` tag on every existing `.feature` file signals something important: these were generated from observed behavior, not written before implementation. They describe what was built. They are documentation, not a living specification used to drive behavior.

The real value of "skills as Gherkin" might not be about *format* — it might be about *authoring order*. If someone proposes changing the Foreman's decision tree, should they:
(a) edit SKILL.md directly (today's practice), or
(b) update the scenario in `orchestration.feature` first, then adjust SKILL.md to match

Option (b) is BDD: spec first, implementation second. The fact that "implementation" here is an LLM prompt rather than code doesn't change the principle. This is possibly what the user actually wants: a discipline where skill changes are spec-driven, not ad hoc.

If that's the goal, the technical path is:
1. Ensure each skill has corresponding scenarios in a `.feature` file (adding missing ones to the existing `@surveyed` files)
2. Establish a convention: "before editing a SKILL.md, update or add the relevant scenario first"
3. No new file format needed — just authoring discipline + better scenario coverage

---

## Mijn top-3 vragen voor de sessie

1. **Is the goal format change or authoring discipline?** The product amigo should confirm: is the value in having Gherkin syntax *inside* SKILL.md files, or in having Gherkin *drive* skill changes (spec-first editing of `.feature` files before touching SKILL.md)?

2. **Who maintains the Gherkin for skills — plugin contributors or the pipeline itself?** Today, a user runs the pipeline to produce feature files for their project. If skills have `.feature` files, those are plugin-level files that must be maintained by plugin contributors, not by the pipeline. That's a different governance model and a different contributor audience.

3. **If we add Gherkin to the existing `.feature` files to cover skill behavior more precisely (the low-friction option), are there specific gaps the user wants filled?** The existing 11 files are `@surveyed` — they cover happy paths. Missing: the Foreman's MCQ routing behavior, Three Amigos' full session vs quick scan detailed branching, Mister Gherkin's quality gate edge cases. Knowing which gaps hurt would make this a scoped, deliverable change rather than an open-ended format debate.

@product-amigo — you identified the right question: what triggered this idea? My read above suggests the real pain might be "skills drift because there's no spec to change them against." If that's it, the solution is authoring discipline + better scenario coverage in existing files — not adding Gherkin syntax to SKILL.md. But this needs confirmation from the user.

@testing-amigo — skills cannot be automatically tested against Gherkin scenarios (LLM behavior is non-deterministic, no test runner exists). If we write Gherkin for skills, it is for human verification only. Does that change what you'd want the scenarios to look like? Manual verification scenarios are typically broader and less step-heavy than automated ones.

---

## Round 2

### On the Testing Amigo's empirical test question

The Testing Amigo asked: have you actually tested whether fenced Gherkin in a skill causes Claude to change its behavior? If not, reason through it carefully.

I cannot run this empirically during a discovery session, but the architecture makes the answer tractable.

**How Claude processes skill files:**

A SKILL.md arrives as part of the system prompt context at invocation time. The LLM reads the entire file as instruction text. It does not parse or execute anything — it reasons about what the file is telling it to do and then acts.

The question is: does a fenced Gherkin block trigger a behavioral shift?

Fenced code blocks in system prompts are read by the LLM as "content that is being shown to me as an example or reference, not as something I should execute." This is not a guarantee — it is the model's general pattern for handling quoted or fenced material. The key variable is the semantic context around the fence.

**The Mister Gherkin case confirms the pattern is safe when context is clear.** That skill contains six or more Gherkin code fences. The skill has not been observed to produce Gherkin output when invoked — it produces natural language guidance and `.feature` files when appropriate. Why? Because the surrounding prose is explicit: "here is what good Gherkin looks like," "here is what to avoid." The fences are framed as examples. The instruction prose is the dominant signal.

**The Foreman case is semantically different.** Mister Gherkin is about Gherkin — a Gherkin example inside it is coherent and expected. The Foreman is about intake routing and pipeline orchestration. A Gherkin block inside the Foreman skill creates a semantic tension: "why is there a Given/When/Then inside an instruction that tells me how to triage a project?" Without explicit framing, the LLM might plausibly interpret it as:
- A description of what the Foreman should produce (treat as output format instruction)
- An acceptance criterion the Foreman should satisfy (treat as self-test)
- An example of what scenarios look like (treat as documentary)

The first two are failure modes. The third is the intended behavior.

**The mitigation the Testing Amigo identified is correct and sufficient:** any Gherkin embedded in a SKILL.md must be inside a fenced block AND be preceded by a prose sentence that explicitly frames it as illustrative. Example:

```
The following scenario shows the expected routing behavior for reference:
```gherkin
...
```
```

The phrase "for reference" or "this illustrates" is load-bearing. It shifts the semantic frame from instruction to documentation. Without that framing, the risk is real, especially in skills where Gherkin is unexpected.

**Verdict:** Fenced Gherkin in SKILL.md files is safe only with explicit prose framing. Unframed fenced Gherkin is risky in skills that are not about Gherkin. Bare (unfenced) Gherkin in prose sections is unsafe in any skill.

This does not change my Interpretation C assessment — it adds a specific authoring rule: every embedded Gherkin block must have a framing sentence before the fence.

---

### On the Product Amigo's Round 2 conclusion: real fix is authoring discipline

The Product Amigo has converged on the same position I ended Round 1 with: the problem is authoring discipline (spec-first edits), not file format. I agree, and the Round 2 analysis from the Product Amigo adds clarity I did not have in Round 1.

The `@surveyed` tag on every feature file is now the clearest signal: this is as-built documentation, not a living specification. Nobody is prevented from editing SKILL.md without touching the corresponding `.feature` file. The convention does not exist. The tool does not enforce it. The pipeline enforces BDD discipline on users but not on itself.

**The minimal technical change that enforces this discipline:**

There are three layers, ordered by cost:

**Layer 1 — Convention only (zero code, high value):** Add a rule to `skills/CONVENTIONS.md`:

> Before editing any SKILL.md, update or add the relevant scenario in the corresponding `.feature` file in `.storyline/features/` first. The feature file is the spec; the SKILL.md is the implementation. Skill edits without a spec step are not BDD — they are ad hoc changes.

This is the "spec-first" contract written down. It takes 10 minutes to add. It does not automate anything, but it makes the convention explicit and visible to every contributor who reads the conventions file. Without this being written down, the discipline has no anchor.

**Layer 2 — Coverage gaps filled (low code, high value):** Audit the 11 `.feature` files and add missing scenarios for:
- Foreman Scenario 3 (blueprint exists and is current — currently no scenario)
- Foreman's hard gate being respected (no scenario today)
- Three Amigos full session vs. quick scan branching (partially covered, decision branches incomplete)
- Mister Gherkin quality gate detecting implementation leakage (no sad path scenario)

This is additive — existing `@surveyed` files get new scenarios with behavioral intent rather than as-built observation. The new scenarios would NOT be tagged `@surveyed` — they would signal "this was written before the behavior, not after."

**Layer 3 — Structural separation (schema change, lower priority):** Address the Level 1 / Level 2 collision: `orchestration.feature` should not share a directory with `shopping-cart.feature`. This is a real architectural problem, but it is a consequence of the discipline problem, not the cause. Out of scope for this session — flag it.

Nothing in layers 1 or 2 requires touching SKILL.md files or adding Gherkin inside them.

---

### Concrete technical recommendation

The Product Amigo asked: given that the real fix is authoring discipline, what does the concrete technical recommendation look like? What files change?

**Files that change:**

1. `skills/CONVENTIONS.md` — add the spec-first rule (Layer 1). One section, ~5 lines.

2. `.storyline/features/orchestration.feature` — add missing scenarios: Foreman Scenario 3 (current blueprint, nothing stale), hard gate respected, MCQ presented before routing decision.

3. `.storyline/features/discovery.feature` — add full-session vs. quick-scan branch scenarios with more specificity than the current surveyed versions.

4. `.storyline/features/specification.feature` — add quality gate sad path: "Mister Gherkin detects implementation leakage and rewrites the step."

**Files that do NOT change:**

- Any SKILL.md file. No Gherkin goes inside skills.
- `plugin.json`, `blueprint.yaml`, any CLI script.
- No new files — new `.feature` files are not warranted; extend existing ones.

**What the new scenarios look like (not surveyed, written with behavioral intent):**

Rather than `@surveyed`, the new scenarios should carry a tag indicating they were written spec-first — e.g., `@spec:2026-04-06` or simply no `@surveyed` tag. The absence of `@surveyed` is the signal. This can be a convention rather than a new tag.

**What "done" looks like for this session:**

A contributor making a change to the Foreman's routing logic would:
1. Open `orchestration.feature`
2. Find the scenario that covers the routing decision being changed
3. Update that scenario first
4. Then open `SKILL.md` and make the matching change
5. Know they followed the discipline because CONVENTIONS.md says so

That workflow is what this feature delivers. Not a new file format. Not Gherkin inside SKILL.md. A written convention and better scenario coverage.

@testing-amigo — the scenarios I described above (Foreman hard gate, MCQ before routing, specification quality gate sad path) are the priority gaps. If you agree these are the highest-value missing scenarios, we can use those as the scope for this session's deliverable. Are there other gaps in your Round 1 list that should rank above these?

@product-amigo — the `@surveyed` vs. non-surveyed distinction may need a small convention update too: new scenarios written spec-first should be distinguishable from surveys. Is a naming convention enough, or should we add a tag (e.g., `@spec-first`) to make this visible in the files themselves?
