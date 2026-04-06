# Sticky Storm — Raw Notes
# Feature: lightweight-tweak-path.feature
# Date: 2026-04-06

---

## Commands and Events extracted from scenarios

### Command: IdentifyMinorTweak
Actor: Plugin user (via The Foreman)
Aggregate: PipelineSession (Orchestration)
Triggering When steps:
- "the user describes a bounded change to that feature using scoping language"
- "the user confirms the lightweight path"
- "the user describes a change that introduces new behavior or actors" (sad-path)
- "the user describes a change without enough scope detail to classify" (edge-case)

Then steps (events):
- "the Foreman presents a minor tweak classification with its rationale" -> MinorTweakIdentified
- "offers the user a choice to proceed with the lightweight path or run the full pipeline" -> (part of MinorTweakIdentified, captured in payload as "options")
- "the Foreman routes to the full discovery pipeline" -> TweakRoutedToFullPipeline
- "the Foreman presents a clarification question before classifying" -> TweakClassificationDeferred
- "the implication scan is initiated" -> (policy: when user confirms lightweight path, issue ScanTweakImplications)
- "the Foreman routes to the Three Amigos discovery session" -> TweakRoutedToFullPipeline (same event, same payload pattern)

Events discovered:
1. MinorTweakIdentified — payload: sessionId, changeDescription, rationale, affectedCommand
2. TweakRoutedToFullPipeline — payload: sessionId, reason (new behavior/actors detected, or user override)
3. TweakClassificationDeferred — payload: sessionId, clarificationQuestion

---

### Command: ScanTweakImplications
Actor: The Foreman (automated after user confirmation)
Aggregate: PipelineSession (Orchestration)
Triggering When steps:
- "the implication scan runs" (no/found implications variants)

Then steps (events):
- "the Foreman reports no implications found and offers to proceed" -> TweakImplicationScanCompleted (affectedScenarioCount: 0)
- "the Foreman lists the affected feature files and scenario names" -> TweakImplicationScanCompleted (with list)
- "the Foreman blocks the lightweight path and recommends the full pipeline" -> TweakBlockedByCrossContextImplications

Events discovered:
4. TweakImplicationScanCompleted — payload: sessionId, affectedFeatureFiles, affectedScenarioNames, contextCount
5. TweakBlockedByCrossContextImplications — payload: sessionId, affectedContexts

---

### Command: ExecuteTweakPath
Actor: The Foreman (delegating to Developer Amigo)
Aggregate: PipelineSession (Orchestration)
Triggering When steps:
- "the Foreman initiates lightweight execution"
- "the Foreman determines inline execution is appropriate"

Then steps (events):
- "the Developer Amigo receives the tweak details and implication scan results" -> TweakPathExecuted (delegated mode)
- "after the change is committed the affected feature files and blueprint are updated" -> (part of TweakPathExecuted payload / post-commit reconciliation)
- "the change is made and committed directly" + "affected feature files and blueprint are updated" -> TweakPathExecuted (inline mode)

Events discovered:
6. TweakPathExecuted — payload: sessionId, executionMode (delegated|inline), artifactsReconciled

---

## Policies discovered

Policy A: When MinorTweakIdentified AND user confirms lightweight path -> issue ScanTweakImplications
  - Named: InitiateImplicationScanOnConfirmation
  - Triggered by: MinorTweakIdentified (conditional on user response)
  NOTE: The "confirmation" step is actually another IdentifyMinorTweak scenario variant — the policy
  fires after the user responds "yes" to the lightweight path offer. This might be better modeled
  as: the confirmation is a separate signal, not embedded in MinorTweakIdentified. See hot spot below.

Policy B: When TweakImplicationScanCompleted (contextCount == 1) -> offer ExecuteTweakPath
  - This is a conditional/informational; no automated command issued. Not a true policy — more of a
    read model presenting a choice.

Policy C: When TweakBlockedByCrossContextImplications -> issue StartPipeline (full pipeline)
  - Named: RouteToFullPipelineOnCrossContextBlock
  - Triggered by: TweakBlockedByCrossContextImplications
  - Issues command: StartPipeline

---

## Hot Spots / Questions

Q-A (critical): The feature says "after the change is committed the affected feature files and blueprint
are updated" — this is post-commit reconciliation. The blueprint has an invariant that it must be
validated and stamped before every commit. But if the blueprint update happens AFTER commit, the
invariant is violated. Is post-commit reconciliation a first-class exception, or should artifact
updates happen pre-commit?

Q-B (important): The "user confirms the lightweight path" is modeled as a scenario under
IdentifyMinorTweak, but the confirmation is really a separate actor interaction. Should there be a
separate ConfirmLightweightPath command, or is the confirmation signal absorbed into the
ScanTweakImplications precondition? Current modeling collapses this into IdentifyMinorTweak which
may make policy triggering ambiguous.

Q-C (important): TweakRoutedToFullPipeline covers two distinct reasons: (1) Foreman classification
of "new behavior/actors", (2) user override. These may need separate events or at least distinct
payload values so The Foreman knows whether to explain its routing or just comply.

---

## Summary

Commands: IdentifyMinorTweak, ScanTweakImplications, ExecuteTweakPath (already in blueprint)
New Events: MinorTweakIdentified, TweakClassificationDeferred, TweakRoutedToFullPipeline,
            TweakImplicationScanCompleted, TweakBlockedByCrossContextImplications, TweakPathExecuted
New Policies: InitiateImplicationScanOnConfirmation, RouteToFullPipelineOnCrossContextBlock
Hot Spots: 3 (1 critical, 2 important)
