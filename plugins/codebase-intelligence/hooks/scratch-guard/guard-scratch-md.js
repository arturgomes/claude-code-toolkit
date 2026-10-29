'use strict';

// PreToolUse guard: refuses to write a *.md file under /tmp or a scratchpad dir.
// Markdown dropped in scratch is lost with the session; the durable record is the
// vault step log. Fail-open like the adversarial hooks: any error prints `{}`.
const path = require('path');
const { readStdin } = require('../adversarial/lib/hook');
const { stripHeredocBodies, splitSegments } = require('../adversarial/lib/bash-write');

const SCRATCH = [/^\/tmp\//, /^\/var\/tmp\//, /\/scratchpad\//, /^"?\$\{?(?:S|SCRATCH|SCRATCHPAD|TMP|TMPDIR|TMP_DIR)\}?\//];
const REDIRECT_RE = /(?:^|\s)\d?>{1,2}\s*(?!&)("[^"]*"|'[^']*'|[^\s;|&<>()]+)/g;
const OPERAND_WRITERS = { tee: 'all', touch: 'all', cp: 'last', mv: 'last' };

const REASON =
  'Markdown is not scratch. Append this content to the vault step log 02-Notes/Sessions/<TICKET>-<SUFFIX>.steps.md ' +
  'via mcp__ultimate-obsidian__create_or_update_note (mode: append) — see shared/vault-persistence.md §4. ' +
  'Set CI_SCRATCH_MD_GUARD=off to bypass.';

const unquote = (t) => t.replace(/^(["'])(.*)\1$/, '$2');
const isScratchMd = (p) => /\.md$/i.test(p) && SCRATCH.some((re) => re.test(p));

function bashTargets(command) {
  const targets = [];
  let cwd = '';
  for (const segment of splitSegments(stripHeredocBodies(command))) {
    const tokens = (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(unquote);
    // shortcut: only `cd <path>` is tracked for relative targets; `pushd`, subshells and `cd -` are not.
    if (tokens[0] === 'cd' && tokens[1]) cwd = path.resolve(cwd || '/', tokens[1]);
    const ops = tokens.slice(1).filter((t) => !t.startsWith('-'));
    const strategy = OPERAND_WRITERS[tokens[0]];
    const found = [...segment.matchAll(REDIRECT_RE)].map((m) => unquote(m[1]));
    if (strategy === 'all') found.push(...ops);
    else if (strategy && ops.length > 1) found.push(ops[ops.length - 1]);
    for (const t of found) targets.push(cwd && !path.isAbsolute(t) ? path.resolve(cwd, t) : t);
  }
  return targets;
}

function decide(payload) {
  if (/^(off|0|false)$/i.test(process.env.CI_SCRATCH_MD_GUARD ?? '')) return {};
  const input = payload.tool_input ?? {};
  const targets = payload.tool_name === 'Bash' ? bashTargets(String(input.command ?? '')) : [input.file_path];
  if (!targets.some((t) => typeof t === 'string' && isScratchMd(t))) return {};
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: REASON } };
}

readStdin().then((input) => {
  let out = {};
  try {
    out = decide(JSON.parse(input || '{}'));
  } catch {
    // fail open
  }
  process.stdout.write(JSON.stringify(out) + '\n');
});
