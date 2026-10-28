'use strict';

// Shared state for the adversarial review gate.
//
// The gate is a four-hook state machine: edits arm it, an adversarial subagent
// disarms it, and Stop refuses to end a turn that edited code without one.
// Every hook here is fail-open by construction — a crash must never be able to
// wedge a user's session, so callers wrap main() and print `{}` on any error.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isExcludedPath } = require('./bash-write');

// ${CLAUDE_PLUGIN_DATA} outlives plugin updates (${CLAUDE_PLUGIN_ROOT} does
// not), so it is the right home for state. Fall back to the user cache dir so
// the gate still works under --plugin-dir or an older harness.
function stateFile() {
  if (process.env.CI_ADVERSARIAL_STATE) return process.env.CI_ADVERSARIAL_STATE;
  const base = process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.cache', 'codebase-intelligence');
  return path.join(base, 'adversarial-state.json');
}

// OFF by default. This gate BLOCKS the end of a turn — installing a plugin must
// not silently start refusing to let people stop, so it is opt-in:
//   CI_ADVERSARIAL_GATE=1        arm it
//   CI_ADVERSARIAL_GATE=warn     never block; the Stop hook only reminds
const GATE_MODES = new Set(['1', 'true', 'on', 'block', 'warn']);

function gateMode() {
  const raw = (process.env.CI_ADVERSARIAL_GATE || '').trim().toLowerCase();
  if (!GATE_MODES.has(raw)) return 'off';
  return raw === 'warn' ? 'warn' : 'block';
}

function isGateEnabled() {
  return gateMode() !== 'off';
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch {
    return {};
  }
}

// Blocks per session before the gate downgrades itself to a reminder. Whatever ordering a
// future harness invents, the gate can never block a session more than this many times.
const MAX_ASKS_PER_SESSION = 3;
// A completed review covers the fixes that follow it — not a whole new feature. Past this many
// new paths the coverage lapses and the gate may ask once more (still under the session cap).
const COVERAGE_LIMIT = 10;
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

// `key` is the session being written: it gets a timestamp, and entries of other sessions that
// went quiet a week ago are pruned — entries are no longer deleted on Stop, so the file would
// otherwise grow by one entry per session forever.
function writeState(state, key) {
  const now = Date.now();
  if (key && state[key]) state[key].updatedAt = now;
  for (const k of Object.keys(state)) {
    if (k !== key && state[k] && state[k].updatedAt && now - state[k].updatedAt > PRUNE_AFTER_MS) delete state[k];
  }
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

function conversationKey(payload) {
  return payload.session_id || 'default';
}

function freshEntry(asks) {
  return {
    editedFiles: [],
    adversarialLaunched: false,
    adversarialCompleted: false,
    needsReReview: false,
    asked: false, // Stop already asked for a review in this human turn
    settled: false, // a Stop has run after the review completed (the fix turn ended)
    coveredAt: 0, // editedFiles.length when the review completed
    asks, // blocks issued this session — survives dropEntry, see MAX_ASKS_PER_SESSION
  };
}

function getEntry(state, key) {
  if (!state[key]) state[key] = freshEntry(0);
  const entry = state[key];
  if (typeof entry.asks !== 'number') entry.asks = 0; // entries written by 3.25.x
  if (typeof entry.coveredAt !== 'number') entry.coveredAt = 0;
  return entry;
}

// Forget the arming but not the session's ask count.
function dropEntry(state, key) {
  const asks = state[key] && typeof state[key].asks === 'number' ? state[key].asks : 0;
  state[key] = freshEntry(asks);
  return state[key];
}

function isArmed(entry) {
  return entry.editedFiles.length > 0;
}

// `doubt-driven` is this plugin's adversarial reviewer, so its name counts too.
const ADVERSARIAL_PATTERN = /adversarial|doubt-driven/i;

function isAdversarialTask(description) {
  return typeof description === 'string' && ADVERSARIAL_PATTERN.test(description);
}

// The subagent tool is named `Agent` in current Claude Code and `Task` in older
// builds, and the review can also be launched through the Skill tool. Match the
// fields that NAME the work — never the prompt body, which mentions
// "adversarial" in passing and would mark any turn that talks about reviewing.
const ADVERSARIAL_INPUT_FIELDS = ['description', 'subagent_type', 'name', 'skill'];

function isAdversarialInvocation(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  return ADVERSARIAL_INPUT_FIELDS.some((field) => isAdversarialTask(toolInput[field]));
}

// Shared by both edit trackers (Edit/Write/MultiEdit and Bash) so the arming
// semantics cannot drift apart: an in-flight review goes dirty (its completion
// re-arms instead of clearing), anything else re-arms from scratch.
function armGate(entry, identifiers) {
  for (const identifier of identifiers) {
    if (!entry.editedFiles.includes(identifier)) entry.editedFiles.push(identifier);
  }

  // A finished review is final until the next human prompt drops it. Fixing its findings
  // routinely touches files it never saw (a new test file); asking again for those was the loop.
  // But a review of three files does not cover a fifty-file feature started afterwards.
  if (entry.adversarialCompleted) {
    if (entry.editedFiles.length - entry.coveredAt <= COVERAGE_LIMIT) return entry;
    entry.adversarialLaunched = false;
    entry.adversarialCompleted = false;
    entry.needsReReview = false;
    entry.asked = false;
    entry.settled = false;
    return entry;
  }

  if (entry.adversarialLaunched && !entry.adversarialCompleted) {
    entry.needsReReview = true;
    return entry;
  }

  entry.adversarialLaunched = false;
  entry.adversarialCompleted = false;
  entry.needsReReview = false;
  return entry;
}

// Prompts the harness injects between a human's turns: a background subagent's result, a
// teammate's message. They continue the same human turn, so they must not re-open the ask —
// that is exactly how one blocked Stop became 95 (block → background review → result arrives
// as a "new" turn → fixes → block …). Best-effort: the state machine also survives a miss.
const HARNESS_PROMPT = /<task-notification>|Another Claude session sent a message|<agent-message\b|<teammate-message\b/i;

function isHarnessNotification(prompt) {
  // Not anchored: a harness may prefix a system-reminder block. Only the head is inspected.
  return typeof prompt === 'string' && HARNESS_PROMPT.test(prompt.slice(0, 400));
}

function shouldTrackEdit(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  // Never let the gate's own bookkeeping re-arm the gate, nor a write that is not
  // a code edit (scratchpad, /tmp, auto-memory notes, plans) — same list the Bash tracker uses.
  return !filePath.includes('adversarial-state.json') && !isExcludedPath(filePath);
}

module.exports = {
  MAX_ASKS_PER_SESSION,
  armGate,
  conversationKey,
  dropEntry,
  gateMode,
  getEntry,
  isArmed,
  isAdversarialInvocation,
  isAdversarialTask,
  isGateEnabled,
  isHarnessNotification,
  readState,
  shouldTrackEdit,
  stateFile,
  writeState,
};
