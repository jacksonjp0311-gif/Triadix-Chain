import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extractRoot = path.join(root, 'triadix-run', 'agnt-plugin-package-test');
const pluginDir = path.join(extractRoot, 'triadix-ledger');
const stateFile = path.join(extractRoot, 'state.json');

fs.rmSync(extractRoot, { recursive: true, force: true });
fs.mkdirSync(extractRoot, { recursive: true });
execFileSync('tar', ['-xzf', path.join(root, 'agnt-plugin', 'triadix-ledger.agnt'), '-C', extractRoot], { stdio: 'inherit' });

const pkg = JSON.parse(fs.readFileSync(path.join(pluginDir, 'package.json'), 'utf8'));
assert.equal(pkg.version, '3.0.1');
assert.equal(pkg.dependencies?.ws, '^8.18.0');
assert.equal(fs.existsSync(path.join(pluginDir, 'node_modules', 'ws', 'index.js')), true);

const core = await import(pathToFileURL(path.join(pluginDir, 'triadix-core.js')).href);
const { normalizeValidatorIds, TriadicEngine } = core;
assert.deepEqual(normalizeValidatorIds('annie,security,workflow'), ['annie', 'security', 'workflow']);
assert.deepEqual(normalizeValidatorIds([' annie ', 'security', '']), ['annie', 'security']);

const engine = new TriadicEngine({ nodeId: 'test-node', validators: 'annie,security,workflow' });
assert.deepEqual(Array.from(engine.consensus.validators), ['annie', 'security', 'workflow']);
engine.run(2);
engine.saveToFile(stateFile);

const submit = (await import(pathToFileURL(path.join(pluginDir, 'triadix-submit-tx.js')).href)).default;
const submitResult = await submit.execute({
  stateFile,
  sender: 'alice',
  receiver: 'bob',
  amount: 1,
  nonce: 1,
  sign: 'false'
});
assert.equal(submitResult.success, true);
assert.equal(submitResult.signed, false);

const consensus = (await import(pathToFileURL(path.join(pluginDir, 'triadix-consensus.js')).href)).default;
const addResult = await consensus.execute({
  stateFile,
  action: 'add-validators',
  validators: 'annie,security,workflow'
});
assert.equal(addResult.success, true);
assert.deepEqual(addResult.consensusResult.added, ['annie', 'security', 'workflow']);

const entrypoints = [
  'triadix-run.js',
  'triadix-submit-tx.js',
  'triadix-status.js',
  'triadix-health-report.js',
  'triadix-deploy-contract.js',
  'triadix-consensus.js',
  'triadix-gossip.js',
  'triadix-persist.js'
];
for (const file of entrypoints) {
  await import(pathToFileURL(path.join(pluginDir, file)).href);
}

console.log('AGNT plugin package regression tests passed');


