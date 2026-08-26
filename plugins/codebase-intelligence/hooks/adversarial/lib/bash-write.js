'use strict';

// Detects whether a Bash command mutated files, and which ones.
// Needed because the adversarial gate's PostToolUse tracker only sees
// Edit/Write/MultiEdit — file edits made through sed/heredoc/tee/cp bypass it.

// Heredoc opener: `<<EOF`, `<<-'EOF'`, `<< "EOF"`.
const HEREDOC_START_RE = /<<-?\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))/g;

// Paths whose mutation is never a code edit worth gating on.
const EXCLUDED_PATH_PATTERNS = [
  /^\/dev\//,
  /^\/proc\//,
  /^\/sys\//,
  /^\/tmp\//,
  /^\/var\/tmp\//,
  /\/\.claude\/hooks\/\.state\//,
  /\/scratchpad\//,
  /\/node_modules\//,
  /\/\.git\/(?!hooks\/)/,
  /^\/dev\/null$/,
];

// `cmd > file`, `cmd 2>> file`. Excludes fd dups (`2>&1`) and here-docs (`<<`).
const REDIRECT_RE = /(?:^|\s)\d?>{1,2}\s*(?!&)("[^"]*"|'[^']*'|[^\s;|&<>()]+)/g;

// Commands that write their operands. Value = how to pick the written paths.
const WRITE_COMMANDS = {
  tee: 'all',
  cp: 'last',
  mv: 'last',
  install: 'last',
  rm: 'all',
  rmdir: 'all',
  touch: 'all',
  truncate: 'all',
  ln: 'last',
  patch: 'all',
  chmod: 'skipFirst',
  chown: 'skipFirst',
  shred: 'all',
};

// Heredoc bodies are payload, not commands — a body line containing `> x` or
// `|` must not be parsed as a redirect or a segment break.
function stripHeredocBodies(command) {
  const lines = command.split('\n');
  const kept = [];
  let delimiter = null;

  for (const line of lines) {
    if (delimiter !== null) {
      if (line.trim() === delimiter) delimiter = null;
      continue;
    }
    kept.push(line);

    HEREDOC_START_RE.lastIndex = 0;
    let match;
    let lastDelimiter = null;
    while ((match = HEREDOC_START_RE.exec(line)) !== null) {
      lastDelimiter = match[1] ?? match[2] ?? match[3];
    }
    if (lastDelimiter) delimiter = lastDelimiter;
  }

  return kept.join('\n');
}

// Splits on `;`, newline, `&&`, `||`, `|` — but only outside quotes, so a sed
// script like 's|a|b|g' stays intact.
function splitSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '\\' && index + 1 < command.length) {
      current += char + command[index + 1];
      index += 1;
      continue;
    }
    if (char === ';' || char === '\n' || char === '|') {
      segments.push(current);
      current = '';
      continue;
    }
    if (char === '&') {
      // `&&` and a trailing `&` both end a command; `2>&1` is handled by the
      // redirect regex's negative lookahead, so splitting here is safe.
      segments.push(current);
      current = '';
      if (command[index + 1] === '&') index += 1;
      continue;
    }
    current += char;
  }

  segments.push(current);
  return segments.filter((segment) => segment.trim().length > 0);
}

function stripQuotes(token) {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return token.slice(1, -1);
    }
  }
  return token;
}

function tokenize(segment) {
  // Keeps quoted runs together; drops the quotes.
  const tokens = segment.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? [];
  return tokens.map(stripQuotes);
}

