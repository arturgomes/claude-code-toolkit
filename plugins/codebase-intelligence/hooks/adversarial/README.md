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
- **Ignored** — `/tmp`, scratchpad dirs, `/dev/null`, `.git/` internals,
  `node_modules`, the gate's own state file, fd dups (`2>&1`), and heredoc
  *bodies* (a body line reading `echo x > /y` is payload, not a redirect).
- **Unresolvable writes** (`git apply`, an interpreter script) arm the gate under
  a `bash:<command>` marker rather than being waved through.

Segmentation is quote-aware, so `sed -i 's|a|b|g' file` is one command and not
three.

## Known limitation

`SubagentStop` carries no subagent identity, so the completion signal is a
heuristic: whichever subagent stops while an adversarial review is in flight
clears it. Launch the review on its own to keep that honest.

Edits that land *during* a review re-arm the gate instead of clearing it, so a
reviewed-then-modified turn is asked again.

## Tests

```bash
node hooks/adversarial/lib/bash-write.test.js   # write detection
node hooks/adversarial/lifecycle.test.js        # the state machine, end to end
```

Both run in `scripts/validate.sh` (check C9) and therefore in CI.
