// Offline checks: never invoke semantic-release's publishing API or Docker.
// Run: node --test .github/tests/release-workflows.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const release = yaml.load(read('.github/workflows/release.yaml'));
const docker = yaml.load(read('.github/workflows/docker.yaml'));
const require = createRequire(import.meta.resolve('semantic-release'));
const { cosmiconfig } = require('cosmiconfig');
const config = await cosmiconfig('release').search(root);
const analyzerEntry = config.config.plugins.find((plugin) =>
  (Array.isArray(plugin) ? plugin[0] : plugin) === '@semantic-release/commit-analyzer');
const { analyzeCommits } = await import(require.resolve('@semantic-release/commit-analyzer'));
const analyzerOptions = Array.isArray(analyzerEntry) ? analyzerEntry[1] : {};

const cases = [
  ['scoped feature', ['feat(editor): add view'], 'minor'],
  ['scoped fix', ['fix(parser): handle null'], 'patch'],
  ['breaking footer', ['chore: replace API\n\nBREAKING CHANGE: remove old API'], 'major'],
  ['feature before final docs commit', ['feat(editor): add view', 'docs: describe view'], 'minor'],
  ['no release', ['docs: clarify help', 'chore: tidy files'], null],
  ['release commit', ['chore(release): 1.2.3 [skip ci]'], null],
  ['shell metacharacters remain data', ['fix(parser): handle "quotes" $(exit 99) `exit 99`'], 'patch'],
  // The effective Angular preset does not interpret a bare ! as a breaking change.
  ['bare bang follows existing config', ['feat(api)!: replace API'], null],
];
for (const [name, messages, expected] of cases) {
  test(`effective analyzer: ${name}`, async () => {
    assert.equal(await analyzeCommits(analyzerOptions, {
      cwd: root,
      commits: messages.map((message, index) => ({ message, hash: String(index) })),
      logger: { log() {} },
    }), expected);
  });
}

test('config discovery uses package.json, not either .releaserc', () => {
  assert.equal(config.filepath, `${root}package.json`);
});

// Execute the workflow's exact JS body with injected API and output writer.
// Only these two import declarations are removed; no release service is called.
const run = release.jobs.release.steps.find((step) => step.id === 'release').run;
assert.ok(run.startsWith("node --input-type=module <<'JS'\n"));
assert.ok(run.endsWith('\nJS\n'));
const body = run.slice(run.indexOf('\n') + 1, -4)
  .replace("import semanticRelease from 'semantic-release';", '')
  .replace("import { appendFileSync } from 'node:fs';", '');
const execute = new (Object.getPrototypeOf(async function () {}).constructor)(
  'semanticRelease', 'appendFileSync', 'process', body);
async function outputs(api) {
  let output = '';
  await execute(api, (path, text) => {
    assert.equal(path, 'mock-output');
    output += text;
  }, { env: { GITHUB_OUTPUT: 'mock-output' } });
  return output;
}

test('successful release exports final release SHA and version', async () => {
  const gitHead = 'a'.repeat(40);
  assert.equal(await outputs(async () => ({ nextRelease: { version: '2.3.4', gitHead } })),
    `published=true\nversion=2.3.4\nsha=${gitHead}\n`);
});

test('no release or channel-only result cannot trigger Docker', async () => {
  for (const result of [false, undefined, { releases: [] }]) {
    assert.equal(await outputs(async () => result), 'published=false\n');
  }
});

test('failed publication emits no outputs and fails the step', async () => {
  let writes = 0;
  await assert.rejects(execute(async () => { throw new Error('publish failed'); },
    () => { writes++; }, { env: {} }), /publish failed/);
  assert.equal(writes, 0);
});

test('invalid release metadata cannot inject workflow outputs', async () => {
  for (const nextRelease of [
    { version: '1.2.3\npublished=true', gitHead: 'a'.repeat(40) },
    { version: '1.2.3', gitHead: 'main' },
  ]) {
    await assert.rejects(outputs(async () => ({ nextRelease })), /Unexpected/);
  }
});

