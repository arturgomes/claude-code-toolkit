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
  const e = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))[SESSION] ?? null;
  // a dropped arming is an empty entry (it keeps the session's ask count); report it as absent
  return e && e.editedFiles.length === 0 ? null : e;
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
const humanPrompt = () => runHook('reset-turn.js', { prompt: 'please continue with the next thing' });
const notification = (text) => runHook('reset-turn.js', { prompt: text });

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

test('an ignored ask is dropped on the next human prompt (one nag per arming)', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  assert.deepStrictEqual(stop({ stop_hook_active: true }), {});
  humanPrompt();
  assert.strictEqual(entry(), null);
  assert.deepStrictEqual(stop(), {}, 'turn 2 has no edits and must not block');
});

test('fixes made after the review do not re-block the next turn', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  launch({ description: 'Adversarial review' });
  subagentStop();
  toolEdit('/repo/src/x.ts'); // addressing the findings re-arms the gate
  assert.deepStrictEqual(stop({ stop_hook_active: true }), {});
  assert.deepStrictEqual(stop(), {});
});

test('fixes after a completed review do not re-arm within the turn (no review loop)', () => {
  toolEdit('/repo/src/x.ts');
  launch({ description: 'Adversarial review' });
  subagentStop();
  toolEdit('/repo/src/x.ts'); // addressing findings
  toolEdit('/repo/src/new-test.spec.ts'); // a file the review never saw: still the same fix turn
  assert.strictEqual(entry().adversarialCompleted, true);
  assert.deepStrictEqual(stop(), {}, 'no stop_hook_active needed: the review already ran');
  humanPrompt();
  assert.strictEqual(entry(), null, 'a settled review is dropped on the next human prompt');
  toolEdit('/repo/src/y.ts'); // next turn edits arm a fresh review
  assert.strictEqual(stop().decision, 'block');
});

test('background review: the result turn is covered, no second block (the 95-block loop)', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  launch({ description: 'Adversarial review of x' }); // runs in the background
  assert.deepStrictEqual(stop({ stop_hook_active: true }), {}, 'turn ends while the review runs');
  assert.strictEqual(entry().adversarialLaunched, true, 'the in-flight mark must survive the turn end');
  subagentStop(); // the background reviewer finishes
  assert.strictEqual(entry().adversarialCompleted, true);
  notification('Another Claude session sent a message: <agent-message from="a1">findings</agent-message>');
  toolEdit('/repo/src/x.ts'); // applying the findings
  toolEdit('/repo/src/z.ts');
  assert.deepStrictEqual(stop(), {}, 'the fix turn must not be blocked again');
  humanPrompt();
  assert.strictEqual(entry(), null);
});

test('background review whose result arrives as an undetected prompt still does not loop', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  launch({ description: 'Adversarial review of x' });
  assert.deepStrictEqual(stop({ stop_hook_active: true }), {});
  subagentStop();
  humanPrompt(); // the harness changed its notification text: treated as a human prompt
  toolEdit('/repo/src/x.ts');
  assert.deepStrictEqual(stop(), {}, 'completed-but-unsettled review covers this one turn');
  humanPrompt();
  assert.strictEqual(entry(), null);
});

test('a task-notification prompt does not re-open the ask', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  assert.deepStrictEqual(stop({ stop_hook_active: true }), {});
  notification('<task-notification><task-id>b1</task-id>done</task-notification>');
  toolEdit('/repo/src/y.ts');
  assert.deepStrictEqual(stop(), {}, 'one ask per human turn');
});

test('a review in flight is never asked for twice', () => {
  toolEdit('/repo/src/x.ts');
  launch({ description: 'Adversarial review' });
  assert.deepStrictEqual(stop(), {}, 'the launched review will report; do not ask again');
});

test('an abandoned in-flight review is dropped after two human prompts', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  launch({ description: 'Adversarial review' });
  humanPrompt();
  assert.ok(entry(), 'kept once: the result may still arrive');
  humanPrompt();
  assert.strictEqual(entry(), null);
});

test('an interrupted turn still owes its review on the next human prompt', () => {
  toolEdit('/repo/src/x.ts'); // no Stop ever ran (interrupt)
  humanPrompt();
  assert.strictEqual(stop().decision, 'block');
});

