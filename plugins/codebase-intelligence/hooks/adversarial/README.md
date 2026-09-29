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

## What arms the gate

Only **code**: a path whose extension is in `CODE_EXTENSIONS`, or whose name
matches `CODE_BASENAMES` (both in `lib/state.js`). That covers source code, shell
scripts, SQL/Prisma, stylesheets, HTML, and executable infra: `*.yml`/`*.yaml`
(CI workflows, serverless), `*.tf`, `Dockerfile` / `*.Dockerfile` / `Dockerfile.<env>`,
`Makefile` / `makefile` / `Makefile.am`. Plans, vault notes, memory files, `*.md`,
`*.json`, `*.toml`, lockfiles (including `pnpm-lock.yaml`) and `.lock` files never arm it,
from `Edit`/`Write` or from the shell. An unresolvable shell write
(`bash:<command>` marker, below) still arms, because its target is unknown.

## Coverage, not a boolean

The gate tracks **which files** a review covered:

- Launching a review snapshots every file edited so far onto `reviewQueue`.
- A completion moves the oldest queued snapshot into `reviewedFiles`. Stop
  counts queued snapshots as covered too, so the drain order never changes
  what is owed.
- Stop blocks while an edited file is in neither `reviewedFiles` nor a queued
  snapshot. A running review therefore satisfies Stop for the files it was
  launched on, and a background review does not re-block each turn until it
  lands. A code file edited *after* the launch is still owed.

Editing a file a review already covers is *applying the review*, not new work,
and does not re-arm. Only a code file no review has seen does. That is what
breaks the old review → fix → gate → review loop.

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

Because a completion credits its snapshot permanently, a stray non-adversarial
`SubagentStop` mid-review marks that snapshot reviewed for the rest of the
session.

A review that dies without a `SubagentStop` stays queued. Its snapshot stays
covered, but any code file edited later is owed at the next Stop as usual.

Re-editing a covered file is never re-reviewed. The trade-off is deliberate:
fix-ups to a reviewed file are unreviewed. Renaming code to a non-code name
(`mv a.ts a.md`) is not tracked either, because `mv` records only its
destination.

## Tests

```bash
node hooks/adversarial/lib/bash-write.test.js   # write detection
node hooks/adversarial/lifecycle.test.js        # the state machine, end to end
```

Both run in `scripts/validate.sh` (check C9) and therefore in CI.
