'use strict';

// Stop — refuses to end a turn that edited code without a completed adversarial
// review. `CI_ADVERSARIAL_GATE=warn` downgrades the block to a reminder.
const { runHook } = require('./lib/hook');
const { readState, writeState, conversationKey, getEntry, gateMode } = require('./lib/state');

const REASON = [
  'Adversarial review gate: code was edited this session without a completed adversarial pass.',
  'Launch a subagent now (Agent tool):',
  '- subagent_type: general-purpose',
  '- description: Adversarial review  ← must contain "adversarial"; the gate matches on it',
  '- prompt: Follow the codebase-intelligence `doubt-driven` skill. Critique the design and',
  '  scrutinise the code written this turn. State the goal, the files touched, and the approach.',
  'Address the real findings (or overrule them explicitly, with reasoning), then close with a',
  'short "Adversarial review" section naming what was raised and what you did about it.',
].join('\n');

runHook((payload) => {
  const key = conversationKey(payload);
  const state = readState();
  // One nag per arming: once asked, drop the entry. Left armed, the gate re-blocks the first
  // Stop of every later turn, edits or not — and fixes made after the review re-arm it anyway.
  const release = () => {
    if (!state[key]) return;
    delete state[key];
    writeState(state);
  };

  // Re-entrancy guard: this Stop hook's own block is what re-ran the turn. The forced
  // continuation is over, so release — a gate that can re-block forever is a hang.
  if (payload.stop_hook_active) {
    release();
    return {};
  }

  const entry = getEntry(state, key);
  const needsReview = entry.editedFiles.length > 0 && !entry.adversarialCompleted;
  if (!needsReview) return {};

  if (gateMode() === 'warn') {
    release();
    return { systemMessage: REASON };
  }
  return { decision: 'block', reason: REASON };
});
