'use strict';

// One entry point for every adversarial hook, so the fail-open contract is
// written once: read stdin, parse, exit quietly when the gate is off, and print
// `{}` on ANY error. A hook that throws is a hook that breaks every session.
const { isGateEnabled } = require('./state');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

/**
 * @param {(payload: object) => object|void} handler returns the hook response;
 *   anything falsy becomes `{}` (the no-op response).
 */
function runHook(handler) {
  readStdin()
    .then((input) => {
      if (!isGateEnabled()) return {};
      let payload = {};
      try {
        payload = JSON.parse(input || '{}');
      } catch {
        return {};
      }
      return handler(payload) || {};
    })
    .catch(() => ({}))
    .then((response) => {
      process.stdout.write(JSON.stringify(response) + '\n');
    })
    .catch(() => {
      process.stdout.write('{}\n');
    });
}

module.exports = { runHook, readStdin };
