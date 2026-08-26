'use strict';

// PreToolUse:Agent|Task|Skill — records that an adversarial review was launched.
// Launching alone does not satisfy the gate; completion is tracked separately by
// subagent-adversarial.js.
const { runHook } = require('./lib/hook');
const { readState, writeState, conversationKey, getEntry, isAdversarialInvocation } = require('./lib/state');

runHook((payload) => {
  if (!isAdversarialInvocation(payload.tool_input)) return {};

  const key = conversationKey(payload);
  const state = readState();
  const entry = getEntry(state, key);
  entry.adversarialLaunched = true;
  state[key] = entry;
  writeState(state);
  return {};
});
