# Adversarial review gate

Four hooks that refuse to let a turn end when code was edited and nothing
reviewed it. Opt-in — see [Enabling](#enabling).

| Event | Matcher | Script | Job |
|---|---|---|---|
| `PreToolUse` | `Agent\|Task\|Skill` | `mark-adversarial.js` | mark a launched adversarial review |
| `PostToolUse` | `Edit\|Write\|MultiEdit` | `track-edit.js` | arm the gate on tool edits |
| `PostToolUse` | `Bash` | `track-bash-edit.js` | arm the gate on shell edits |
| `SubagentStop` | — | `subagent-adversarial.js` | mark the review complete |
| `Stop` | — | `require-adversarial.js` | block the turn while a review is owed |

State lives in `${CLAUDE_PLUGIN_DATA}/adversarial-state.json` (falling back to
`~/.cache/codebase-intelligence/`), keyed by `session_id`.

## Enabling

Off by default: this gate blocks the end of a turn, and installing a plugin must
not silently start refusing to let people stop.

```bash
export CI_ADVERSARIAL_GATE=1       # block: no completed review ⇒ the turn cannot end
export CI_ADVERSARIAL_GATE=warn    # never block; the Stop hook only reminds
unset  CI_ADVERSARIAL_GATE         # off (default): nothing is tracked at all
export CI_ADVERSARIAL_STATE=/path  # override the state file (used by the tests)
```

## What satisfies the gate

A subagent whose **name** says what it is — `description`, `subagent_type`,
`name`, or `skill` matching `/adversarial|doubt-driven/i`. The prompt body is
deliberately **not** matched: a turn that merely mentions an adversarial review
would otherwise clear its own gate.

## Why the Bash tracker exists

Tracking only `Edit`/`Write`/`MultiEdit` leaves the gate blind to every edit made
through the shell — and an agent told to prefer shell file operations then edits
code without ever arming it. `lib/bash-write.js` closes that:

- **Detected** — `>` / `>>` redirects on any fd, `sed`/`perl -i`, `tee`,
  `cp`/`mv`/`rm`/`touch`/`truncate`/`ln`/`patch`/`shred`, `dd of=`, `git apply`,
  and interpreter programs (`python -c`, `node -e`, `python3 - <<PY`) matched on
  write APIs (`write_text`, `writeFileSync`, `open(…, 'w')`, …).
- **Ignored** (by both edit trackers) — `/tmp`, scratchpad dirs, auto-memory notes and plans under
  `~/.claude/`, `/dev/null`, `.git/` internals,
  `node_modules`, the gate's own state file, fd dups (`2>&1`), and heredoc
  *bodies* (a body line reading `echo x > /y` is payload, not a redirect).
- **Unresolvable writes** (`git apply`, an interpreter script) arm the gate under
  a `bash:<command>` marker rather than being waved through.

Segmentation is quote-aware, so `sed -i 's|a|b|g' file` is one command and not
three.

## One ask per human turn

Reviews run in the background and report in a *later* turn, so the entry outlives the Stop that asked
(it used to be deleted there, which wiped the in-flight mark; the result then arrived as a "new" turn,
its fixes re-armed the gate, and one blocked Stop became 95 reviews in a session). The rules now:

- a launched review is never asked for twice — its result will arrive;
- a completed review covers the turn that applies its findings, whatever files that touches;
- harness notifications (`<task-notification>`, "Another Claude session sent a message",
  `<agent-message>`) continue the current human turn and change nothing;
- the next **human** prompt drops a settled review, drops an ask that was ignored, and drops an
  in-flight review that still has not reported after a second prompt. An interrupted turn (edits, no
  Stop) still owes its review on the next prompt;
- a completed review covers at most ten new paths; past that the gate may ask once more;
- a second Stop after a settled review (a harness where `UserPromptSubmit` never fired) drops it;
- **hard cap: three blocks per session.** After that the Stop hook only reminds. Whatever ordering a
  future harness invents — an unmarked reviewer, a notification shape the regex misses — the gate
  cannot block a session a fourth time. Entries of sessions quiet for a week are pruned.

`warn` follows the same state machine; it only reminds instead of blocking.

## Known limitation

The completion signal is a heuristic: whichever subagent stops while an adversarial review is in
flight clears it (newer harnesses send `agent_id` on `SubagentStart`/`SubagentStop`; this gate does
not yet pair them). Launch the review on its own to keep that honest — a misattribution costs at most
one extra ask, under the session cap.

Edits that land *during* a review re-arm the gate instead of clearing it. Edits made *after* a
review completes (fixing its findings) never do — otherwise every review's fixes would summon
another review.

## Tests

```bash
node hooks/adversarial/lib/bash-write.test.js   # write detection
node hooks/adversarial/lifecycle.test.js        # the state machine, end to end
```

Both run in `scripts/validate.sh` (check C9) and therefore in CI.
