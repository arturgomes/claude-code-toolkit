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
      reviewedFiles: [],
      reviewQueue: [],
      adversarialLaunched: false,
      adversarialCompleted: false,
    };
  }
  return migrateEntry(state[key]);
}

// State written before per-file coverage existed. A completed review covered
// everything edited up to then; an in-flight one covered it too unless edits
// landed during it, in which case its snapshot is unknown and credits nothing.
function migrateEntry(entry) {
  if (!Array.isArray(entry.reviewedFiles)) {
    entry.reviewedFiles = entry.adversarialCompleted ? [...entry.editedFiles] : [];
  }
  if (!Array.isArray(entry.reviewQueue)) {
    const inFlight = entry.adversarialLaunched && !entry.adversarialCompleted;
    const snapshot = entry.needsReReview ? [] : [...entry.editedFiles];
    entry.reviewQueue = inFlight ? [snapshot] : [];
  }
  delete entry.needsReReview;
  delete entry.reviewingFiles;
  return entry;
}

function isReviewInFlight(entry) {
  return entry.reviewQueue.length > 0;
}

function union(target, items) {
  for (const item of items) {
    if (!target.includes(item)) target.push(item);
  }
  return target;
}

// Each launch snapshots every file edited so far. Launches queue FIFO because
// SubagentStop cannot say which review finished — crediting the oldest keeps a
// completion from covering files only a later launch saw.
function startReview(entry) {
  entry.reviewQueue.push([...entry.editedFiles]);
  entry.adversarialLaunched = true;
  entry.adversarialCompleted = false;
  return entry;
}

function completeReview(entry) {
  union(entry.reviewedFiles, entry.reviewQueue.shift() ?? []);
  entry.adversarialLaunched = isReviewInFlight(entry);
  entry.adversarialCompleted = !entry.adversarialLaunched && !isReviewOwed(entry);
  return entry;
}

// A review owes a file until one covers it. A running review covers only its
// own snapshot: that keeps a background review from re-blocking every turn
// while it works, without letting a review that never reports back waive every
// later edit.
function isReviewOwed(entry) {
  const covered = new Set([...entry.reviewedFiles, ...entry.reviewQueue.flat()]);
  return entry.editedFiles.some((file) => !covered.has(file));
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
// semantics cannot drift apart. Coverage decides what is owed (isReviewOwed):
// re-editing a covered file is applying that review, not new work — re-arming
// on it is what made the gate loop review → fix → review.
function armGate(entry, identifiers) {
  union(entry.editedFiles, identifiers);
  if (isReviewOwed(entry)) entry.adversarialCompleted = false;
  return entry;
}

// Only source code arms the gate. Plans, notes, memory, lockfiles and lock
// files are prose or bookkeeping, and gating on them turned every doc fix into
// a demanded review.
const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro',
  'py', 'go', 'rs', 'java', 'kt', 'kts', 'scala', 'swift', 'rb', 'php', 'cs', 'pl',
  'c', 'h', 'cc', 'cpp', 'hpp', 'm', 'mm', 'dart', 'ex', 'exs', 'lua', 'zig', 'hs', 'clj',
  'groovy', 'gradle', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'sql', 'prisma', 'graphql', 'gql', 'proto',
  'css', 'scss', 'sass', 'less', 'html', 'yml', 'yaml', 'tf', 'hcl',
]);

// Extensionless files that are executable build/infra code.
const CODE_BASENAMES = /^(Dockerfile|Containerfile|Makefile|GNUmakefile|Jenkinsfile)(\..+)?$/;

function isCodePath(filePath) {
  const base = path.basename(filePath);
  if (CODE_BASENAMES.test(base)) return true;
  const match = /\.([A-Za-z0-9]+)$/.exec(base);
  return match !== null && CODE_EXTENSIONS.has(match[1].toLowerCase());
}

function shouldTrackEdit(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return false;
  return isCodePath(filePath);
}

module.exports = {
  armGate,
  completeReview,
  conversationKey,
  gateMode,
  getEntry,
  isAdversarialInvocation,
  isAdversarialTask,
  isCodePath,
  isGateEnabled,
  isReviewInFlight,
  isReviewOwed,
  readState,
  shouldTrackEdit,
  startReview,
  stateFile,
  writeState,
};
