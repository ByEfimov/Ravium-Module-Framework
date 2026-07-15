import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve('dist/cli.js');

const runCli = async (args, cwd) => {
  return await execFileAsync(process.execPath, [cliPath, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: '1' },
  });
};

const useJsonManifestFallback = async (moduleDir) => {
  await rm(path.join(moduleDir, 'ravium.module.mjs'), { force: true });
};

test('ravium module init creates clean kitchen sink module scaffold', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-init-'));

  await runCli(
    [
      'module',
      'init',
      'kitchen-sink-test',
      '--namespace',
      'ravium',
      '--slug',
      'kitchen-sink-test',
      '--name',
      'Kitchen Sink Test Module',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'kitchen-sink-test');
  const manifest = JSON.parse(await readFile(path.join(moduleDir, 'ravium.module.json'), 'utf8'));
  const packageJson = JSON.parse(await readFile(path.join(moduleDir, 'package.json'), 'utf8'));
  const moduleLock = JSON.parse(await readFile(path.join(moduleDir, 'ravium.module-lock.json'), 'utf8'));

  assert.equal(manifest.namespace, 'ravium');
  assert.equal(manifest.slug, 'kitchen-sink-test');
  assert.equal(manifest.version, '1.0.0');
  assert.equal(packageJson.dependencies['@ravium/module-sdk'], '^1.0.0');
  assert.equal(packageJson.scripts.validate, 'ravium module validate');
  assert.equal(moduleLock.dependencyGraph.module.slug, 'kitchen-sink-test');
  assert.ok(manifest.extensionPoints.leftMenu.length > 0);
  assert.equal(manifest.extensionPoints.editorTabs[0].entrypoint, 'src/editor-dashboard.html');
  assert.equal(manifest.extensionPoints.projectSettingsPages[0].entrypoint, 'src/project-settings.html');
  assert.equal(manifest.extensionPoints.commands[0].handler, 'src/commands/insert-card.js');
  assert.equal(manifest.extensionPoints.commands[0].targetComponentType, 'kitchen-sink.metric-card');
  assert.equal(manifest.extensionPoints.commands[1].targetEditorTabId, 'kitchen-sink.dashboard');
  assert.ok(manifest.components.length > 1);
  assert.ok(manifest.functions.length > 0);
  assert.ok(manifest.variables.some((variable) => variable.mode === 'encrypted'));
  await stat(path.join(moduleDir, 'package.json'));
  await stat(path.join(moduleDir, 'tsconfig.json'));
  await stat(path.join(moduleDir, 'ravium.module-lock.json'));
  await stat(path.join(moduleDir, 'src/editor.ts'));
  await stat(path.join(moduleDir, 'src/editor-dashboard.html'));
  await stat(path.join(moduleDir, 'src/project-settings.html'));
  await stat(path.join(moduleDir, 'src/commands/insert-card.js'));
  await stat(path.join(moduleDir, 'src/runtime-client.ts'));
  await stat(path.join(moduleDir, 'src/runtime-server.ts'));
  await stat(path.join(moduleDir, 'migrations/202605300001_create_kitchen_sink_events.sql'));
});

test('ravium module init scopes kitchen sink migration to custom slug', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-custom-kitchen-'));

  await runCli(
    [
      'module',
      'init',
      'custom-kitchen',
      '--namespace',
      'qa',
      '--slug',
      'custom-kitchen',
      '--name',
      'Custom Kitchen',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'custom-kitchen');
  const migration = await readFile(
    path.join(moduleDir, 'migrations/202605300001_create_kitchen_sink_events.sql'),
    'utf8',
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS module_custom_kitchen_events/);
  await runCli(['module', 'dev', '--cwd', moduleDir], workspace);
});

