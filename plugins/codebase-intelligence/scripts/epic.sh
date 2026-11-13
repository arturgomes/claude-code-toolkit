#!/usr/bin/env bash
# epic.sh: process supervision for /prp-epic. Only the deterministic parts live here;
# the ledger (what is done / left / hanging) is a vault note written by the orchestrator.
#
#   launch <EPIC> <CHILD> <PROMPT_FILE>              start a detached headless run, return at once
#   check  <EPIC> <CHILD> <HUNG_AFTER_SEC> [PATH..]  running | hung | exited | unknown
#   result <EPIC> <CHILD>                            the run's EPIC-RESULT line, or "none"
#   kill   <EPIC> <CHILD>                            stop the run's whole process group
#   heartbeat-paths <CHILD> [ROOT] [VAULT]           a child's worktrees + vault notes, for check
#   children <UMBRELLA.md>                           an umbrella plan's child table as TSV
#   ci-delegation [TSV] [ROOT]                       which local checks PR CI provably covers
#
# ROOT is the project the epic runs in: $EPIC_ROOT, else the caller's cwd. It may be one git repo or
# an umbrella folder of repos. Run bookkeeping (pid, exit, log, prompt) lives outside every repo:
# ${EPIC_HOME:-~/.claude/epic-runs}/<EPIC>/<CHILD>/. Bash 3.2 compatible (macOS).
set -u

ROOT="${EPIC_ROOT:-$PWD}"
RUNS_HOME="${EPIC_HOME:-$HOME/.claude/epic-runs}"
CLAUDE_BIN="${EPIC_CLAUDE:-claude}"
VAULT_DEFAULT="${OBSIDIAN_VAULT:-$HOME/Documents/Obsidian-Vault}"

rundir() { printf '%s/%s/%s' "$RUNS_HOME" "$1" "$2"; }

alive() { /bin/ps -p "$1" >/dev/null 2>&1; }

mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }

is_ticket() { printf '%s' "$1" | grep -Eq '^[A-Z][A-Z0-9]*-[0-9]+$'; }

# A git checkout's heartbeat is its last commit (one commit per task); any other path, its mtime.
heartbeat_of() {
  if [ -e "$1/.git" ]; then command git -C "$1" log -1 --format=%ct 2>/dev/null || echo 0
  elif [ -e "$1" ]; then mtime "$1"
  else echo 0; fi
}

cmd_launch() {
  local epic=${1:?epic} child=${2:?child} prompt=${3:?prompt file} dir
  [ -f "$prompt" ] || { echo "prompt file not found: $prompt" >&2; return 2; }
  dir=$(rundir "$epic" "$child")
  mkdir -p "$dir"
  rm -f "$dir/exit"
  cp "$prompt" "$dir/prompt.txt"
  : > "$dir/log"
  # set -m gives the run its own process group so kill can take its children (tsc, vitest) too.
  # --permission-prompts none: a prompt nobody can answer is denied, never waited on forever.
  # AGENT_TEAMS unset: lanes run serially in one worktree each, the plugin's supported fallback.
  # The run starts at the project root so its settings and allow-list apply, wherever the caller is.
  (
    cd "${EPIC_CWD:-$ROOT}" || exit 1
    set -m
    nohup bash -c '
      dir=$1; shift
      "$@" < "$dir/prompt.txt" > "$dir/log" 2>&1
      echo $? > "$dir/exit"
    ' _ "$dir" env -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS "$CLAUDE_BIN" -p \
      --output-format stream-json --verbose \
      --permission-mode "${EPIC_PERMISSION_MODE:-acceptEdits}" --permission-prompts none \
      --name "epic-$epic-$child" >/dev/null 2>&1 &
    echo $! > "$dir/pid"
  )
  echo "launched $epic/$child pid=$(cat "$dir/pid") log=$dir/log"
}