test('session cap: after three blocks the gate only reminds, whatever the ordering', () => {
  for (let i = 1; i <= 3; i += 1) {
    humanPrompt();
    toolEdit(`/repo/src/f${i}.ts`);
    assert.strictEqual(stop().decision, 'block', `block ${i}`);
    assert.deepStrictEqual(stop({ stop_hook_active: true }), {});
  }
  humanPrompt();
  toolEdit('/repo/src/f4.ts');
  const fourth = stop();
  assert.strictEqual(fourth.decision, undefined, 'no fourth block in a session');
  assert.match(fourth.systemMessage, /Adversarial review gate/);
});

test('an unmarked review whose result arrives as a human prompt cannot loop past the cap', () => {
  // the model launched "Review the diff" (never marked), so every fix turn re-arms from scratch
  for (let i = 1; i <= 5; i += 1) {
    humanPrompt();
    toolEdit(`/repo/src/g${i}.ts`);
    const r = stop();
    if (i <= 3) assert.strictEqual(r.decision, 'block');
    else assert.strictEqual(r.decision, undefined, `turn ${i} must not block`);
    stop({ stop_hook_active: true });
  }
});

test('edits during an in-flight review are asked about once more', () => {
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(stop().decision, 'block');
  launch({ description: 'Adversarial review' });
  toolEdit('/repo/src/y.ts'); // landed while the reviewer was reading
  subagentStop();
  assert.strictEqual(stop().decision, 'block', 'y.ts was never reviewed');
});

test('a second Stop after a settled review drops it even if reset-turn never fired', () => {
  toolEdit('/repo/src/x.ts');
  launch({ description: 'Adversarial review' });
  subagentStop();
  assert.deepStrictEqual(stop(), {}); // settles
  assert.deepStrictEqual(stop(), {}); // a later turn with no UserPromptSubmit hook
  assert.strictEqual(entry(), null);
  toolEdit('/repo/src/y.ts');
  assert.strictEqual(stop().decision, 'block');
});

test('a non-adversarial SubagentStop before any launch changes nothing', () => {
  toolEdit('/repo/src/x.ts');
  subagentStop();
  assert.strictEqual(entry().adversarialCompleted, false);
  assert.strictEqual(stop().decision, 'block');
});

test('a completed review stops covering after many new files', () => {
  toolEdit('/repo/src/x.ts');
  launch({ description: 'Adversarial review' });
  subagentStop();
  for (let i = 1; i <= 11; i += 1) toolEdit(`/repo/src/feature/${i}.ts`);
  assert.strictEqual(entry().adversarialCompleted, false, 'coverage lapsed');
  assert.strictEqual(stop().decision, 'block');
});

test('an entry written by 3.25.x (no asked/settled/asks) still works', () => {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ [SESSION]: {
    editedFiles: ['/repo/src/x.ts'], adversarialLaunched: false, adversarialCompleted: false, needsReReview: false,
  } }));
  assert.strictEqual(stop().decision, 'block');
  assert.deepStrictEqual(stop({ stop_hook_active: true }), {});
});

test('stale sessions are pruned from the state file', () => {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ old: { editedFiles: ['/a'], updatedAt: Date.now() - 8 * 86400000 } }));
  toolEdit('/repo/src/x.ts');
  assert.strictEqual(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).old, undefined);
});

test('real write shapes arm; $REPO txt and reopen( shapes behave', () => {
  for (const c of [`python3 -c "open(p,'r+').write('x')"`, `python3 -c "from pathlib import Path;Path('a').open('w')"`, `node -e "fs.createWriteStream(p)"`, `node -e "fs.openSync(p,'w')"`]) {
    reset(); bashEdit(c); assert.ok(entry(), c);
  }
  reset(); bashEdit('echo x > $REPO/requirements.txt'); assert.ok(entry(), '$REPO file must arm');
});

test('read-only interpreter open() and $VAR log redirects do not arm', () => {
  bashEdit(`python3 -c "import json;json.load(open('wt-884-be/package.json'))"`);
  bashEdit('make test > $S/m1.log 2>&1');
  assert.strictEqual(entry(), null);
  bashEdit(`python3 -c "open('/repo/a.ts','w').write('x')"`);
  assert.ok(entry().editedFiles.length > 0, 'a real write mode still arms');
});

test('scratchpad, memory notes and plans edited through tools do not arm', () => {
  toolEdit('/tmp/claude-1/p/s/scratchpad/n.md');
  toolEdit('/Users/a/.claude/projects/p/memory/m.md');
  toolEdit('/Users/a/.claude/plans/x.md');
  assert.strictEqual(entry(), null);
  assert.deepStrictEqual(stop(), {});
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
  assert.deepStrictEqual(stop({}, warn), {}, 'a reminder is given once per arming');
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