test('ravium module validate and build produce immutable artifact metadata', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-build-'));
  const outputDir = path.join(workspace, 'artifacts');

  await runCli(
    [
      'module',
      'init',
      'kitchen-sink-test',
      '--namespace',
      'ravium',
      '--slug',
      'kitchen-sink-test',
      '--name',
      'Kitchen Sink Test Module',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'kitchen-sink-test');
  await useJsonManifestFallback(moduleDir);
  const manifestPath = path.join(moduleDir, 'ravium.module.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.migrations[0].rollbackFile = 'migrations/202605300001_create_kitchen_sink_events.down.sql';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  await writeFile(
    path.join(moduleDir, 'migrations/202605300001_create_kitchen_sink_events.down.sql'),
    'DROP TABLE IF EXISTS module_kitchen_sink_test_events;\n',
    'utf8',
  );
  await runCli(['module', 'validate', '--cwd', moduleDir], workspace);
  await runCli(['module', 'build', '--cwd', moduleDir, '--out', outputDir], workspace);
  const { stdout: sizeStdout } = await runCli(['module', 'size', '--cwd', moduleDir, '--out', path.join(workspace, 'size-artifacts')], workspace);
  const sizeCliReport = JSON.parse(sizeStdout);

  const artifactRoot = path.join(outputDir, 'ravium', 'kitchen-sink-test', '1.0.0');
  const normalizedManifest = JSON.parse(await readFile(path.join(artifactRoot, 'manifest.json'), 'utf8'));
  const artifactRefs = JSON.parse(await readFile(path.join(artifactRoot, 'artifact-refs.json'), 'utf8'));
  const checksums = JSON.parse(await readFile(path.join(artifactRoot, 'checksums.json'), 'utf8'));
  const dependencyLock = JSON.parse(await readFile(path.join(artifactRoot, 'dependency-lock.json'), 'utf8'));
  const sizeReport = JSON.parse(await readFile(path.join(artifactRoot, 'size-report.json'), 'utf8'));
  const moderationInput = JSON.parse(await readFile(path.join(artifactRoot, 'moderation-input.json'), 'utf8'));

  assert.equal(normalizedManifest.id, 'ravium.kitchen-sink-test');
  assert.equal(artifactRefs.editorBundle, 'artifact://ravium/kitchen-sink-test/1.0.0/editor.js');
  assert.match(artifactRefs.sourceFiles['editor.js'], /registerEditorExtensions/);
  assert.match(artifactRefs.sourceFiles['src__editor-dashboard.html'], /Kitchen Sink Dashboard/);
  assert.match(artifactRefs.sourceFiles['src__project-settings.html'], /Kitchen Sink Settings/);
  assert.match(artifactRefs.sourceFiles['src__commands__insert-card.js'], /addComponent/);
  assert.match(artifactRefs.sourceFiles['src__components__MetricCard.vue'], /ravium-module-kitchen-sink/);
  assert.equal(artifactRefs.functionHandlers['kitchen-sink.send-event'].sourceFile, 'src/functions/send-event.ts');
  assert.match(artifactRefs.functionHandlers['kitchen-sink.send-event'].exportName, /run/);
  assert.match(
    artifactRefs.migrationSql['migrations__202605300001_create_kitchen_sink_events.sql'],
    /CREATE TABLE IF NOT EXISTS module_kitchen_sink_test_events/,
  );
  assert.match(
    artifactRefs.migrationRollbackSql['migrations__202605300001_create_kitchen_sink_events.sql'],
    /DROP TABLE IF EXISTS module_kitchen_sink_test_events/,
  );
  assert.equal(typeof checksums.sha256, 'string');
  assert.ok(checksums.sha256.length >= 32);
  assert.equal(dependencyLock.dependencies[0].slug, 'forms-runtime');
  assert.equal(dependencyLock.installOrder[0], 'ravium/forms-runtime@^1.0.0');
  assert.equal(dependencyLock.dependencyGraph.module.slug, 'kitchen-sink-test');
  assert.deepEqual(dependencyLock.dependencyGraph.cycles, []);
  assert.equal(moderationInput.dependencyReport.dependencies[0].contract, 'forms-runtime:v1');
  assert.ok(sizeReport.totalBytes > 0);
  assert.ok(sizeReport.totalGzipBytes > 0);
  assert.ok(sizeReport.totalBrotliBytes > 0);
  assert.ok(sizeReport.gzipFiles['editor.js'] > 0);
  assert.ok(sizeReport.brotliFiles['runtime-client.js'] > 0);
  assert.ok(sizeReport.ownEditorBundleGzipBytes > 0);
  assert.ok(sizeReport.ownRuntimeClientBrotliBytes > 0);
  assert.equal(sizeCliReport.module.id, 'ravium.kitchen-sink-test');
  assert.ok(sizeCliReport.artifactRoot.endsWith('size-artifacts/ravium/kitchen-sink-test/1.0.0'));
  assert.ok(sizeCliReport.sizeReport.totalBytes > 0);
  assert.ok(sizeCliReport.sizeReport.totalGzipBytes > 0);
  await stat(path.join(artifactRoot, 'editor.js'));
  await stat(path.join(artifactRoot, 'runtime-client.js'));
  await stat(path.join(artifactRoot, 'runtime-server.js'));
});

