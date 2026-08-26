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

function writeState(state) {
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

function conversationKey(payload) {
  return payload.session_id || 'default';
}

function getEntry(state, key) {
  if (!state[key]) {
    state[key] = {
      editedFiles: [],
      adversarialLaunched: false,
      adversarialCompleted: false,
      needsReReview: false,
    };
  }
  return state[key];
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

  if (entry.adversarialLaunched && !entry.adversarialCompleted) {
    entry.needsReReview = true;
    return entry;
  }

  entry.adversarialLaunched = false;
  entry.adversarialCompleted = false;
  entry.needsReReview = false;
  return entry;
}

function shouldTrackEdit(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  // Never let the gate's own bookkeeping re-arm the gate.
  return !filePath.includes('adversarial-state.json');
}

module.exports = {
  armGate,
  conversationKey,
  gateMode,
  getEntry,
  isAdversarialInvocation,
  isAdversarialTask,
  isGateEnabled,
  readState,
  shouldTrackEdit,
  stateFile,
  writeState,
};
