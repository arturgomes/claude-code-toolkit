'use strict';

// Stop — refuses to end a turn that edited code no adversarial review has
// covered or is covering. `CI_ADVERSARIAL_GATE=warn` downgrades the block to a reminder.
const { runHook } = require('./lib/hook');
const { readState, conversationKey, getEntry, gateMode, isReviewOwed } = require('./lib/state');

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
  // Re-entrancy guard: this Stop hook's own block is what re-ran the turn.
  // One shot per turn — a gate that can re-block forever is a hang.
  if (payload.stop_hook_active) return {};

  const state = readState();
  const entry = getEntry(state, conversationKey(payload));
  if (!isReviewOwed(entry)) return {};

  if (gateMode() === 'warn') {
    return { systemMessage: REASON };
  }
  return { decision: 'block', reason: REASON };
});
