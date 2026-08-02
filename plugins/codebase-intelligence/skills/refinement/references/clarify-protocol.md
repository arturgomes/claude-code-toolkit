# The clarify loop — bounded, pickable, written back

The old failure mode was a question **dump**: NOT READY, here are eleven questions, good luck. It
reads as a cost imposed on the user, so it gets skimmed, half-answered, or waved through — and the
ambiguity survives into the code anyway.

This protocol replaces it. Same rigor, a fraction of the friction.

## The four rules

### 1. Five questions, maximum, per session

Rank candidates by **impact × uncertainty** and spend the budget on the top of that list. Never ask
two low-impact questions while a high-impact category (security posture, data lifecycle, failure
behavior) is still Missing. Clarification retries on the same question do not consume budget.

Anything that does not fit the budget goes under **Deferred** with a one-line reason. A deferred
*high-impact* item is a NOT READY — the ceiling limits how much you ask at once, not how much has to
be true before building.

**Not a user question:** a library/API fact (`does MUI 7 still export X?`). That is answerable by
`ask-kb` / Context7 at plan time. Asking the user is offloading research onto them.

### 2. One at a time, never reveal the queue

Ask, integrate the answer, then decide the next question **in light of it**. Answers collapse other
questions surprisingly often — a queue shown up front cannot shrink, so it wastes the budget it
already spent.

### 3. Every question is answerable by picking

Either 2-4 mutually exclusive options, or a short answer explicitly capped at ≤5 words.

Use `AskUserQuestion` when the harness exposes it — one call per question, the options as choices,
the recommended option **first** with `(Recommended)` in its label, and each option's `description`
carrying the consequence of choosing it.

Shape, whether asked via the tool or in plain text:

```
**Question:** <a full interrogative that stands on its own>? (FR-023)

**Recommended:** B — <1-2 sentences: why this is the best default here>

| Option | What it means |
|---|---|
| A | <consequence, in the user's terms> |
| B | <consequence> |
| C | <consequence> |

**Why it matters:** <one plain sentence — the stake for acceptance or for shipping>

Reply with a letter, "recommended", or your own ≤5-word answer.
```

Hard format rules:

- The text before the `?` must make sense alone. A topic label
  (`Acceptance device/runtime matrix (FR-023)`) is **not a question** — reject and rewrite it.
- The only thing allowed after the `?` is a parenthesized requirement id. Never put the id first.
- Everyday wording. Introduce jargon only if you define it in the same sentence. Self-check: someone
  who has never seen this codebase must be able to answer from the question line alone.
- **Always carry a recommendation.** "You decide" with three equal-looking options is a question that
  costs the user more than it costs you to answer. State the best default and why; being overruled is
  cheap and fast.

### 4. Write the answer back immediately

Before the next question:

1. Append `- Q: <question> → A: <answer>` under `## Clarifications` → `### Session YYYY-MM-DD`
   (create both headings on the first answer of the session).
2. Apply it to the section that **owns** it:

   | Answer resolves | Goes into |
   |---|---|
   | functional ambiguity | Functional Requirements (`FR-###`) |
   | who can do what / interaction | the user story + its scenarios |
   | data shape, identity, lifecycle | Key Entities |
   | a non-functional constraint | **Success Criteria — as `SC-###` with a number and a unit** |
   | edge / negative path | Edge Cases |
   | terminology conflict | normalized everywhere; keep `(formerly "X")` once, at most |
   | a boundary | Out of Scope |

3. **Replace** the statement the answer invalidates. Never leave both readings in the file — the
   whole point was to remove the ambiguity, and a spec that contains its own contradiction is worse
   than one that was merely vague.
4. Save the file (atomic overwrite) after **each** integration. A lost context must not lose answers.
5. Re-score the requirements checklist and note any state changes.

## Stop conditions

- Remaining queued questions stop being load-bearing (an earlier answer resolved them).
- The user signals completion — "done", "good", "no more", "proceed".
- Five questions asked.
- No valid question existed at the start: say
  *"No critical ambiguities detected worth formal clarification"* and move on. Manufacturing a
  question to look thorough spends trust the next real question needs.

## Completion report

- questions asked/answered: `n/5`
- spec path + sections touched
- checklist: `before/total → after/total` items passing, plus newly-passing and **regressions**
- coverage summary per taxonomy category: Resolved | Deferred | Clear | Outstanding
- verdict + next step

A **regression** (an item that was passing and now is not) is a real signal: the answer broke
something that used to hold. Investigate it. Never just re-check the box.
