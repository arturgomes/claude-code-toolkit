'use strict';

// UserPromptSubmit — a new turn starts clean. Without this, a turn that ended without a Stop
// (interrupt, crash) leaves a completed entry behind and the next turn's edits skip review.
const { runHook } = require('./lib/hook');
const { readState, writeState, conversationKey } = require('./lib/state');

runHook((payload) => {
  const key = conversationKey(payload);
  const state = readState();
  if (!state[key] || !state[key].adversarialCompleted) return {};
  delete state[key];
  writeState(state);
  return {};
});
