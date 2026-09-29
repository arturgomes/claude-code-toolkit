'use strict';

// SubagentStop — marks the launched adversarial review complete.
//
// Claude Code's SubagentStop payload carries no description and no modified-file
// list, so the finished subagent cannot be identified. Heuristic: if an
// adversarial review is the one in flight, this stop is its completion. The
// known consequence is that a non-adversarial subagent finishing while an
// adversarial one is still running completes it early — and completion credits
// the oldest queued snapshot as reviewed for the rest of the session.
const { runHook } = require('./lib/hook');
const { readState, writeState, conversationKey, getEntry, isReviewInFlight, completeReview } = require('./lib/state');

runHook((payload) => {
  const key = conversationKey(payload);
  const state = readState();
  const entry = getEntry(state, key);

  if (!isReviewInFlight(entry)) return {};

  completeReview(entry);

  state[key] = entry;
  writeState(state);
  return {};
});
