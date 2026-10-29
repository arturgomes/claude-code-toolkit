'use strict';

const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'guard-scratch-md.js');

function run(input, env = {}) {
  const out = execFileSync(process.execPath, [SCRIPT], {
    input,
    encoding: 'utf8',
    env: { ...process.env, CI_SCRATCH_MD_GUARD: '', ...env },
  });
  return JSON.parse(out.trim());
}
const call = (tool_name, tool_input, env) => run(JSON.stringify({ tool_name, tool_input }), env);
const bash = (command) => call('Bash', { command });

const DENY = [
  ['write scratchpad md', () => call('Write', { file_path: '/tmp/claude-1000/x/scratchpad/panel-po-2409.md' })],
  ['edit /tmp upper-case MD', () => call('Edit', { file_path: '/tmp/notes.MD' })],
  ['multiedit /tmp md', () => call('MultiEdit', { file_path: '/tmp/m.md' })],
  ['bash heredoc to scratchpad md', () => bash("cat > /tmp/a/scratchpad/p.md <<'EOF'\n# x\nEOF")],
  ['bash append redirect', () => bash('echo x >> /tmp/n.md')],
  ['bash tee', () => bash('echo x | tee /tmp/n.md')],
  ['bash cp destination', () => bash('cp /home/a/a.md /tmp/b.md')],
  ['bash touch', () => bash('touch /var/tmp/t.md')],
  ['bash cd then relative redirect', () => bash('cd /tmp/x/scratchpad && echo hi > panel-le.md')],
];

const ALLOW = [
  ['write repo README', () => call('Write', { file_path: '/home/a/README.md' })],
  ['write /tmp json', () => call('Write', { file_path: '/tmp/out.json' })],
  ['write /tmp xhtml', () => call('Write', { file_path: '/tmp/epub_extracted/ch1.xhtml' })],
  ['bash read scratchpad md', () => bash('cat /tmp/x/scratchpad/p.md')],
  ['bash loop reading md', () => bash('for f in a.md b.md; do cat $f; done')],
  ['heredoc body redirect is payload', () => bash("cat > /home/a/x.ts <<'EOF'\necho > /tmp/y.md\nEOF")],
  ['bash redirect non-md', () => bash('ls > /tmp/out.txt')],
  ['opt-out off', () => call('Write', { file_path: '/tmp/s/scratchpad/p.md' }, { CI_SCRATCH_MD_GUARD: 'off' })],
  ['opt-out 0', () => call('Write', { file_path: '/tmp/p.md' }, { CI_SCRATCH_MD_GUARD: '0' })],
  ['garbage stdin', () => run('not json')],
  ['empty stdin', () => run('')],
  ['missing fields', () => call('Write', {})],
];

let failed = 0;
function check(name, fn, verify) {
  try {
    verify(fn());
    console.log(`ok ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`not ok ${name}: ${error.message}`);
  }
}

for (const [name, fn] of DENY) {
  check(`deny: ${name}`, fn, (res) => {
    assert.strictEqual(res.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.strictEqual(res.hookSpecificOutput.permissionDecision, 'deny');
    assert.ok(res.hookSpecificOutput.permissionDecisionReason.includes('steps.md'));
  });
}
for (const [name, fn] of ALLOW) check(`allow: ${name}`, fn, (res) => assert.deepStrictEqual(res, {}));

process.exit(failed ? 1 : 0);
