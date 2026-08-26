'use strict';

// Run: node ~/.claude/hooks/lib/bash-write.test.js
const assert = require('assert');
const { analyzeBashCommand } = require('./bash-write');

const WRITE_CASES = [
  ['heredoc redirect', "cat > /home/a/src/x.ts <<'EOF'\nbody\nEOF", ['/home/a/src/x.ts']],
  ['append redirect', 'echo hi >> /home/a/src/x.ts', ['/home/a/src/x.ts']],
  ['quoted redirect path', 'echo hi > "/home/a/my file.ts"', ['/home/a/my file.ts']],
  ['sed in place', "sed -i 's/a/b/' /home/a/src/x.ts", ['/home/a/src/x.ts']],
  ['sed in place suffix', "sed -i.bak 's|a|b|g' /home/a/x.ts /home/a/y.ts", ['/home/a/x.ts', '/home/a/y.ts']],
  ['sed long flag', "sed --in-place -e '1d' /home/a/x.ts", ['/home/a/x.ts']],
  ['perl in place', "perl -pi -e 's/a/b/' /home/a/x.ts", ['/home/a/x.ts']],
  ['tee', 'echo hi | tee /home/a/x.ts', ['/home/a/x.ts']],
  ['cp', 'cp /home/a/x.ts /home/a/y.ts', ['/home/a/y.ts']],
  ['mv', 'mv /home/a/x.ts /home/a/y.ts', ['/home/a/y.ts']],
  ['rm', 'rm -rf /home/a/x.ts', ['/home/a/x.ts']],
  ['touch', 'touch /home/a/x.ts', ['/home/a/x.ts']],
  ['dd', 'dd if=/dev/zero of=/home/a/x.bin', ['/home/a/x.bin']],
  ['chained write after read', 'grep foo /home/a/x.ts && echo done > /home/a/y.ts', ['/home/a/y.ts']],
  ['numeric fd redirect', 'build 2> /home/a/err.log', ['/home/a/err.log']],
];

const NON_WRITE_CASES = [
  ['plain read', 'cat /home/a/src/x.ts'],
  ['grep', "grep -r 'foo' /home/a/src"],
  ['fd dup', 'build 2>&1'],
  ['null redirect', 'build > /dev/null 2>&1'],
  ['tmp redirect', 'ls > /tmp/out.txt'],
  ['scratchpad redirect', 'echo hi > /tmp/claude-1000/x/scratchpad/note.md'],
  ['hook state write', 'echo {} > /home/artur/.claude/hooks/.state/adversarial-state.json'],
  ['sed without -i', "sed 's/a/b/' /home/a/x.ts"],
  ['heredoc input only', 'node <<EOF\nconsole.log(1)\nEOF'],
  ['empty', ''],
  ['ls', 'ls -la /home/a'],
  ['mkdir', 'mkdir -p /home/a/dir'],
];

let failures = 0;

for (const [label, command, expectedPaths] of WRITE_CASES) {
  try {
    const result = analyzeBashCommand(command);
    assert.strictEqual(result.isWrite, true, 'expected isWrite=true');
    assert.deepStrictEqual(result.paths, expectedPaths);
    console.log(`ok   write: ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL write: ${label} — ${error.message}`);
  }
}

for (const [label, command] of NON_WRITE_CASES) {
  try {
    const result = analyzeBashCommand(command);
    assert.strictEqual(result.isWrite, false, `expected isWrite=false, got paths=${JSON.stringify(result.paths)} unresolved=${JSON.stringify(result.unresolved)}`);
    console.log(`ok   no-write: ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL no-write: ${label} — ${error.message}`);
  }
}

// Unresolvable-but-real writes must still arm the gate.
try {
  const result = analyzeBashCommand('git apply /home/a/fix.patch');
  assert.strictEqual(result.isWrite, true);
  assert.deepStrictEqual(result.paths, []);
  assert.strictEqual(result.unresolved.length, 1);
  console.log('ok   unresolved: git apply arms via unresolved');
} catch (error) {
  failures += 1;
  console.error(`FAIL unresolved: git apply — ${error.message}`);
}


// --- interpreter + heredoc-body isolation ---
const EXTRA_WRITE = [
  ['python heredoc write_text', "python3 - <<'PY'\nimport pathlib\npathlib.Path('/home/a/x.ts').write_text('hi')\nPY"],
  ['node -e writeFileSync', "node -e \"require('fs').writeFileSync('/home/a/x.ts','hi')\""],
  ['python -c open w', "python3 -c \"open('/home/a/x.ts','w').write('hi')\""],
];
const EXTRA_NO_WRITE = [
  ['node -e require only', "node -e \"require('/home/a/lib.js'); console.log('ok')\""],
  ['python heredoc read only', "python3 - <<'PY'\nimport pathlib\nprint(pathlib.Path('/home/a/x.ts').read_text())\nPY"],
  ['heredoc body looks like redirect', "cat <<'EOF'\necho hi > /home/a/evil.ts\nEOF"],
];

let extraFailures = 0;
for (const [label, command] of EXTRA_WRITE) {
  const result = analyzeBashCommand(command);
  if (result.isWrite) console.log(`ok   write: ${label}`);
  else { extraFailures += 1; console.error(`FAIL write: ${label}`); }
}
for (const [label, command] of EXTRA_NO_WRITE) {
  const result = analyzeBashCommand(command);
  if (!result.isWrite) console.log(`ok   no-write: ${label}`);
  else { extraFailures += 1; console.error(`FAIL no-write: ${label} — ${JSON.stringify(result)}`); }
}
if (extraFailures > 0) { console.error(`\n${extraFailures} EXTRA FAILING`); process.exit(1); }
console.log('EXTRA PASS');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILING`);
process.exit(failures === 0 ? 0 : 1);