test('ravium module validate rejects reserved server routes and out-of-scope migrations', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-validate-security-'));

  await runCli(
    [
      'module',
      'init',
      'kitchen-sink-test',
      '--namespace',
      'ravium',
      '--slug',
      'kitchen-sink-test',
      '--name',
      'Kitchen Sink Test Module',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'kitchen-sink-test');
  await useJsonManifestFallback(moduleDir);
  const manifestPath = path.join(moduleDir, 'ravium.module.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.routes[1].path = '/api/modules/ravium/other/hijack';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('must not declare the reserved /api/modules namespace'),
  );

  manifest.routes[1].path = '/api/kitchen-sink/events';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  await writeFile(
    path.join(moduleDir, 'migrations/202605300001_create_kitchen_sink_events.sql'),
    'CREATE TABLE public.users (id UUID PRIMARY KEY);\n',
    'utf8',
  );

  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('outside module namespace module_kitchen_sink_test_'),
  );
});

test('ravium module validate rejects capabilities without declared permissions', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-validate-permissions-'));

  await runCli(
    [
      'module',
      'init',
      'kitchen-sink-test',
      '--namespace',
      'ravium',
      '--slug',
      'kitchen-sink-test',
      '--name',
      'Kitchen Sink Test Module',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'kitchen-sink-test');
  await useJsonManifestFallback(moduleDir);
  const manifestPath = path.join(moduleDir, 'ravium.module.json');
  const baseManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const removeSummaryPermission = (manifest, permission) => {
    manifest.permissions.summary = manifest.permissions.summary.filter((item) => item !== permission);
  };

  const withoutNpmPermission = structuredClone(baseManifest);
  removeSummaryPermission(withoutNpmPermission, 'npm.dependencies');
  delete withoutNpmPermission.permissions.npmDependencies;
  await writeFile(manifestPath, JSON.stringify(withoutNpmPermission, null, 2), 'utf8');
  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('does not declare npm.dependencies permission'),
  );

  const withoutRoutePermission = structuredClone(baseManifest);
  removeSummaryPermission(withoutRoutePermission, 'generated.routes');
  removeSummaryPermission(withoutRoutePermission, 'generated.serverRoutes');
  delete withoutRoutePermission.permissions.generatedRoutes;
  await writeFile(manifestPath, JSON.stringify(withoutRoutePermission, null, 2), 'utf8');
  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('does not declare generated.routes permission'),
  );

  const withoutVariablePermission = structuredClone(baseManifest);
  removeSummaryPermission(withoutVariablePermission, 'variables.encrypted');
  withoutVariablePermission.permissions.variables = ['public', 'server'];
  await writeFile(manifestPath, JSON.stringify(withoutVariablePermission, null, 2), 'utf8');
  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('does not declare variables.encrypted permission'),
  );

  const withoutMiddlewarePermission = structuredClone(baseManifest);
  withoutMiddlewarePermission.middleware = [{ name: 'auth', global: true, entrypoint: 'src/middleware/auth.global.ts' }];
  removeSummaryPermission(withoutMiddlewarePermission, 'generated.middleware');
  await writeFile(manifestPath, JSON.stringify(withoutMiddlewarePermission, null, 2), 'utf8');
  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('does not declare generated.middleware permission'),
  );

  const withoutComposablePermission = structuredClone(baseManifest);
  withoutComposablePermission.composables = [{ name: 'useSession', entrypoint: 'src/composables/useSession.ts' }];
  removeSummaryPermission(withoutComposablePermission, 'generated.composables');
  await writeFile(manifestPath, JSON.stringify(withoutComposablePermission, null, 2), 'utf8');
  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('does not declare generated.composables permission'),
  );
});