function isExcludedPath(filePath) {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

function isOption(token) {
  return token.startsWith('-') && token !== '-';
}

// sed/perl in-place editing: -i, -i.bak, --in-place, perl -pi -e.
function isInPlaceFlag(token) {
  return /^--in-place/.test(token) || /^-[a-zA-Z]*i/.test(token);
}

// A sed/perl script operand, not a file (e.g. 's/a/b/', '1d', 'y/ab/cd/').
function looksLikeSedScript(token) {
  return /^\s*(?:\d+[,~+]?\d*)?\s*[a-zA-Z]?\s*[sy]?[/|,#!]/.test(token) || /^\d*[dpaiq]$/.test(token);
}

function collectRedirectTargets(segment) {
  const targets = [];
  let match;
  REDIRECT_RE.lastIndex = 0;
  while ((match = REDIRECT_RE.exec(segment)) !== null) {
    targets.push(stripQuotes(match[1]));
  }
  return targets;
}

function collectInPlaceTargets(tokens) {
  const command = tokens[0];
  if (command !== 'sed' && command !== 'perl' && command !== 'gsed') return null;
  const rest = tokens.slice(1);
  if (!rest.some(isInPlaceFlag)) return null;

  const targets = [];
  let expectFlagValue = false;
  let scriptConsumed = false;
  for (const token of rest) {
    if (expectFlagValue) {
      expectFlagValue = false;
      scriptConsumed = true;
      continue;
    }
    if (isOption(token)) {
      // -e/-f take the script as the NEXT token.
      if (/^-[a-zA-Z]*[ef]$/.test(token)) expectFlagValue = true;
      continue;
    }
    if (!scriptConsumed && looksLikeSedScript(token)) {
      scriptConsumed = true;
      continue;
    }
    targets.push(token);
  }
  return targets;
}

// Interpreters get their program from a heredoc, `-c`, or `-e`, so no operand
// naming the written file exists. Detect write intent from the program text.
const INTERPRETERS = new Set(['python', 'python3', 'node', 'ruby', 'perl', 'php', 'deno', 'bun', 'sh', 'bash', 'zsh']);

const INTERPRETER_WRITE_MARKERS =
  /write_text|write_bytes|writeFileSync|writeFile|appendFileSync|copyfileobj|shutil\.(?:copy|move)|os\.(?:remove|unlink|rename|replace|rmdir|makedirs)|fs\.(?:write|rm|unlink|rename|cp|copyFile)|open\s*\([^)]*['"][wax]|File\.(?:write|delete|rename)|\.unlink\(|\.rename\(|\.replace\(\s*['"]/;

function collectInterpreterWrite(tokens, fullCommand) {
  if (!INTERPRETERS.has(tokens[0])) return null;
  const takesInlineProgram = tokens.slice(1).some((token) => /^-{1,2}(?:c|e|eval)$/.test(token) || token === '-');
  const hasHeredoc = /<<-?\s*(?:"[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_]*)/.test(fullCommand);
  if (!takesInlineProgram && !hasHeredoc) return null;
  if (!INTERPRETER_WRITE_MARKERS.test(fullCommand)) return null;
  // Program text is not statically resolvable to a path — arm via `unresolved`.
  return [];
}

function collectDdTarget(tokens) {
  if (tokens[0] !== 'dd') return null;
  const of = tokens.find((token) => token.startsWith('of='));
  return of ? [of.slice(3)] : [];
}

function collectGitApplyTargets(tokens) {
  if (tokens[0] !== 'git') return null;
  const sub = tokens.find((token) => !isOption(token) && token !== 'git');
  if (sub !== 'apply' && sub !== 'checkout' && sub !== 'restore') return null;
  // Written paths are the patch's, not the operands' — unresolvable here.
  return [];
}

function collectCommandTargets(tokens) {
  const command = tokens[0];
  const strategy = WRITE_COMMANDS[command];
  if (!strategy) return null;

  const operands = tokens.slice(1).filter((token) => !isOption(token));
  if (strategy === 'all') return operands;
  if (strategy === 'skipFirst') return operands.slice(1);
  return operands.length > 1 ? operands.slice(-1) : [];
}

function analyzeSegment(segment, fullCommand) {
  const tokens = tokenize(segment);
  if (tokens.length === 0) return null;

  const redirectTargets = collectRedirectTargets(segment);
  const operandTargets =
    collectInPlaceTargets(tokens) ??
    collectDdTarget(tokens) ??
    collectGitApplyTargets(tokens) ??
    collectCommandTargets(tokens) ??
    collectInterpreterWrite(tokens, fullCommand);

  if (operandTargets === null && redirectTargets.length === 0) return null;

  return {
    segment: segment.trim(),
    paths: [...(operandTargets ?? []), ...redirectTargets],
  };
}

/**
 * @param {string} command raw Bash command line
 * @returns {{ isWrite: boolean, paths: string[], unresolved: string[] }}
 *   paths: mutated, non-excluded file paths.
 *   unresolved: segments that clearly wrote something whose path we could not
 *   extract — the caller should still arm on these.
 */
function analyzeBashCommand(command) {
  if (typeof command !== 'string' || command.trim().length === 0) {
    return { isWrite: false, paths: [], unresolved: [] };
  }

  const paths = [];
  const unresolved = [];

  for (const segment of splitSegments(stripHeredocBodies(command))) {
    const result = analyzeSegment(segment, command);
    if (!result) continue;

    const kept = result.paths.filter((filePath) => !isExcludedPath(filePath));
    if (kept.length > 0) {
      paths.push(...kept);
      continue;
    }
    // Wrote something, but every candidate was excluded (e.g. /dev/null) or
    // none could be parsed. Only the latter should arm the gate.
    if (result.paths.length === 0) unresolved.push(result.segment);
  }

  const uniquePaths = [...new Set(paths)];
  return {
    isWrite: uniquePaths.length > 0 || unresolved.length > 0,
    paths: uniquePaths,
    unresolved,
  };
}

module.exports = { analyzeBashCommand, isExcludedPath, splitSegments, stripHeredocBodies };
