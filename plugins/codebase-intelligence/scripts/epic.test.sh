#!/usr/bin/env bash
# Self-check for epic.sh. No framework: plain asserts, exit 1 on first failure summary.
# Run: bash scripts/epic.test.sh   (takes ~20s: it waits on real timers)
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
EPIC_SH="$HERE/epic.sh"
TMP=$(cd "$(mktemp -d)" && pwd -P)
FAILS=0
PASSES=0

cleanup() {
  for pidfile in "$TMP"/runs/*/*/pid; do
    [ -f "$pidfile" ] && "$EPIC_SH" kill "$(basename "$(dirname "$(dirname "$pidfile")")")" "$(basename "$(dirname "$pidfile")")" >/dev/null 2>&1
  done
  pkill -f 'sleep 3171' 2>/dev/null
  pkill -f 'sleep 3172' 2>/dev/null
  pkill -f 'sleep 3173' 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

assert_eq() { # name expected actual
  if [ "$2" = "$3" ]; then PASSES=$((PASSES + 1)); printf 'ok   %s\n' "$1"
  else FAILS=$((FAILS + 1)); printf 'FAIL %s\n     expected: %s\n     actual:   %s\n' "$1" "$2" "$3"; fi
}
assert_match() { # name regex actual
  if printf '%s' "$3" | grep -Eq "$2"; then PASSES=$((PASSES + 1)); printf 'ok   %s\n' "$1"
  else FAILS=$((FAILS + 1)); printf 'FAIL %s\n     expected to match: %s\n     actual: %s\n' "$1" "$2" "$3"; fi
}

export EPIC_HOME="$TMP/runs"

# Fake `claude`: behaviour picked by FAKE_MODE; records argv, stdin and one env var for assertions.
FAKE="$TMP/fake-claude"
cat > "$FAKE" <<'FAKE_EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "${FAKE_OUT:?}/argv"
cat > "$FAKE_OUT/stdin"
printf '%s' "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS-UNSET}" > "$FAKE_OUT/teams"
pwd -P > "$FAKE_OUT/cwd"
case "${FAKE_MODE:-ok}" in
  ok)     echo '{"type":"result"}'; exit 0 ;;
  fail)   echo 'boom'; exit 3 ;;
  hang)   echo '{"type":"system"}'; sleep 3171 ;;
  report) echo '{"type":"assistant","text":"template EPIC-RESULT: status=<pr-open|needs-human|failed> pr=<url> reason=x"}'
          echo '{"result":"done\n\nEPIC-RESULT: status=pr-open pr=https://github.com/o/r/pull/9 reason=all slices merged\n\nskipped: nothing","type":"result"}' ;;
  decoy)  echo '{"type":"assistant","text":"EPIC-RESULT: status=pr-open pr=https://github.com/o/r/pull/1 reason=quoted earlier"}'
          echo '{"result":"stopped","type":"result"}' ;;
  chatty) for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do echo '{"type":"assistant"}'; sleep 0.5; done ;;
esac
FAKE_EOF
chmod +x "$FAKE"
export EPIC_CLAUDE="$FAKE"
export FAKE_OUT="$TMP/out"; mkdir -p "$FAKE_OUT"

PROMPT="$TMP/prompt.md"
printf 'Run SEATHQ-1 please\n' > "$PROMPT"

