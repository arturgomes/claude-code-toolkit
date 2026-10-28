'use strict';

// Stop — refuses to end a turn that edited code without a completed adversarial
// review. `CI_ADVERSARIAL_GATE=warn` downgrades the block to a reminder.
const { runHook } = require('./lib/hook');
const { readState, writeState, conversationKey, getEntry, dropEntry, gateMode, MAX_ASKS_PER_SESSION } = require('./lib/state');

const REASON = [
  'Adversarial review gate: code was edited this session without a completed adversarial pass.',
  'Launch a subagent now (Agent tool):',
  '- subagent_type: general-purpose',
  '- description: Adversarial review  ← must contain "adversarial"; the gate matches on it',
  '- prompt: Critique the design and scrutinise the code written this turn (the',
  '  `adversarial-reviewer` skill fits). State the goal, the files touched, and the approach.',
  'Address the real findings (or overrule them explicitly, with reasoning), then close with a',
  'short "Adversarial review" section naming what was raised and what you did about it.',
].join('\n');

// Reviews run in the background and report in a later turn, so the in-flight mark has to
// outlive this Stop; reset-turn.js drops the arming on the next human prompt. What this hook
// guarantees: at most ONE ask per human turn, and at most MAX_ASKS_PER_SESSION blocks per session.
runHook((payload) => {
  const key = conversationKey(payload);
  const state = readState();
  const entry = getEntry(state, key);
  const save = () => {
    state[key] = entry;
    writeState(state, key);
  };

  if (entry.adversarialCompleted) {
    // A second Stop after the review settled means a later turn whose prompt never reached
    // reset-turn (hook not registered, older harness): the review is stale — forget it here.
    if (entry.settled) {
      dropEntry(state, key);
      writeState(state, key);
      return {};
    }
    // The review ran; this Stop ends the turn that applied its findings.
    entry.settled = true;
    save();
    return {};
  }
  // Re-entrancy guard: this Stop hook's own block is what re-ran the turn.
  if (payload.stop_hook_active) return {};
  if (entry.editedFiles.length === 0) return {};
  // A launched review will report (possibly as a later turn) — never ask for a second one.
  if (entry.adversarialLaunched) return {};
  // One nag per arming.
  if (entry.asked) return {};

  entry.asked = true;
  entry.asks += 1;
  save();
  if (gateMode() === 'warn' || entry.asks > MAX_ASKS_PER_SESSION) return { systemMessage: REASON };
  return { decision: 'block', reason: REASON };
});