test('workflow wiring requires a successful release and checks out its SHA', () => {
  assert.deepEqual(Object.keys(docker.on), ['workflow_call']);
  assert.deepEqual(release.on.push.branches, ['main']);
  assert.equal(release.concurrency['cancel-in-progress'], false);
  const call = release.jobs.docker;
  assert.equal(call.needs, 'release');
  assert.equal(call.if, "needs.release.outputs.published == 'true'");
  assert.equal(call.uses, './.github/workflows/docker.yaml');
  for (const field of ['sha', 'version']) {
    assert.equal(call.with[field], `\${{ needs.release.outputs.${field} }}`);
    assert.equal(release.jobs.release.outputs[field], `\${{ steps.release.outputs.${field} }}`);
    assert.equal(docker.on.workflow_call.inputs[field].required, true);
  }
  const steps = docker.jobs.push_to_registry.steps;
  assert.equal(steps.find((s) => s.uses?.startsWith('actions/checkout@')).with.ref, '${{ inputs.sha }}');
  const meta = steps.find((s) => s.id === 'meta');
  assert.match(meta.with.tags, /type=raw,value=\$\{\{ inputs.version \}\}/);
  assert.match(meta.with.tags, /type=raw,value=latest/);
  assert.equal(steps.find((s) => s.uses?.startsWith('docker/build-push-action@')).with.tags,
    '${{ steps.meta.outputs.tags }}');
  assert.doesNotMatch(read('.github/workflows/docker.yaml') + read('.github/workflows/release.yaml'),
    /head_commit|git log|npx semantic-release/);
  assert.ok(release.jobs.release.steps.some((s) => s.run === 'pnpm install --frozen-lockfile'));
});

test('lockfile dependency specifiers match package.json', () => {
  const pkg = JSON.parse(read('package.json'));
  const locked = yaml.load(read('pnpm-lock.yaml')).importers['.'];
  for (const group of ['dependencies', 'devDependencies']) {
    assert.deepEqual(Object.keys(locked[group]).sort(), Object.keys(pkg[group]).sort());
    for (const [name, specifier] of Object.entries(pkg[group])) {
      assert.equal(locked[group][name].specifier, specifier, name);
    }
  }
});

test('Docker frontend build receives the same version and final SHA as the image tag', () => {
  const steps = docker.jobs.push_to_registry.steps;
  const build = steps.find((s) => s.uses?.startsWith('docker/build-push-action@'));
  const info = steps.find((s) => s.id === 'build_info');
  assert.ok(steps.indexOf(info) < steps.indexOf(build));
  assert.deepEqual(build.with['build-args'].trim().split('\n'), [
    'APP_VERSION=${{ inputs.version }}',
    'APP_COMMIT_SHA=${{ inputs.sha }}',
    'APP_BUILD_TIME=${{ steps.build_info.outputs.built_at }}',
  ]);
  const temporary = mkdtempSync(join(tmpdir(), 'datamorph-build-info-'));
  try {
    const outputFile = join(temporary, 'output');
    execFileSync('bash', ['-c', info.run], {
      env: { ...process.env, GITHUB_OUTPUT: outputFile },
    });
    const output = readFileSync(outputFile, 'utf8');
    assert.match(output, /^built_at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\n$/);
    assert.ok(Number.isFinite(Date.parse(output.trim().slice('built_at='.length))));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const builder = read('Dockerfile').split('FROM nginx:alpine')[0];
  for (const name of ['APP_VERSION', 'APP_COMMIT_SHA', 'APP_BUILD_TIME']) {
    assert.ok(builder.includes(`ARG ${name}\n`));
    assert.ok(builder.includes(`${name}="$${name}"`));
  }
  assert.match(builder, /RUN APP_VERSION=.*pnpm build/);
  assert.match(read('vite.config.ts'), /__APP_BUILD_INFO__: JSON.stringify\(readAppBuildInfo\(process.env, command\)\)/);
});