wait_for_exit_file() { # epic ticket
  local i=0
  while [ ! -f "$EPIC_HOME/$1/$2/exit" ] && [ $i -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
}

# --- launch is non-blocking, even when the run hangs -------------------------
START=$SECONDS
FAKE_MODE=hang "$EPIC_SH" launch E1 T-HANG "$PROMPT" >/dev/null
ELAPSED=$((SECONDS - START))
assert_eq "launch returns immediately for a hanging run" "yes" "$([ "$ELAPSED" -le 2 ] && echo yes || echo "no (${ELAPSED}s)")"

# --- exit codes are captured ---------------------------------------------------
FAKE_MODE=ok "$EPIC_SH" launch E1 T-OK "$PROMPT" >/dev/null; wait_for_exit_file E1 T-OK
assert_eq "finished run reports exit code 0" "exited code=0" "$("$EPIC_SH" check E1 T-OK 60)"

FAKE_MODE=fail "$EPIC_SH" launch E1 T-FAIL "$PROMPT" >/dev/null; wait_for_exit_file E1 T-FAIL
assert_eq "failed run reports its non-zero exit code" "exited code=3" "$("$EPIC_SH" check E1 T-FAIL 60)"

# --- launch contract: flags, stdin prompt, agent-teams env stripped ------------
rm -f "$FAKE_OUT"/*
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 FAKE_MODE=ok "$EPIC_SH" launch E1 T-ARGS "$PROMPT" >/dev/null; wait_for_exit_file E1 T-ARGS
assert_match "headless run is non-interactive print mode" '^-p$' "$(cat "$FAKE_OUT/argv")"
assert_match "permission prompts are denied, never awaited" '^--permission-prompts$' "$(cat "$FAKE_OUT/argv")"
assert_match "denial value is none" '^none$' "$(cat "$FAKE_OUT/argv")"
assert_match "log is machine-readable stream-json" '^stream-json$' "$(cat "$FAKE_OUT/argv")"
assert_eq "prompt file arrives on stdin" "Run SEATHQ-1 please" "$(cat "$FAKE_OUT/stdin")"
assert_eq "agent-teams env is stripped so lanes run serially" "UNSET" "$(cat "$FAKE_OUT/teams")"

# --- the run starts at the project root, wherever the caller happens to be --------
mkdir -p "$TMP/proj" "$TMP/elsewhere"
( cd "$TMP/elsewhere" && EPIC_CWD="$TMP/proj" FAKE_MODE=ok "$EPIC_SH" launch E1 T-CWD "$PROMPT" >/dev/null ); wait_for_exit_file E1 T-CWD
assert_eq "run starts in EPIC_CWD, not the caller's directory" "$TMP/proj" "$(cat "$FAKE_OUT/cwd")"
( cd "$TMP/elsewhere" && EPIC_ROOT="$TMP/proj" FAKE_MODE=ok "$EPIC_SH" launch E1 T-CWD2 "$PROMPT" >/dev/null ); wait_for_exit_file E1 T-CWD2
assert_eq "without EPIC_CWD the run starts at EPIC_ROOT" "$TMP/proj" "$(cat "$FAKE_OUT/cwd")"
( cd "$TMP/elsewhere" && FAKE_MODE=ok "$EPIC_SH" launch E1 T-CWD3 "$PROMPT" >/dev/null ); wait_for_exit_file E1 T-CWD3
assert_eq "with neither set the run starts where the caller is" "$TMP/elsewhere" "$(cat "$FAKE_OUT/cwd")"

# --- heartbeat / hung detection ------------------------------------------------
assert_match "fresh hanging run is running, not hung" '^running age=[0-9]+s$' "$("$EPIC_SH" check E1 T-HANG 2)"
sleep 3
assert_match "silent run past the threshold is hung" '^hung age=[0-9]+s$' "$("$EPIC_SH" check E1 T-HANG 2)"

touch "$TMP/state-note.md"
assert_match "a fresh heartbeat path keeps a silent log from being hung" '^running age=[0-9]+s$' "$("$EPIC_SH" check E1 T-HANG 2 "$TMP/state-note.md")"

FAKE_MODE=chatty "$EPIC_SH" launch E1 T-CHAT "$PROMPT" >/dev/null
sleep 3
assert_match "a run that keeps writing its log is never hung" '^running age=[0-9]+s$' "$("$EPIC_SH" check E1 T-CHAT 2)"

assert_eq "check without a pid file says unknown" "unknown reason=no-pid-file" "$("$EPIC_SH" check E1 T-NEVER 60)"

# --- result: the EPIC-RESULT line from the final result event only ------------------
FAKE_MODE=report "$EPIC_SH" launch E1 T-REP "$PROMPT" >/dev/null; wait_for_exit_file E1 T-REP
assert_eq "result extracts the EPIC-RESULT line from the final result event" "EPIC-RESULT: status=pr-open pr=https://github.com/o/r/pull/9 reason=all slices merged" "$("$EPIC_SH" result E1 T-REP)"
FAKE_MODE=decoy "$EPIC_SH" launch E1 T-DECOY "$PROMPT" >/dev/null; wait_for_exit_file E1 T-DECOY
assert_eq "an EPIC-RESULT quoted mid-run is ignored when the final event has none" "none" "$("$EPIC_SH" result E1 T-DECOY)"
assert_eq "result without a log says none" "none" "$("$EPIC_SH" result E1 T-NEVER)"

# --- kill ----------------------------------------------------------------------
"$EPIC_SH" kill E1 T-HANG >/dev/null; sleep 1
assert_eq "killed run is reported exited with unknown code" "exited code=unknown" "$("$EPIC_SH" check E1 T-HANG 60)"
assert_eq "kill takes the whole process group, no orphan child" "0" "$(/bin/ps -ax -o command= | grep -c '[s]leep 3171')"

# kill must never group-kill a pid that is not its own group leader (would hit the caller)
( set -m; bash -c 'sleep 3172 & echo $! > "$0"; sleep 3173 & wait' "$TMP/sleeper.pid" >/dev/null 2>&1 & )
sleep 0.5
SLEEPER=$(cat "$TMP/sleeper.pid")
mkdir -p "$EPIC_HOME/E1/T-FOREIGN"; echo "$SLEEPER" > "$EPIC_HOME/E1/T-FOREIGN/pid"
assert_eq "canary shares the target's group before the kill" "1" "$(/bin/ps -ax -o command= | grep -c '^sleep 3173$')"
"$EPIC_SH" kill E1 T-FOREIGN >/dev/null; sleep 1
assert_eq "kill of a non-leader pid stops that pid" "gone" "$(/bin/ps -p "$SLEEPER" >/dev/null 2>&1 && echo alive || echo gone)"
assert_eq "kill of a non-leader pid spares the rest of its process group" "1" "$(/bin/ps -ax -o command= | grep -c '^sleep 3173$')"
pkill -f 'sleep 3173' 2>/dev/null

# --- ci-delegation -------------------------------------------------------------
ROOT="$TMP/root"; mkdir -p "$ROOT/repo-a/.github/workflows" "$ROOT/repo-b/.github/workflows"
printf 'jobs:\n  tc:\n    steps:\n      - run: pnpm run type-check\n' > "$ROOT/repo-a/.github/workflows/ci.yml"
printf 'jobs:\n  t:\n    steps:\n      - run: npm run test\n' > "$ROOT/repo-b/.github/workflows/ci.yml"
TSV="$TMP/ci.tsv"
mkdir -p "$ROOT/repo-d/.github/workflows"
printf 'jobs:\n  t:\n    steps:\n      # - run: pnpm run lint\n      - run: pnpm run test\n' > "$ROOT/repo-d/.github/workflows/ci.yml"
printf '# comment line is ignored\n\nrepo-a\ttypecheck\t.github/workflows/ci.yml\tpnpm run type-check\nrepo-b\ttypecheck\t.github/workflows/ci.yml\tnpx tsc --noEmit\nrepo-c\tlint\t.github/workflows/ci.yml\tpnpm run lint\nrepo-d\tlint\t.github/workflows/ci.yml\tpnpm run lint\n' > "$TSV"
OUT=$("$EPIC_SH" ci-delegation "$TSV" "$ROOT")
assert_eq "check CI really runs is delegated" "repo-a typecheck delegated" "$(printf '%s\n' "$OUT" | sed -n 1p)"
assert_eq "check CI does not run stays local" "repo-b typecheck local reason=needle-not-found" "$(printf '%s\n' "$OUT" | sed -n 2p)"
assert_eq "missing workflow file stays local" "repo-c lint local reason=workflow-missing" "$(printf '%s\n' "$OUT" | sed -n 3p)"
assert_eq "a commented-out CI step does not count as delegated" "repo-d lint local reason=needle-not-found" "$(printf '%s\n' "$OUT" | sed -n 4p)"
assert_eq "comments and blank lines produce no rows" "4" "$(printf '%s\n' "$OUT" | wc -l | tr -d ' ')"
assert_eq "no delegation file means nothing is delegated" "" "$("$EPIC_SH" ci-delegation "" "$TMP/no-such-root")"
mkdir -p "$ROOT/.claude"; cp "$TSV" "$ROOT/.claude/epic-ci-delegation.tsv"
assert_eq "the project's .claude/epic-ci-delegation.tsv is the default table" "repo-a typecheck delegated" "$("$EPIC_SH" ci-delegation "" "$ROOT" | sed -n 1p)"

# --- heartbeat-paths: a ticket's worktrees (any naming) and vault notes ----------
HB="$TMP/hb"; VAULT="$TMP/vault"
mkdir -p "$HB/repo1" "$VAULT/02-Notes/Sessions/2026-11"
command git -C "$HB/repo1" init -q
command git -C "$HB/repo1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
command git -C "$HB/repo1" worktree add -q "$HB/wt-a" -b feature/SEATHQ-77-foo
command git -C "$HB/repo1" worktree add -q "$HB/wt-b" -b feature/SEATHQ-770-other
command git -C "$HB/repo1" worktree add -q "$HB/c77" -b misc
touch "$VAULT/02-Notes/Sessions/2026-11/SEATHQ-77-x.state.md" "$VAULT/02-Notes/Sessions/2026-11/SEATHQ-770-y.md"
EXPECTED=$(printf '%s\n' "$HB/c77" "$HB/wt-a" "$VAULT/02-Notes/Sessions/2026-11/SEATHQ-77-x.state.md" | sort)
assert_eq "heartbeat paths: branch/path match with number boundaries, plus vault notes" "$EXPECTED" "$("$EPIC_SH" heartbeat-paths SEATHQ-77 "$HB" "$VAULT" | sort)"
assert_eq "heartbeat paths: no match prints nothing" "" "$("$EPIC_SH" heartbeat-paths SEATHQ-999 "$HB" "$VAULT")"

# root that IS the repo (no umbrella folder), and plan children matched by whole slug
SOLO="$TMP/solo"; mkdir -p "$SOLO"
command git -C "$SOLO" init -q
command git -C "$SOLO" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
command git -C "$SOLO" worktree add -q "$SOLO/.wt/rails" -b feat/reporting-rails-theme
command git -C "$SOLO" worktree add -q "$SOLO/.wt/other" -b feat/theme
command git -C "$SOLO" worktree add -q "$SOLO/.wt/t12" -b feat/SEATHQ-12-x
touch "$VAULT/02-Notes/Sessions/solo-reporting-rails-theme.md"
EXPECTED=$(printf '%s\n' "$SOLO/.wt/rails" "$VAULT/02-Notes/Sessions/solo-reporting-rails-theme.md" | sort)
assert_eq "heartbeat paths: plan slug matches whole slug only, in a root that is the repo" "$EXPECTED" "$("$EPIC_SH" heartbeat-paths reporting-rails-theme "$SOLO" "$VAULT" | sort)"
assert_eq "heartbeat paths: ticket worktree found when root is the repo" "$SOLO/.wt/t12" "$("$EPIC_SH" heartbeat-paths SEATHQ-12 "$SOLO" "$VAULT")"
assert_eq "heartbeat paths: the main checkout itself is never a heartbeat" "" "$("$EPIC_SH" heartbeat-paths solo "$SOLO" "$TMP/no-vault")"
assert_match "heartbeat paths: a slug with regex characters is refused" 'kebab slug' "$("$EPIC_SH" heartbeat-paths 'a.*' "$SOLO" "$VAULT" 2>&1)"

# --- children: the umbrella plan's child table --------------------------------
U="$TMP/umb"; mkdir -p "$U/plans"; touch "$U/plans/tokens.plan.md" "$U/plans/rails.plan.md"
cat > "$U/goal.md" <<'UMB'
# Goal: light mode
Some prose. | not a table row because no heading yet |
## Children
| id | runs | deps |
|---|---|---|
| tokens | plans/tokens.plan.md | |
| rails | `plans/rails.plan.md` | tokens |
| SEATHQ-12 | | tokens, rails |
## Notes
| x | y | z |
UMB
EXPECTED=$(printf '%s\t%s\t%s\n' tokens "$U/plans/tokens.plan.md" "" rails "$U/plans/rails.plan.md" tokens SEATHQ-12 SEATHQ-12 tokens,rails)
assert_eq "children: rows parsed, paths absolute, empty runs = the ticket, deps comma-joined" "$EXPECTED" "$("$EPIC_SH" children "$U/goal.md")"
printf '## Children\n| id | runs | deps |\n|---|---|---|\n| a | plans/missing.plan.md | |\n| b | SEATHQ-1 | zz |\n| a | SEATHQ-2 | |\n| Bad_Id | SEATHQ-3 | |\n' > "$U/bad.md"
ERR=$("$EPIC_SH" children "$U/bad.md" 2>&1); RC=$?
assert_eq "children: an invalid table exits 2" "2" "$RC"
assert_match "children: missing plan file reported" 'plan file missing for a' "$ERR"
assert_match "children: unknown dep reported" 'dep zz of b is not a child' "$ERR"
assert_match "children: duplicate id reported" 'duplicate child id: a' "$ERR"
assert_match "children: bad id reported" 'bad child id: Bad_Id' "$ERR"
printf '# nothing here\n' > "$U/empty.md"
"$EPIC_SH" children "$U/empty.md" >/dev/null 2>&1; RC=$?
assert_eq "children: no ## Children table exits 2" "2" "$RC"

printf '\n%s passed, %s failed\n' "$PASSES" "$FAILS"
[ "$FAILS" -eq 0 ] && echo "ALL PASSED"
[ "$FAILS" -eq 0 ]