test('ravium module inspect, deps, migrate:check, and advisory print author reports', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-reports-'));

  await runCli(
    [
      'module',
      'init',
      'kitchen-sink-test',
      '--namespace',
      'ravium',
      '--slug',
      'kitchen-sink-test',
      '--name',
      'Kitchen Sink Test Module',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'kitchen-sink-test');
  const inspect = JSON.parse((await runCli(['module', 'inspect', '--cwd', moduleDir], workspace)).stdout);
  assert.equal(inspect.id, 'ravium.kitchen-sink-test');
  assert.equal(inspect.referencedFiles.length, 14);
  assert.ok(inspect.referencedFiles.includes('src/commands/insert-card.js'));
  assert.ok(inspect.referencedFiles.includes('src/editor-dashboard.html'));
  assert.ok(inspect.referencedFiles.includes('src/project-settings.html'));
  assert.equal(inspect.extensionPoints.canvasPalette, 2);

  const deps = JSON.parse((await runCli(['module', 'deps', '--cwd', moduleDir], workspace)).stdout);
  assert.equal(deps.moduleDependencies[0].slug, 'forms-runtime');
  assert.equal(deps.moduleDependencies[0].reason, 'Enables richer lead form runtime integration when installed.');
  assert.equal(deps.moduleDependencies[0].contract, 'forms-runtime:v1');
  assert.equal(deps.installOrder[0], 'ravium/forms-runtime@^1.0.0');
  assert.equal(deps.dependencyGraph.dependencies[0].id, 'ravium/forms-runtime');
  assert.deepEqual(deps.dependencyGraph.cycles, []);
  assert.deepEqual(deps.warnings, []);
  assert.equal(deps.npmDependencies.runtime.zod, '^3.25.0');

  const migrations = JSON.parse((await runCli(['module', 'migrate:check', '--cwd', moduleDir], workspace)).stdout);
  assert.equal(migrations.migrations.length, 1);
  assert.equal(migrations.rollbackSupported, 1);
  assert.deepEqual(migrations.destructiveWarnings, []);

  const advisory = JSON.parse((await runCli(['module', 'advisory', '--cwd', moduleDir], workspace)).stdout);
  assert.ok(advisory.warnings.some((warning) => warning.code === 'network-permission'));
  assert.ok(advisory.warnings.some((warning) => warning.code === 'optional-module-dependency'));
});

test('ravium module validate rejects duplicate module dependencies and advisory flags unsafe package metadata', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-dependency-policy-'));

  await runCli(
    [
      'module',
      'init',
      'kitchen-sink-test',
      '--namespace',
      'ravium',
      '--slug',
      'kitchen-sink-test',
      '--name',
      'Kitchen Sink Test Module',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'kitchen-sink-test');
  await useJsonManifestFallback(moduleDir);
  const manifestPath = path.join(moduleDir, 'ravium.module.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.moduleDependencies.push({
    namespace: 'ravium',
    slug: 'forms-runtime',
    versionRange: '^1.1.0',
    required: true,
    reason: 'Duplicate dependency should be rejected.',
  });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  await assert.rejects(
    runCli(['module', 'validate', '--cwd', moduleDir], workspace),
    (error) => error.stderr.includes('module dependency ravium/forms-runtime is declared more than once'),
  );

  manifest.moduleDependencies = [
    {
      namespace: 'ravium',
      slug: 'forms-runtime',
      versionRange: '^1.0.0',
      required: false,
      reason: 'Optional form runtime.',
    },
  ];
  manifest.dependencies.runtime['bad-package'] = 'latest';
  manifest.variables.push({
    key: 'unsafeServerToken',
    mode: 'server',
    type: 'string',
    default: 'do-not-ship',
  });
  manifest.settingsSchema.project.properties.apiKey = {
    type: 'string',
    default: 'hardcoded-key',
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const advisory = JSON.parse((await runCli(['module', 'advisory', '--cwd', moduleDir], workspace)).stdout);
  assert.ok(advisory.warnings.some((warning) => warning.code === 'unsafe-npm-range'));
  assert.ok(advisory.warnings.some((warning) => warning.code === 'server-variable-default'));
  assert.ok(advisory.warnings.some((warning) => warning.code === 'secret-setting-default'));
});

