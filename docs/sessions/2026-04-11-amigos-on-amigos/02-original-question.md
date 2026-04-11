# 02 — The Original Question

## What the user asked

> I have an issue with the amigo sessions, they sometimes create so much super valuable note that the step after that, consolidating feels weird and shallow... I mean how do you go from all those amazing explorations and discoveries and suggestions and concerns to a consolidation of that knowing for sure you cover at least the most important aspects? should the amigos themselves prioritise? so the main agent consolidates their most important stuff?

The question was exploratory — the user wasn't asking me to implement anything yet, they were reasoning out loud about a real pain point in the pipeline. The pain point: after three amigos produced lots of valuable material, the synthesis step felt under-powered because the main agent couldn't faithfully compress everything and was guessing at what mattered most.

## My response (verbatim)

> Yes — push prioritization into the amigos themselves. Have each one return findings in tiers (e.g. `must_address` / `should_consider` / `noted`), where `must_address` items carry a one-line "why losing this would hurt the feature." Consolidation then becomes merging pre-ranked lists and resolving cross-perspective conflicts, instead of the main agent re-reading everything and guessing what mattered.
>
> The tradeoff: amigos prioritize from their own lens, so a Product "noted" might actually be critical once paired with a Security concern. So the main agent still owns cross-cutting synthesis — but only over the `must_address` union, not the full note dump. That's the layer where things get lost today, and it's the one job the main agent is actually positioned to do well.
>
> Want me to sketch what that tiered output contract would look like in the amigo skills before changing anything?

## Why this shape

Three things drove the recommendation:

1. **The amigos already have the context to prioritize.** They've been reasoning about the feature for a full round. Asking them to rank their own findings is cheap — they don't need a second pass, just a final section. Asking the main agent to rank their findings is expensive — it has to re-read everything cold.

2. **Cross-perspective synthesis is the one job the main agent is actually positioned to do.** A Product-tier "noted" item might be a Security `Must Address` when combined with sensitivity tags on the data. An amigo can't see that because they only have their own lens. The main agent can. If you free the main agent from re-ranking the full note dump and point it at the union of `Must Address` items across amigos, cross-perspective promotion becomes the *only* synthesis job — and that's where value is unique.

3. **The `Why:` rationale on every `Must Address` item is the forcing function.** Without it, "must address" just means "I ranked this highly." With it, the amigo has to articulate *what breaks if this is dropped* — and that phrase is what the main agent actually needs to judge whether to keep the item, merge it with another amigo's concern, or promote a lower-tier item to compensate.

## The decision

The user's reply was one line:

> no just add this

No sketch requested. No back-and-forth on the contract shape. The user was confident enough in the recommendation to skip the design pass and just ship it. See [03-tiered-format-design.md](./03-tiered-format-design.md) for what actually got written.
