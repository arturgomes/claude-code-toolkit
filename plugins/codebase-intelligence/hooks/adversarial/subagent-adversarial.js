'use strict';

// SubagentStop — marks the launched adversarial review complete.
//
// Claude Code's SubagentStop payload carries no description and no modified-file
// list, so the finished subagent cannot be identified. Heuristic: if an
// adversarial review is the one in flight, this stop is its completion. The
// known consequence is that a non-adversarial subagent finishing while an
// adversarial one is still running can clear the gate early.
const { runHook } = require('./lib/hook');
const { readState, writeState, conversationKey, getEntry } = require('./lib/state');

runHook((payload) => {
  const key = conversationKey(payload);
  const state = readState();
  const entry = getEntry(state, key);

  if (!entry.adversarialLaunched || entry.adversarialCompleted) return {};

  if (entry.needsReReview) {
    // Edits landed DURING the review — re-arm so the next Stop asks again.
    entry.adversarialLaunched = false;
    entry.adversarialCompleted = false;
    entry.needsReReview = false;
  } else {
    entry.adversarialCompleted = true;
  }

  state[key] = entry;
  writeState(state);
  return {};
});
