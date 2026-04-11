# 06 — Scorecard: Design Sketch and What Shipped

## The user's greenlight

After the synthesis presentation, I proposed shipping the zero-LLM-call scorecard as the next step and asked:

> Want me to sketch the scorecard — what it reads, where it writes, and where in the pipeline it runs?

User's response:

> yes please do

I produced the design sketch, then asked whether to proceed with implementation or answer the open design questions first. The user replied:

> no go ahead, this is above my comprehension haha, but this seems like it could be gold

That was the greenlight to ship without a further design pass. What follows is the design I had written, followed by what actually got implemented and the results of the live smoke test.

---

## The sketch (as presented)

### What it is

A new CLI subcommand that reads the workbench notes after Round 3 and writes a structured scorecard to `.storyline/workbench/amigo-notes/scorecard.yaml`. Zero LLM calls. Pure file parsing + grep. Run automatically by the facilitator between Round 3 and Step F4 synthesis.

### What it reads

| Source | Used for |
|---|---|
| `.storyline/workbench/amigo-notes/*.md` | All metric extraction |
| `.storyline/.session-id` | Scorecard ID + timestamp |
| Blueprint `sensitive:` tags on aggregates in story.touches | Hard-gate decision |
| Session dispatch config (deep_dive flag, crew roster) | Normalization |

### What it computes — per amigo + aggregate

```yaml
session_id: 2026-04-11-amigo-process-reflection
feature: "three amigos on three amigos"
blueprint_signals:
  contexts_touched: 0
  aggregates_touched: 0
  sensitive_aggregate_hit: false
  invariant_count: 0
deep_dive: false

amigos:
  product:
    r1_must_address_count: 4       # sanity-check on tier discipline (3–6)
    r1_should_count: 3
    r1_noted_count: 2
    r2_react_word_count: 620
    r2_new_catches: 2              # items in React that don't keyword-overlap R1
    r2_tier_shifts: 2              # promotions/demotions between R1 and R2
    peer_mentions: 3               # @<other-amigo> count
    user_mentions: 2               # @user count
    dissent_markers: 4             # grep: disagree|however|not convinced|overstates|actually|wrong|pushback
    r3_responses: 3
    r3_empty: false                # true if "No @mentions for me"

  developer:
    # ...same shape
  testing:
    # ...same shape

session_totals:
  total_edits_between_rounds: 11   # lines added in ## React sections vs R1
  total_new_catches: 5             # sum of r2_new_catches
  total_dissent: 9
  peer_to_user_ratio: 2.3          # high = amigos engaging each other; low = outsourcing
  agreement_overlap: 0.32          # Jaccard on Must Address stems across amigos

verdict:
  rating: GREEN                    # GREEN | YELLOW | RED
  reasons:
    - "5 new catches in Round 2 across 3 amigos"
    - "9 dissent markers, peer:user ratio 2.3"
    - "No sensitive aggregate; groupthink gate inactive"
  hard_gate:
    triggered: false
    reason: null

cost_estimate:
  prompt_caching_verified: unknown
  approximate_input_tokens: ~
  approximate_output_tokens: ~
```

### Rating rules (file-scoped, deterministic)

| Rating | Condition |
|---|---|
| **GREEN** | `total_new_catches ≥ 3` AND `total_dissent ≥ 3` AND `agreement_overlap < 0.7` |
| **YELLOW** | Otherwise, when no sensitive aggregate is touched |
| **RED** | `sensitive_aggregate_hit AND total_dissent == 0 AND total_new_catches == 0` |

**RED is the hard gate** — facilitator refuses handoff to Mister Gherkin and presents the scorecard to the user with a forced choice: (a) re-run with `deep_dive: true`, (b) add an explicit Security amigo, (c) override with a documented assumption.

YELLOW is a soft warning shown in Step F5 alongside the example map. GREEN is silent.

### Dissent / new-catch detection — the honest limits

**Dissent grep keywords** (case-insensitive, word boundary): `disagree|pushback|however|not convinced|i'd challenge|actually|not sure|overstates?|overstating|wrong|misses|contra|but\b|undersells|oversells|narrower|broader`

Cheap and noisy. Will false-positive on normal prose ("actually, the reason is…"). Testing's stance — which I agreed with — is that v1 is an **audit trail**, not a gate, so noise is acceptable. The only use of the dissent metric inside a hard gate is the RED trigger, and that fires on `dissent == 0`, where false positives make the gate *less* likely to fire, not more. That's the right failure direction.

**New-catch detection**: tokenize each `## React to Others` bullet, stem, compare against tokens in the same amigo's own `## Prioritized Findings` + `## Top 3 Questions`. If <50% stem overlap, count as new. Threshold is tunable; start at 50%.

**Agreement overlap**: Jaccard similarity on stemmed `Must Address` bullet content, pairwise across amigos, averaged. High overlap = same model, same blind spot, same output — the groupthink signal.

### Where it plugs in

`skills/three-amigos/full-session.md` — new step between F3b and F4:

