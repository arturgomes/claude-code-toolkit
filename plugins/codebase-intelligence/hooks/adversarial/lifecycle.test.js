'use strict';

// End-to-end test of the adversarial gate: drives the REAL hook scripts with
// synthetic payloads and asserts the state machine plus the Stop decision.
//   node hooks/adversarial/lifecycle.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOKS = __dirname;
const STATE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adversarial-gate-')), 'state.json');
const SESSION = 'lifecycle-test-session';

function runHook(script, payload, env = {}) {
  const out = execFileSync(process.execPath, [path.join(HOOKS, script)], {
    input: JSON.stringify({ session_id: SESSION, ...payload }),
    encoding: 'utf8',
    env: { ...process.env, CI_ADVERSARIAL_GATE: '1', CI_ADVERSARIAL_STATE: STATE_FILE, ...env },
  });
  return out.trim() ? JSON.parse(out) : {};
}

function entry() {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))[SESSION] ?? null;
}

function reset() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, '{}');
}

const bashEdit = (command, env) => runHook('track-bash-edit.js', { tool_name: 'Bash', tool_input: { command } }, env);
const toolEdit = (filePath, env) => runHook('track-edit.js', { tool_name: 'Edit', tool_input: { file_path: filePath } }, env);
const launch = (toolInput, env) => runHook('mark-adversarial.js', { tool_name: 'Agent', tool_input: toolInput }, env);
const subagentStop = (env) => runHook('subagent-adversarial.js', {}, env);
const stop = (extra = {}, env) => runHook('require-adversarial.js', extra, env);

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

test('clean session: Stop allows', () => {
  assert.deepStrictEqual(stop(), {});
});

test('Bash sed -i arms the gate and Stop blocks', () => {
  bashEdit("sed -i 's/a/b/' /repo/src/x.ts");
  assert.deepStrictEqual(entry().editedFiles, ['/repo/src/x.ts']);
  assert.strictEqual(stop().decision, 'block');
});

test('heredoc redirect arms the gate', () => {
  bashEdit("cat > /repo/src/x.ts <<'EOF'\nbody\nEOF");
  assert.deepStrictEqual(entry().editedFiles, ['/repo/src/x.ts']);
});

test('read-only Bash does not arm', () => {
  bashEdit('grep -r foo /repo/src');
  assert.strictEqual(entry(), null);
  assert.deepStrictEqual(stop(), {});
});

test('scratchpad and /dev/null writes do not arm', () => {
  bashEdit('echo hi > /tmp/claude-1000/proj/sess/scratchpad/note.md');
  bashEdit('build > /dev/null 2>&1');
  assert.strictEqual(entry(), null);
});

test('Agent launch + SubagentStop clears the gate', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  launch({ description: 'Adversarial review', subagent_type: 'general-purpose' });
  assert.strictEqual(entry().adversarialLaunched, true);
  subagentStop();
  assert.strictEqual(entry().adversarialCompleted, true);
  assert.deepStrictEqual(stop(), {});
});

test('Skill(doubt-driven) also counts as the adversarial pass', () => {
  bashEdit('cp /tmp/a.ts /repo/src/b.ts');
  launch({ skill: 'doubt-driven' });
  assert.strictEqual(entry().adversarialLaunched, true);
  subagentStop();
  assert.deepStrictEqual(stop(), {});
});

test('a mention of "adversarial" in the prompt body does not count', () => {
  toolEdit('/repo/src/x.ts');
  launch({ description: 'Explore the codebase', prompt: 'run an adversarial review later' });
  assert.strictEqual(entry().adversarialLaunched, false);
  subagentStop();
  assert.strictEqual(stop().decision, 'block');
});

test('edits during an in-flight review re-arm instead of clearing', () => {
  toolEdit('/repo/src/x.ts');
  launch({ description: 'Adversarial review' });
  bashEdit("sed -i 's/c/d/' /repo/src/y.ts");
  assert.strictEqual(entry().needsReReview, true);
  subagentStop();
  assert.strictEqual(entry().adversarialCompleted, false, 'must re-arm, not clear');
  assert.strictEqual(stop().decision, 'block');
});

test('stop_hook_active makes the block one-shot', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  assert.deepStrictEqual(stop({ stop_hook_active: true }), {});
});

test('interpreter heredoc write arms via an unresolved marker', () => {
  bashEdit("python3 - <<'PY'\nimport pathlib\npathlib.Path('/repo/src/z.ts').write_text('x')\nPY");
  assert.ok(entry().editedFiles.length > 0);
  assert.strictEqual(stop().decision, 'block');
});

test('gate off (default): nothing is tracked and Stop never blocks', () => {
  const off = { CI_ADVERSARIAL_GATE: '' };
  toolEdit('/repo/src/x.ts', off);
  bashEdit("sed -i 's/a/b/' /repo/src/x.ts", off);
  assert.strictEqual(entry(), null);
  assert.deepStrictEqual(stop({}, off), {});
});

test('warn mode reminds without blocking', () => {
  const warn = { CI_ADVERSARIAL_GATE: 'warn' };
  toolEdit('/repo/src/x.ts', warn);
  const response = stop({}, warn);
  assert.strictEqual(response.decision, undefined);
  assert.match(response.systemMessage, /Adversarial review gate/);
});

test('malformed payload never throws', () => {
  const out = execFileSync(process.execPath, [path.join(HOOKS, 'require-adversarial.js')], {
    input: 'not json',
    encoding: 'utf8',
    env: { ...process.env, CI_ADVERSARIAL_GATE: '1', CI_ADVERSARIAL_STATE: STATE_FILE },
  });
  assert.deepStrictEqual(JSON.parse(out.trim()), {});
});

let failures = 0;
for (const [name, fn] of cases) {
  reset();
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name} — ${error.message}`);
  }
}

fs.rmSync(path.dirname(STATE_FILE), { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILING`);
process.exit(failures === 0 ? 0 : 1);