test('ravium module deps includes lockfile licenses and npm audit vulnerabilities', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-dependency-audit-'));

  await runCli(
    [
      'module',
      'init',
      'audit-test',
      '--namespace',
      'ravium',
      '--slug',
      'audit-test',
      '--name',
      'Audit Test Module',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'audit-test');
  await useJsonManifestFallback(moduleDir);
  const manifestPath = path.join(moduleDir, 'ravium.module.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.dependencies.runtime = {
    'legacy-widget': '1.0.0',
    'critical-widget': '2.0.0',
  };
  manifest.migrations = [];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  await writeFile(
    path.join(moduleDir, 'package-lock.json'),
    JSON.stringify(
      {
        lockfileVersion: 3,
        packages: {
          '': { name: '@ravium/audit-test', version: '1.0.0' },
          'node_modules/legacy-widget': {
            version: '1.0.0',
            license: 'GPL-3.0',
            hasInstallScript: true,
          },
          'node_modules/critical-widget': {
            version: '2.0.0',
            license: 'MIT',
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    path.join(moduleDir, 'ravium.npm-audit.json'),
    JSON.stringify(
      {
        vulnerabilities: {
          'critical-widget': {
            severity: 'critical',
            range: '<2.1.0',
            via: [{ title: 'Prototype pollution' }],
            fixAvailable: true,
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  const deps = JSON.parse((await runCli(['module', 'deps', '--cwd', moduleDir], workspace)).stdout);
  assert.ok(deps.packages.some((pkg) => pkg.name === 'legacy-widget' && pkg.license === 'GPL-3.0'));
  assert.ok(deps.vulnerabilities.some((vulnerability) => vulnerability.package === 'critical-widget'));
  assert.ok(deps.warnings.some((warning) => warning.code === 'copyleft-license'));
  assert.ok(deps.warnings.some((warning) => warning.code === 'npm-install-script'));
  assert.ok(deps.warnings.some((warning) => warning.code === 'known-vulnerability' && warning.severity === 'critical'));
});

test('ravium module publish requires changelog entry for manifest version', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-changelog-'));

  await runCli(
    [
      'module',
      'init',
      'kitchen-sink-test',
      '--namespace',
      'ravium',
      '--slug',
      'kitchen-sink-test',
      '--name',
      'Kitchen Sink Test Module',
      '--template',
      'kitchen-sink',
    ],
    workspace,
  );

  const moduleDir = path.join(workspace, 'kitchen-sink-test');
  await rm(path.join(moduleDir, 'CHANGELOG.md'));

  await assert.rejects(
    runCli(
      ['module', 'publish', '--cwd', moduleDir, '--api-url', 'http://127.0.0.1:9/api/v1', '--token', 'test-token'],
      workspace,
    ),
    (error) => error.stderr.includes('CHANGELOG.md must include an entry for 1.0.0'),
  );

  await writeFile(path.join(moduleDir, 'CHANGELOG.md'), '# Changelog\n\n## 0.9.0\n\n- Older release.\n', 'utf8');

  await assert.rejects(
    runCli(
      ['module', 'publish', '--cwd', moduleDir, '--api-url', 'http://127.0.0.1:9/api/v1', '--token', 'test-token'],
      workspace,
    ),
    (error) => error.stderr.includes('CHANGELOG.md must include an entry for 1.0.0'),
  );
});

test('ravium module publish submits draft and reviewable version to API', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-publish-'));
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : null;
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      body,
    });

    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET' && request.url === '/api/v1/modules/developer/modules') {
      response.end(JSON.stringify({ modules: [] }));
      return;
    }
    if (request.method === 'POST' && request.url === '/api/v1/modules/developer/modules') {
      response.statusCode = 201;
      response.end(JSON.stringify({ module: { id: 'module-1', namespace: body.namespace, slug: body.slug } }));
      return;
    }
    if (request.method === 'POST' && request.url === '/api/v1/modules/developer/modules/module-1/versions') {
      response.statusCode = 201;
      response.end(
        JSON.stringify({
          version: { id: 'version-1', moduleId: 'module-1', version: body.version, status: 'pending_review' },
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: 'not_found' } }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    await runCli(
      [
        'module',
        'init',
        'kitchen-sink-test',
        '--namespace',
        'ravium',
        '--slug',
        'kitchen-sink-test',
        '--name',
        'Kitchen Sink Test Module',
        '--template',
        'kitchen-sink',
      ],
      workspace,
    );

    const moduleDir = path.join(workspace, 'kitchen-sink-test');
    await runCli(
      [
        'module',
        'publish',
        '--cwd',
        moduleDir,
        '--api-url',
        `http://127.0.0.1:${port}/api/v1`,
        '--token',
        'test-token',
      ],
      workspace,
    );

    assert.equal(requests[0].method, 'GET');
    assert.equal(requests[0].authorization, 'Bearer test-token');
    assert.equal(requests[1].method, 'POST');
    assert.equal(requests[1].url, '/api/v1/modules/developer/modules');
    assert.equal(requests[1].body.namespace, 'ravium');
    assert.equal(requests[2].method, 'POST');
    assert.equal(requests[2].url, '/api/v1/modules/developer/modules/module-1/versions');
    assert.equal(requests[2].body.version, '1.0.0');
    assert.equal(requests[2].body.releaseChannel, 'stable');
    assert.ok(requests[2].body.manifest.components.length > 0);
    assert.ok(
      requests[2].body.artifactRefs.editorBundle.includes('artifact://ravium/kitchen-sink-test/1.0.0/editor.js'),
    );
    assert.match(requests[2].body.artifactRefs.sourceFiles['editor.js'], /registerEditorExtensions/);
    assert.match(
      requests[2].body.artifactRefs.migrationSql['migrations__202605300001_create_kitchen_sink_events.sql'],
      /CREATE TABLE IF NOT EXISTS module_kitchen_sink_test_events/,
    );
    assert.ok(requests[2].body.checksums.sha256.length >= 32);
    assert.ok(requests[2].body.sizeReport.totalBytes > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ravium ai connect exchanges pairing code with bridge API', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-ai-connect-'));
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : null;
    requests.push({
      method: request.method,
      url: request.url,
      body,
    });

    response.setHeader('content-type', 'application/json');
    if (request.method === 'POST' && request.url === '/api/v1/ai/bridge/connect') {
      response.end(
        JSON.stringify({
          token: 'rvb_test_token',
          session: {
            id: 'session-1',
            projectId: 'project-1',
            workspaceName: body.workspaceName,
            status: 'connected',
            expiresAt: '2026-07-15T12:30:00Z',
          },
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: 'not_found' } }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const result = await runCli(
      [
        'ai',
        'connect',
        'RV-PAIR-CODE',
        '--api-url',
        `http://127.0.0.1:${port}/api/v1`,
        '--workspace-name',
        'local-habit-module',
      ],
      workspace,
    );
    const output = JSON.parse(result.stdout);
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].url, '/api/v1/ai/bridge/connect');
    assert.equal(requests[0].body.pairingCode, 'RV-PAIR-CODE');
    assert.equal(requests[0].body.workspaceName, 'local-habit-module');
    assert.equal(output.status, 'connected');
    assert.equal(output.sessionID, 'session-1');
    assert.equal(output.token, undefined);
    const bridgeConfig = JSON.parse(await readFile(path.join(workspace, '.ravium/ai-bridge.json'), 'utf8'));
    assert.equal(bridgeConfig.token, 'rvb_test_token');
    assert.ok(output.configPath.endsWith('/.ravium/ai-bridge.json'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ravium ai sync applies bridge draft files and marks drafts synced', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-ai-sync-'));
  await writeFile(path.join(workspace, 'package.json'), '{}\n', 'utf8');
  await writeFile(path.join(workspace, 'ravium.module.json'), '{}\n', 'utf8');
  await mkdir(path.join(workspace, '.ravium'), { recursive: true });
  await writeFile(
    path.join(workspace, '.ravium/ai-bridge.json'),
    JSON.stringify({
      apiUrl: '',
      token: 'rvb_test_token',
      sessionID: 'session-1',
      projectID: 'project-1',
      workspaceName: 'local-module',
      expiresAt: '2026-07-15T12:30:00Z',
      updatedAt: '2026-07-15T12:00:00Z',
    }),
    'utf8',
  );
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : null;
    requests.push({
      method: request.method,
      url: request.url,
      body,
    });

    response.setHeader('content-type', 'application/json');
    if (request.method === 'POST' && request.url === '/api/v1/ai/bridge/drafts') {
      response.end(
        JSON.stringify({
          drafts: [
            {
              id: 'draft-1',
              status: 'draft',
              codePatchRequest: {
                files: [{ path: 'src/generated.ts', content: 'export const generated = true;\\n' }],
              },
            },
            {
              id: 'draft-2',
              status: 'synced',
              codePatchRequest: { files: [{ path: 'src/skipped.ts', content: '' }] },
            },
          ],
        }),
      );
      return;
    }
    if (request.method === 'PATCH' && request.url === '/api/v1/ai/bridge/drafts/draft-1') {
      response.end(JSON.stringify({ draft: { id: 'draft-1', status: body.status } }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: 'not_found' } }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const result = await runCli(['ai', 'sync', '--cwd', workspace, '--api-url', `http://127.0.0.1:${port}/api/v1`], workspace);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'synced');
    assert.equal(output.appliedDrafts, 1);
    assert.equal(output.skippedDrafts, 1);
    assert.deepEqual(output.filesWritten, ['src/generated.ts']);
    assert.equal(await readFile(path.join(workspace, 'src/generated.ts'), 'utf8'), 'export const generated = true;\\n');
    assert.equal(requests[0].body.token, 'rvb_test_token');
    assert.equal(requests[1].method, 'PATCH');
    assert.equal(requests[1].body.status, 'synced');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ravium ai sync rejects files outside workspace', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-ai-sync-escape-'));
  await mkdir(path.join(workspace, '.ravium'), { recursive: true });
  await writeFile(
    path.join(workspace, '.ravium/ai-bridge.json'),
    JSON.stringify({ apiUrl: '', token: 'rvb_test_token' }),
    'utf8',
  );
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    requests.push({ method: request.method, url: request.url });
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        drafts: [
          {
            id: 'draft-escape',
            status: 'draft',
            codePatchRequest: { files: [{ path: '../escape.ts', content: 'bad' }] },
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    await assert.rejects(
      runCli(['ai', 'sync', '--cwd', workspace, '--api-url', `http://127.0.0.1:${port}/api/v1`], workspace),
      (error) => error.stderr.includes('escapes workspace'),
    );
    assert.equal(requests.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ravium ai connect requires pairing code and api url', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-ai-connect-required-'));
  await assert.rejects(
    runCli(['ai', 'connect', '--api-url', 'http://127.0.0.1:9/api/v1'], workspace),
    (error) => error.stderr.includes('pairing code is required'),
  );
  await assert.rejects(
    runCli(['ai', 'connect', 'RV-PAIR-CODE'], workspace),
    (error) => error.stderr.includes('--api-url or RAVIUM_API_URL is required'),
  );
});

test('ravium module publish submits version for existing catalog module after create conflict', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ravium-cli-publish-existing-'));
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : null;
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      body,
    });

    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET' && request.url === '/api/v1/modules/developer/modules') {
      response.end(JSON.stringify({ modules: [] }));
      return;
    }
    if (request.method === 'POST' && request.url === '/api/v1/modules/developer/modules') {
      response.statusCode = 409;
      response.end(JSON.stringify({ error: { message: 'module namespace and slug already exist' } }));
      return;
    }
    if (request.method === 'GET' && request.url === '/api/v1/modules/ravium/kitchen-sink-test') {
      response.end(JSON.stringify({ module: { id: 'module-existing', namespace: 'ravium', slug: 'kitchen-sink-test' } }));
      return;
    }
    if (request.method === 'POST' && request.url === '/api/v1/modules/developer/modules/module-existing/versions') {
      response.statusCode = 201;
      response.end(
        JSON.stringify({
          version: { id: 'version-1', moduleId: 'module-existing', version: body.version, status: 'pending_review' },
        }),
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: 'not_found' } }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    await runCli(
      [
        'module',
        'init',
        'kitchen-sink-test',
        '--namespace',
        'ravium',
        '--slug',
        'kitchen-sink-test',
        '--name',
        'Kitchen Sink Test Module',
        '--template',
        'kitchen-sink',
      ],
      workspace,
    );

    const moduleDir = path.join(workspace, 'kitchen-sink-test');
    await runCli(
      [
        'module',
        'publish',
        '--cwd',
        moduleDir,
        '--api-url',
        `http://127.0.0.1:${port}/api/v1`,
        '--token',
        'test-token',
      ],
      workspace,
    );

    assert.equal(requests[1].method, 'POST');
    assert.equal(requests[1].url, '/api/v1/modules/developer/modules');
    assert.equal(requests[2].method, 'GET');
    assert.equal(requests[2].url, '/api/v1/modules/ravium/kitchen-sink-test');
    assert.equal(requests[3].method, 'POST');
    assert.equal(requests[3].url, '/api/v1/modules/developer/modules/module-existing/versions');
    assert.equal(requests[3].body.version, '1.0.0');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
