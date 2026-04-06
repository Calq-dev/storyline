# Process improvements backlog

## Auto-backlog deferred scope during Three Amigos

The Process Critic rule (CLAUDE.md) says explicitly deferred scope must be written to
backlog/ immediately at the moment of deferral. But deferral decisions happen during the
MoSCoW step inside the Three Amigos skill — which runs in the main session facilitating
the conversation. The rule needs to be reflected in three-amigos/SKILL.md so the
facilitator writes "won't have this time" items to backlog/ before handing off to
Mister Gherkin.

Specifically: after the MoSCoW step, any rule tagged "won't have" should be
automatically written to a backlog entry (or appended to an existing one) with its
context and the reason it was deferred. The facilitator should not wait for the user
to ask.

Affects: skills/three-amigos/SKILL.md (MoSCoW step), potentially full-session.md
(persona agents defer in their notes but the facilitator consolidates).
