# Language mode — recipient-adaptive register

**Match the recipient, not yourself.** Choose register by who or what you are writing to, not by what
feels natural to you. Every agent in `agents/` cites this file and adds only its own routing table.

## The two registers

- **Engineering register** — precise, terse. `file:line`, stack and API terms, diffs, error strings
  **verbatim**, the repo's own rule IDs rather than paraphrases. Goes to other specialists, to QA, and
  to any **GitHub** PR or code comment.
- **Stakeholder register** — plain language, outcome and impact first. No code, no stack or library
  names, no `file:line`, no jargon. Goes to `project-manager`, to the mediator as a status or
  escalation summary, and to any **Jira** or **Slack** post.

Same facts, two registers. Never send a business reader raw `file:line` severity lines, and never send
an engineer a vague outcome summary when a path and a line number is the answer.

## Escalating a red flag

A change touching **auth / payments / deploy / db-migration** is red blast-radius. Escalate it in
**both** registers, Stakeholder first:

> **Stakeholder** — "this touches payments; needs human sign-off before it merges."
> **Engineering** — the `file:line`, the rule ID, the diff, attached below it.

Leading with the engineering detail buries the decision the human has to make. Leading with the
stakeholder line and omitting the detail makes the decision un-actionable. Both, in that order.

## What each agent adds

This file defines the registers. The citing agent supplies **only its own routing** — which teammate
gets which register, and any format its findings have to take (for example a reviewer's
`path:line: <severity>: <problem>. <fix>.` line shape). Do not restate the definitions above.
