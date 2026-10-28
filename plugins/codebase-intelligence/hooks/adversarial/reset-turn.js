'use strict';

// UserPromptSubmit — a HUMAN prompt starts a new turn; a harness notification (background
// subagent result, teammate message) continues the current one and changes nothing.
//
// Per human prompt:
//   completed + settled  → drop (the fix turn already ended)
//   completed, unsettled → keep (this prompt IS the fix turn: its edits are covered)
//   launched, pending    → keep once, drop on the second prompt (the reviewer never reported)
//   asked, never launched→ drop (one nag per arming — the ask was declined)
//   edits, never asked   → keep (an interrupted turn still owes its review)
const { runHook } = require('./lib/hook');
const { readState, writeState, conversationKey, dropEntry, isHarnessNotification } = require('./lib/state');

runHook((payload) => {
  if (isHarnessNotification(payload.prompt)) return {};
  const key = conversationKey(payload);
  const state = readState();
  const entry = state[key];
  if (!entry || entry.editedFiles.length === 0) return {};

  const drop = () => {
    dropEntry(state, key);
    writeState(state, key);
    return {};
  };
  if (entry.adversarialCompleted) return entry.settled ? drop() : {};
  if (entry.adversarialLaunched) {
    entry.pendingPrompts = (entry.pendingPrompts || 0) + 1;
    if (entry.pendingPrompts >= 2) return drop();
    writeState(state, key);
    return {};
  }
  if (entry.asked) return drop();
  return {};
});