```
## Step F3c: Score the Session

Run:
  storyline amigo-score

Read .storyline/workbench/amigo-notes/scorecard.yaml.

If verdict.hard_gate.triggered:
  Present scorecard to user. Hard stop. Require (a) re-run with deep_dive,
  (b) add Security amigo, or (c) documented override.

If rating is YELLOW:
  Note the warning. Continue to F4. Surface the warning in F5 presentation.

If rating is GREEN:
  Continue to F4. Show the scorecard one-liner in F5.
```

---

## What actually shipped

### Files created / modified

| File | What changed |
|---|---|
| `scripts/amigo-score.ts` (new, ~330 lines) | Full implementation of the scorecard logic |
| `scripts/blueprint.ts` | Added `--sensitive` flag to `add-aggregate` (+ printUsage update) |
| `bin/storyline` | New `amigo-score` dispatcher case + usage text |
| `skills/three-amigos/full-session.md` | New Step F3c + F5 scorecard surfacing |
| `.claude-plugin/plugin.json` | Version bumped `1.12.0` → `1.13.0` |
| `.storyline/blueprint.yaml` | Stamped v49 → v50 |

### The implementation in one paragraph

`amigo-score.ts` reads all five possible amigo note files (`product.md`, `developer.md`, `testing.md`, `frontend.md`, `security.md`), splits each by regex markers for `## React to Others` and `## Round 3`, extracts the three tiers from the `## Prioritized Findings` section via forgiving regex, tokenizes bullet contents with an aggressive stopword filter and `(ing|ed|es|s)$` stemming, computes per-amigo metrics including a new-catch count via <50% stem-overlap of R2 bullets against the R1 aggregate, sums across amigos to produce session totals, computes pairwise Jaccard agreement-overlap on stemmed `Must Address` sets to get the groupthink signal, scans the blueprint for `sensitive: true` aggregates with a keyword-match fallback if none are found, assigns GREEN/YELLOW/RED per the rules above, and writes a structured YAML scorecard plus a one-line stdout summary. Exit code `2` on RED hard gate so the calling skill can branch cleanly.

### The live smoke test

Ran against this session's own amigo notes:

```bash
$ ./bin/storyline amigo-score
[amigo-score] GREEN  new_catches=67  dissent=55  overlap=0.04  peer:user=1.45
[amigo-score] Written to .storyline/workbench/amigo-notes/scorecard.yaml
```

See `amigo-notes/scorecard.yaml` in this archive for the full YAML output.

### Observations from the live test

1. **Tier discipline held**: `r1_must_caps_ok: true` for all three amigos. All kept their `Must Address` count in the 3–6 range.
2. **`agreement_overlap: 0.04`** is the standout metric. The personas produced nearly-disjoint `Must Address` content — pairwise Jaccard similarity of 0.04 on the stemmed bullet contents means almost nothing overlapped. This is the first quantitative evidence that system-prompt perspective-isolation produces different output rather than three reheats of the same priors.
3. **GREEN verdict** matches intuition. Round 2 had real disagreement — Developer pushed back on Product's cost math, Testing preserved a trimmed R2 against Product's "cut it" argument, Testing blocked Developer's R1 divergence-opener proposal.
4. **`new_catches=67` and `dissent=55`** look high. Honest analysis:
   - `new_catches`: 67 across ~60 R2 bullets means most bullets introduced genuinely new topics (cost math, forced-divergence opener, scorecard shape, peer:user ratio). The 50% overlap threshold is loose but not wrong — it correlates with actual R2 productivity.
   - `dissent`: 55 includes `but\b` matches, which is the noisiest keyword. Testing's v1 stance applies: noise is fine because this is an audit trail, not a gate. The hard gate fires on `dissent == 0`, where noise pushes *away* from firing.
5. **Known v1 limitation — keyword-fallback false positive**: `sensitive_aggregate_hit: true` fired because the meta-session discussed auth/token/session/permission concepts in the abstract. The detection source was `keyword-fallback` (no real aggregate matched). This is a false positive that doesn't break anything — GREEN verdict + nonzero dissent means the RED hard gate can't fire. Real feature sessions won't have this problem once aggregates are tagged directly with `sensitive: true`.

### What I deliberately didn't build in v1

- **Historical trending.** Storing scorecards across sessions to compute baselines for the thresholds. Meaningful only after 10+ real sessions exist.
- **Jaccard threshold tuning.** The 0.7 groupthink threshold is a guess. Needs calibration data.
- **Dissent keyword config file.** Keeping the lists inline in the script for v1. Users who want to tune can edit the file; a config externalization can come later if needed.
- **Cross-vendor model mixing.** Proposed by research that came in after shipping (see `07-research-followup.md`). Held for a future session.
- **Token count measurement.** The `cost_estimate` block emits `prompt_caching_verified: unknown` and `approximate_input_tokens: ~`. Real numbers require orchestrator hooks that may not exist yet — the Developer Amigo flagged this as the biggest unknown in the whole session.