# shortcut: pid reuse can make a dead run read as alive; stale heartbeat then flags it hung.
cmd_check() {
  local epic=${1:?epic} child=${2:?child} hung_after=${3:?hung-after seconds} dir pid newest age p t
  shift 3
  case "$hung_after" in *[!0-9]*) echo "hung-after must be whole seconds" >&2; return 2 ;; esac
  dir=$(rundir "$epic" "$child")
  [ -f "$dir/pid" ] || { echo "unknown reason=no-pid-file"; return 0; }
  [ -f "$dir/exit" ] && { echo "exited code=$(cat "$dir/exit")"; return 0; }
  pid=$(cat "$dir/pid")
  alive "$pid" || { echo "exited code=unknown"; return 0; }
  newest=$(mtime "$dir/log")
  for p in "$@"; do
    t=$(heartbeat_of "$p")
    [ "$t" -gt "$newest" ] && newest=$t
  done
  age=$(( $(date +%s) - newest ))
  if [ "$age" -gt "$hung_after" ]; then echo "hung age=${age}s"; else echo "running age=${age}s"; fi
}

# Only the final result event counts: a line quoted earlier in the run (the prompt's own template,
# a tool call) must never be mistaken for the outcome.
cmd_result() {
  local log out
  log=$(rundir "${1:?epic}" "${2:?child}")/log
  [ -f "$log" ] || { echo none; return 0; }
  out=$(grep '"type":"result"' "$log" | tail -1 \
    | grep -Eo 'EPIC-RESULT: status=(pr-open|needs-human|failed) pr=[^ ]+ reason=[^"\\]*' | tail -1)
  if [ -n "$out" ]; then echo "$out"; else echo none; fi
}

cmd_kill() {
  local dir pid pgid target i=0
  dir=$(rundir "${1:?epic}" "${2:?child}")
  [ -f "$dir/pid" ] || return 0
  pid=$(cat "$dir/pid")
  alive "$pid" || return 0
  # Group-kill only a process that leads its own group; any other group may be the caller's.
  pgid=$(/bin/ps -o pgid= -p "$pid" | tr -d ' ')
  target=$pid
  [ "$pgid" = "$pid" ] && target="-$pid"
  kill -TERM -- "$target" 2>/dev/null
  while alive "$pid" && [ $i -lt 30 ]; do sleep 0.1; i=$((i + 1)); done
  alive "$pid" && kill -KILL -- "$target" 2>/dev/null
  echo "killed pid=$pid"
}

