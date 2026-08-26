'use strict';

// PostToolUse:Bash — arms the gate for edits made through the shell.
//
// Tracking only Edit/Write/MultiEdit leaves the gate blind to `sed -i`, heredoc
// redirects, `tee`, `cp`/`mv`/`rm` and interpreter one-liners — and an agent
// told to prefer shell file operations then edits code without ever arming it.
const { runHook } = require('./lib/hook');
const { armGate, readState, writeState, conversationKey, getEntry, shouldTrackEdit } = require('./lib/state');
const { analyzeBashCommand } = require('./lib/bash-write');

runHook((payload) => {
  const analysis = analyzeBashCommand((payload.tool_input || {}).command);
  if (!analysis.isWrite) return {};

  const identifiers = analysis.paths.filter(shouldTrackEdit);
  // A write whose target is not statically resolvable (an interpreter script,
  // `git apply`) still has to arm the gate — record the command instead.
  for (const segment of analysis.unresolved) {
    identifiers.push(`bash:${segment.slice(0, 120)}`);
  }
  if (identifiers.length === 0) return {};

  const key = conversationKey(payload);
  const state = readState();
  state[key] = armGate(getEntry(state, key), identifiers);
  writeState(state);
  return {};
});
