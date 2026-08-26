'use strict';

// PostToolUse:Edit|Write|MultiEdit — arms the gate for tool-made edits.
const { runHook } = require('./lib/hook');
const { armGate, readState, writeState, conversationKey, getEntry, shouldTrackEdit } = require('./lib/state');

runHook((payload) => {
  const toolResponse = payload.tool_response || {};
  const toolInput = payload.tool_input || {};
  const filePath = toolResponse.filePath || toolInput.file_path;
  if (!shouldTrackEdit(filePath)) return {};

  const key = conversationKey(payload);
  const state = readState();
  state[key] = armGate(getEntry(state, key), [filePath]);
  writeState(state);
  return {};
});
