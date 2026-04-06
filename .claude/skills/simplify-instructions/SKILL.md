---
name: simplify-instructions
description: Compress any agent-facing instruction document — skills, CLAUDE.md, memory files, agents, output styles, system prompts, personas, subagent configs, or any other text that instructs an LLM how to behave.
argument-hint: "<path-to-file>"
---

# Simplify Instructions

Compress agent-facing instructions by removing everything the LLM already knows from training.

## The Core Test

For every block, ask:

**"Would the LLM behave differently without this instruction?"**

- No → delete it
- Yes, but a one-liner reminder would suffice → reduce to one line
- Yes, and the detail is essential → keep it

## Delete

- Explanations of well-known concepts, patterns, methodologies, or syntax
- Examples that illustrate standard practice (the LLM already knows how)
- Definitions of industry-standard terms
- General advice ("be concise", "use clear names", "handle errors")
- Anything the LLM would do correctly unprompted in that context

## Keep

- Anything invented by the user/team/project (conventions, paths, CLI, schemas, workflows)
- Routing logic: what triggers what, in what order, under what conditions
- Exact tool/command syntax that is custom to this project
- Deviations from what the LLM would do by default
- Gates and checkpoints that enforce a specific workflow
- Integration points between components

## After Deleting

- Replace scripted/template output text with instruction to generate dynamically from context
- Check for subfile candidates: blocks that are 30+ lines after compression AND only needed conditionally (not every invocation). Extract those with a load trigger in the main file. Don't split otherwise.

## Self-Check

- [ ] No line teaches the LLM something it already knows
- [ ] Every custom convention is preserved
- [ ] All routing/handoffs are intact
- [ ] No canned text remains
- [ ] A different LLM reading this produces identical behavior