# Worktree names are not uniform (a1718, be-1718-integration, feature/<slug>), so ask git.
# A ticket child matches its NUMBER on digit boundaries; a plan child matches its whole slug on
# word boundaries. ROOT may itself be the repo, or hold repos one level down.
# shortcut: a ticket number also matches another project's same-numbered branch; add the key if that bites.
cmd_heartbeat_paths() {
  local child=${1:?child} root=${2:-$ROOT} vault=${3:-$VAULT_DEFAULT} pat glob repo
  if is_ticket "$child"; then
    pat="(^|[^0-9])${child##*-}([^0-9]|\$)"; glob="$child-*"
  else
    printf '%s' "$child" | grep -Eq '^[a-z0-9][a-z0-9-]*$' || { echo "child id must be a ticket key or a kebab slug: $child" >&2; return 2; }
    pat="(^|[^a-z0-9])${child}([^a-z0-9]|\$)"; glob="*$child*"
  fi
  {
    for repo in "$root" "$root"/*/; do
      repo=${repo%/}
      [ -d "$repo/.git" ] || continue
      command git -C "$repo" worktree list --porcelain 2>/dev/null | awk -v re="$pat" -v main="$repo" '
        function hit(s) { return s ~ re }
        # match the folder name + branch, never the full path: a parent dir named like the slug matches all
        function emit() { n = split(path, seg, "/"); if (path != "" && path != main && hit(seg[n] " " branch)) print path; path = ""; branch = "" }
        /^worktree / { path = substr($0, 10) }
        /^branch /   { branch = substr($0, 8) }
        /^$/         { emit() }
        END          { emit() }'
    done
    find "$vault/02-Notes/Sessions" -type f -name "$glob" 2>/dev/null
  } | sort -u
}

# Umbrella plan: the rows of the first markdown table under a "## Children" heading.
#   | id | runs | deps |      runs = a ticket key, or a plan path relative to the umbrella file
# Prints one "id<TAB>runs<TAB>deps" line per child (plan paths made absolute, deps comma-joined).
# Rejects: bad ids, duplicate ids, missing plan files, deps naming no child. Exit 2 on any error.
cmd_children() {
  local file=${1:?umbrella plan} base
  [ -f "$file" ] || { echo "umbrella plan not found: $file" >&2; return 2; }
  base=$(cd "$(dirname "$file")" && pwd)
  awk -F'|' -v base="$base" '
    function trim(s) { gsub(/^[ \t`]+|[ \t`]+$/, "", s); return s }
    /^##[ \t]+Children[ \t]*$/ { inside = 1; next }
    inside && /^#/ { if (seen_table) exit; next }
    inside && /^[ \t]*\|/ {
      seen_table = 1
      id = trim($2); runs = trim($3); deps = trim($4)
      if (id == "" || id == "id" || id ~ /^:?-+:?$/) next
      gsub(/[ \t]*,[ \t]*/, ",", deps); gsub(/[ \t]+/, ",", deps)
      if (id !~ /^([A-Z][A-Z0-9]*-[0-9]+|[a-z0-9][a-z0-9-]*)$/) { print "bad child id: " id > "/dev/stderr"; bad = 1; next }
      if (id in ids) { print "duplicate child id: " id > "/dev/stderr"; bad = 1; next }
      if (runs == "") runs = id
      if (runs !~ /^[A-Z][A-Z0-9]*-[0-9]+$/ && runs !~ /^\//) runs = base "/" runs
      ids[id] = 1; n++; order[n] = id; R[id] = runs; D[id] = deps
      next
    }
    inside && seen_table && !/^[ \t]*\|/ { exit }
    END {
      if (n == 0) { print "no child rows under a ## Children table" > "/dev/stderr"; exit 2 }
      for (i = 1; i <= n; i++) {
        id = order[i]
        if (R[id] ~ /^\// && system("test -f \"" R[id] "\"") != 0) { print "plan file missing for " id ": " R[id] > "/dev/stderr"; bad = 1 }
        m = split(D[id], dl, ",")
        for (j = 1; j <= m; j++) if (dl[j] != "" && !(dl[j] in ids)) { print "dep " dl[j] " of " id " is not a child" > "/dev/stderr"; bad = 1 }
      }
      if (bad) exit 2
      for (i = 1; i <= n; i++) printf "%s\t%s\t%s\n", order[i], R[order[i]], D[order[i]]
    }' "$file"
}

# repo<TAB>check<TAB>workflow<TAB>needle, per project: <ROOT>/.claude/epic-ci-delegation.tsv.
# No file means nothing is delegated: every check stays a local gate.
# shortcut: matches the needle as text outside comments; a job disabled with `if: false` still
# counts as delegated. Upgrade to YAML parsing if CI starts disabling jobs that way.
cmd_ci_delegation() {
  local root=${2:-$ROOT} tsv repo check workflow needle
  tsv=${1:-$root/.claude/epic-ci-delegation.tsv}
  [ -f "$tsv" ] || return 0
  while IFS=$'\t' read -r repo check workflow needle || [ -n "$repo" ]; do
    case "$repo" in ''|'#'*) continue ;; esac
    if [ ! -f "$root/$repo/$workflow" ]; then
      echo "$repo $check local reason=workflow-missing"
    elif grep -v '^[[:space:]]*#' "$root/$repo/$workflow" | grep -qF -- "$needle"; then
      echo "$repo $check delegated"
    else
      echo "$repo $check local reason=needle-not-found"
    fi
  done < "$tsv"
}

sub=${1:-}
[ $# -gt 0 ] && shift
case "$sub" in
  launch) cmd_launch "$@" ;;
  check) cmd_check "$@" ;;
  result) cmd_result "$@" ;;
  kill) cmd_kill "$@" ;;
  heartbeat-paths) cmd_heartbeat_paths "$@" ;;
  children) cmd_children "$@" ;;
  ci-delegation) cmd_ci_delegation "$@" ;;
  *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
