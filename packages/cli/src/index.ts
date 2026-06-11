import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const requireFromCli = createRequire(import.meta.url);
const execFile = promisify(execFileCallback);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readArrayRecords = (value: unknown): Array<Record<string, unknown>> => {
  return Array.isArray(value) ? value.filter(isRecord) : [];
};

export interface RaviumModuleManifest {
  id: string;
  namespace: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  license: string;
  author: {
    name: string;
    email?: string;
  };
  raviumApiVersion: string;
  sdkVersionRange: string;
  compatibility: Record<string, unknown>;
  tags: string[];
  entrypoints: {
    editor: string;
    runtimeClient: string;
    runtimeServer: string;
    styles?: string;
  };
  extensionPoints: Record<string, unknown>;
  permissions: Record<string, unknown>;
  settingsSchema: Record<string, unknown>;
  components: Array<Record<string, unknown>>;
  variables: Array<Record<string, unknown>>;
  functions: Array<Record<string, unknown>>;
  routes: Array<Record<string, unknown>>;
  middleware?: Array<Record<string, unknown>>;
  composables?: Array<Record<string, unknown>>;
  migrations: Array<Record<string, unknown>>;
  projectTransforms?: Array<Record<string, unknown>>;
  dependencies: Record<string, unknown>;
  moduleDependencies: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  sizeBudget: Record<string, unknown>;
  pricing: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
}

export interface BuildResult {
  artifactRoot: string;
  manifest: RaviumModuleManifest;
  artifactRefs: Record<string, unknown>;
  checksums: Record<string, unknown>;
  sizeReport: Record<string, unknown>;
  dependencyReport: DependencyReport;
}

export interface DevResult {
  artifactRoot: string;
  module: {
    id: string;
    namespace: string;
    slug: string;
    version: string;
  };
  inspect: InspectReport;
  dependencies: DependencyReport;
  migrations: MigrationCheckReport;
  advisory: AdvisoryReport;
  sizeReport: Record<string, unknown>;
}

export interface InitOptions {
  cwd: string;
  directory: string;
  namespace: string;
  slug: string;
  name: string;
  template: 'basic' | 'kitchen-sink' | 'swiper';
}

export interface BuildOptions {
  cwd: string;
  outDir: string;
}

export interface PublishOptions {
  cwd: string;
  outDir: string;
  apiUrl: string;
  token: string;
  dryRun?: boolean;
}

export interface PublishResult {
  moduleID: string;
  versionID: string;
  versionStatus: string;
  artifactRoot: string;
}

interface DeveloperModuleSummary {
  id: string;
  namespace: string;
  slug: string;
}

interface ModuleVersionSummary {
  id: string;
  version: string;
  status: string;
}

export interface InspectReport {
  id: string;
  namespace: string;
  slug: string;
  name: string;
  version: string;
  raviumApiVersion: string;
  sdkVersionRange: string;
  referencedFiles: string[];
  extensionPoints: Record<string, number>;
  components: number;
  functions: number;
  routes: number;
  variables: number;
  migrations: number;
}

export interface DependencyReport {
  dependencies?: Array<{
    namespace: string;
    slug: string;
    version: string;
    required: boolean;
    reason?: string;
    contract?: string;
  }>;
  npm?: Record<string, unknown>;
  moduleDependencies: Array<{
    namespace: string;
    slug: string;
    versionRange: string;
    required: boolean;
    reason?: string;
    contract?: string;
  }>;
  npmDependencies: Record<string, unknown>;
  installOrder: string[];
  dependencyGraph: {
    module: {
      namespace: string;
      slug: string;
      version: string;
    };
    dependencies: Array<{
      id: string;
      namespace: string;
      slug: string;
      versionRange: string;
      required: boolean;
      reason?: string;
      contract?: string;
    }>;
    cycles: string[];
  };
  packages: Array<{
    name: string;
    version: string;
    license?: string;
    resolved?: string;
    hasInstallScript?: boolean;
  }>;
  vulnerabilities: Array<{
    package: string;
    severity: 'info' | 'warning' | 'high' | 'critical';
    title: string;
    range?: string;
    via?: string[];
    fixAvailable?: boolean;
  }>;
  warnings: Array<{
    code: string;
    severity: 'info' | 'warning' | 'high' | 'critical';
    message: string;
    package?: string;
    path?: string;
  }>;
}

export interface MigrationCheckReport {
  migrations: Array<{
    id: string;
    engine: string;
    file: string;
    rollbackFile?: string;
    rollback: boolean;
  }>;
  rollbackSupported: number;
  destructiveWarnings: Array<{
    migration: string;
    message: string;
  }>;
}

export interface AdvisoryReport {
  warnings: Array<{
    code: string;
    severity: 'info' | 'warning' | 'high' | 'critical';
    message: string;
    package?: string;
    path?: string;
  }>;
}

const requiredManifestFields: Array<keyof RaviumModuleManifest> = [
  'id',
  'namespace',
  'slug',
  'name',
  'description',
  'version',
  'license',
  'author',
  'raviumApiVersion',
  'sdkVersionRange',
  'compatibility',
  'tags',
  'entrypoints',
  'extensionPoints',
  'permissions',
  'settingsSchema',
  'components',
  'variables',
  'functions',
  'routes',
  'migrations',
  'dependencies',
  'moduleDependencies',
  'assets',
  'sizeBudget',
  'pricing',
];

export const initModule = async (options: InitOptions): Promise<string> => {
  const moduleDir = path.resolve(options.cwd, options.directory);
  const manifest = createManifest(options);
  const eventsTableName = moduleScopedTableName(manifest.slug, 'events');

  await mkdir(path.join(moduleDir, 'src/components'), { recursive: true });
  await mkdir(path.join(moduleDir, 'src/commands'), { recursive: true });
  await mkdir(path.join(moduleDir, 'src/functions'), { recursive: true });
  await mkdir(path.join(moduleDir, 'src/routes'), { recursive: true });
  await mkdir(path.join(moduleDir, 'migrations'), { recursive: true });
  await mkdir(path.join(moduleDir, 'assets'), { recursive: true });

  await writeJSON(path.join(moduleDir, 'package.json'), modulePackageJson(manifest));
  await writeJSON(path.join(moduleDir, 'tsconfig.json'), moduleTsconfig());
  await writeFile(path.join(moduleDir, 'ravium.module.mjs'), moduleFrameworkSource(manifest), 'utf8');
  await writeJSON(path.join(moduleDir, 'ravium.module.json'), manifest);
  await writeJSON(path.join(moduleDir, 'ravium.module-lock.json'), await buildDependencyReport(moduleDir, manifest));
  await writeFile(path.join(moduleDir, 'README.md'), readmeFor(manifest, options.template), 'utf8');
  await writeFile(
    path.join(moduleDir, 'CHANGELOG.md'),
    `# Changelog\n\n## ${manifest.version}\n\n- Initial module.\n`,
    'utf8',
  );
  await writeFile(path.join(moduleDir, 'src/editor.ts'), editorSource(options.template), 'utf8');
  if (options.template !== 'swiper') {
    await writeFile(path.join(moduleDir, 'src/editor-dashboard.html'), editorDashboardSource(), 'utf8');
    await writeFile(path.join(moduleDir, 'src/project-settings.html'), projectSettingsSource(), 'utf8');
  }
  await writeFile(path.join(moduleDir, 'src/runtime-client.ts'), runtimeClientSource(options.template), 'utf8');
  await writeFile(path.join(moduleDir, 'src/runtime-server.ts'), runtimeServerSource(options.template), 'utf8');
  await writeFile(path.join(moduleDir, 'src/styles.css'), stylesSource(options.template, manifest.slug), 'utf8');

  if (options.template === 'swiper') {
    await writeFile(path.join(moduleDir, 'src/components/SwiperCarousel.vue'), swiperCarouselSource(), 'utf8');
    await writeFile(path.join(moduleDir, 'src/editor-renderer.html'), swiperEditorRendererSource(), 'utf8');
  } else {
    await writeFile(path.join(moduleDir, 'src/components/MetricCard.vue'), metricCardSource(), 'utf8');
    await writeFile(path.join(moduleDir, 'src/components/LeadForm.vue'), leadFormSource(), 'utf8');
    await writeFile(path.join(moduleDir, 'src/commands/insert-card.js'), insertCardCommandSource(), 'utf8');
    await writeFile(path.join(moduleDir, 'src/functions/send-event.ts'), sendEventSource(), 'utf8');
    await writeFile(path.join(moduleDir, 'src/routes/kitchen-sink-page.vue'), routePageSource(), 'utf8');
    await writeFile(path.join(moduleDir, 'src/routes/events.post.ts'), routePostSource(), 'utf8');
    await writeFile(
      path.join(moduleDir, 'migrations/202605300001_create_kitchen_sink_events.sql'),
      `CREATE TABLE IF NOT EXISTS ${eventsTableName} (id UUID PRIMARY KEY, project_id UUID NOT NULL, event_name TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL);\n`,
      'utf8',
    );
    await writeFile(
      path.join(moduleDir, 'assets/placeholder.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" rx="8" fill="#f4f4f5"/><path d="M74 124h172M94 96h132M114 68h92" stroke="#71717a" stroke-width="8" stroke-linecap="round"/></svg>\n',
      'utf8',
    );
  }

  return moduleDir;
};

const frameworkManifestFiles = ['ravium.module.mjs', 'ravium.module.js', 'ravium.module.cjs'];

const configFileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const isManifestPayload = (value: unknown): value is RaviumModuleManifest => {
  return isRecord(value) && typeof value.namespace === 'string' && typeof value.slug === 'string';
};

const normalizeFrameworkExport = async (value: unknown): Promise<RaviumModuleManifest | null> => {
  if (isRecord(value) && typeof value.toManifest === 'function') {
    const manifest = await value.toManifest();
    return isManifestPayload(manifest) ? manifest : null;
  }
  if (isRecord(value) && isManifestPayload(value.manifest)) {
    return value.manifest;
  }
  return isManifestPayload(value) ? value : null;
};

const loadFrameworkManifest = async (cwd: string): Promise<RaviumModuleManifest | null> => {
  for (const fileName of frameworkManifestFiles) {
    const configPath = path.resolve(cwd, fileName);
    if (!(await configFileExists(configPath))) {
      continue;
    }
    const configUrl = pathToFileURL(configPath);
    configUrl.searchParams.set('raviumConfigLoad', String(Date.now()));
    const imported = (await import(configUrl.href)) as { default?: unknown; manifest?: unknown };
    const manifest =
      (await normalizeFrameworkExport(imported.default)) ||
      (await normalizeFrameworkExport(imported.manifest)) ||
      (await normalizeFrameworkExport(imported));
    if (!manifest) {
      throw new Error(`${fileName} must export a Ravium manifest or defineRaviumModule(...) result`);
    }
    return manifest;
  }
  return null;
};

export const loadManifest = async (cwd: string): Promise<RaviumModuleManifest> => {
  const frameworkManifest = await loadFrameworkManifest(cwd);
  if (frameworkManifest) {
    validateManifestShape(frameworkManifest);
    return frameworkManifest;
  }

  const manifestPath = path.resolve(cwd, 'ravium.module.json');
  const payload = JSON.parse(await readFile(manifestPath, 'utf8')) as RaviumModuleManifest;
  validateManifestShape(payload);
  return payload;
};

export const validateModule = async (cwd: string): Promise<RaviumModuleManifest> => {
  const manifest = await loadManifest(cwd);
  const referencedFiles = collectReferencedFiles(manifest);
  for (const file of referencedFiles) {
    await assertFileExists(path.resolve(cwd, file), file);
  }
  await assertMigrationsScopedToModule(cwd, manifest);
  return manifest;
};

export const buildModule = async (options: BuildOptions): Promise<BuildResult> => {
  const cwd = path.resolve(options.cwd);
  const manifest = await validateModule(cwd);
  const artifactRoot = path.resolve(options.outDir, manifest.namespace, manifest.slug, manifest.version);
  await mkdir(artifactRoot, { recursive: true });

  const filesToCopy = collectReferencedFiles(manifest);
  const copiedFiles: string[] = [];
  for (const file of filesToCopy) {
    const targetFile = artifactFileName(file);
    await copyFile(path.resolve(cwd, file), path.join(artifactRoot, targetFile));
    copiedFiles.push(targetFile);
  }

  const sizeReport = await buildSizeReport(cwd, artifactRoot, copiedFiles, manifest.dependencies);
  const dependencyReport = await buildDependencyReport(cwd, manifest);
  const checksums = await buildChecksums(artifactRoot, copiedFiles);
  const artifactRefs = await buildArtifactRefs(cwd, manifest, copiedFiles);
  const moderationInput = {
    manifest,
    checksums,
    sizeReport,
    dependencyReport,
    generatedAt: new Date().toISOString(),
  };

  await writeJSON(path.join(artifactRoot, 'manifest.json'), manifest);
  await writeJSON(path.join(artifactRoot, 'artifact-refs.json'), artifactRefs);
  await writeJSON(path.join(artifactRoot, 'checksums.json'), checksums);
  await writeJSON(path.join(artifactRoot, 'dependency-lock.json'), dependencyReport);
  await writeJSON(path.join(artifactRoot, 'size-report.json'), sizeReport);
  await writeJSON(path.join(artifactRoot, 'moderation-input.json'), moderationInput);

  return {
    artifactRoot,
    manifest,
    artifactRefs,
    checksums,
    sizeReport,
    dependencyReport,
  };
};

export const devModule = async (options: BuildOptions): Promise<DevResult> => {
  const build = await buildModule(options);
  const [inspect, dependencies, migrations, advisory] = await Promise.all([
    inspectModule(options.cwd),
    inspectDependencies(options.cwd),
    checkMigrations(options.cwd),
    inspectAdvisory(options.cwd),
  ]);

  return {
    artifactRoot: build.artifactRoot,
    module: {
      id: build.manifest.id,
      namespace: build.manifest.namespace,
      slug: build.manifest.slug,
      version: build.manifest.version,
    },
    inspect,
    dependencies,
    migrations,
    advisory,
    sizeReport: build.sizeReport,
  };
};

export const publishModule = async (options: PublishOptions): Promise<PublishResult> => {
  const build = await buildModule({
    cwd: options.cwd,
    outDir: options.outDir,
  });
  const changelog = await readVersionChangelog(options.cwd, build.manifest.version);

  if (options.dryRun) {
    return {
      moduleID: 'dry-run',
      versionID: 'dry-run',
      versionStatus: 'dry-run',
      artifactRoot: build.artifactRoot,
    };
  }

  const apiUrl = options.apiUrl.replace(/\/+$/, '');
  if (!apiUrl) {
    throw new Error('--api-url is required');
  }
  if (!options.token.trim()) {
    throw new Error('--token or RAVIUM_ACCESS_TOKEN is required');
  }

  const headers = {
    authorization: `Bearer ${options.token}`,
  };
  const developerModules = await apiRequest<{ modules: DeveloperModuleSummary[] }>({
    method: 'GET',
    url: `${apiUrl}/modules/developer/modules`,
    headers,
  });
  const existingModule = developerModules.modules.find(
    (module) => module.namespace === build.manifest.namespace && module.slug === build.manifest.slug,
  );
  if (existingModule) {
    await assertVersionNotSubmitted({
      apiUrl,
      headers,
      namespace: build.manifest.namespace,
      slug: build.manifest.slug,
      version: build.manifest.version,
    });
  }

  const moduleID =
    existingModule?.id ||
    (
      await apiRequest<{ module: { id: string } }>({
        method: 'POST',
        url: `${apiUrl}/modules/developer/modules`,
        headers,
        body: {
          namespace: build.manifest.namespace,
          slug: build.manifest.slug,
          name: build.manifest.name,
          description: build.manifest.description,
          tags: build.manifest.tags,
        },
      })
    ).module.id;

  const versionResponse = await apiRequest<{ version: { id: string; status: string } }>({
    method: 'POST',
    url: `${apiUrl}/modules/developer/modules/${encodeURIComponent(moduleID)}/versions`,
    headers,
    body: {
      version: build.manifest.version,
      releaseChannel: 'stable',
      changelog,
      compatibility: build.manifest.compatibility,
      manifest: build.manifest,
      artifactRefs: build.artifactRefs,
      checksums: build.checksums,
      signature: '',
      permissions: build.manifest.permissions,
      dependencyReport: build.dependencyReport,
      sizeReport: build.sizeReport,
    },
  });

  return {
    moduleID,
    versionID: versionResponse.version.id,
    versionStatus: versionResponse.version.status,
    artifactRoot: build.artifactRoot,
  };
};

export const inspectModule = async (cwd: string): Promise<InspectReport> => {
  const manifest = await validateModule(cwd);
  return {
    id: manifest.id,
    namespace: manifest.namespace,
    slug: manifest.slug,
    name: manifest.name,
    version: manifest.version,
    raviumApiVersion: manifest.raviumApiVersion,
    sdkVersionRange: manifest.sdkVersionRange,
    referencedFiles: collectReferencedFiles(manifest),
    extensionPoints: countExtensionPoints(manifest.extensionPoints),
    components: manifest.components.length,
    functions: manifest.functions.length,
    routes: manifest.routes.length,
    variables: manifest.variables.length,
    migrations: manifest.migrations.length,
  };
};

export const inspectDependencies = async (cwd: string): Promise<DependencyReport> => {
  const manifest = await validateModule(cwd);
  return await buildDependencyReport(cwd, manifest);
};

export const checkMigrations = async (cwd: string): Promise<MigrationCheckReport> => {
  const manifest = await validateModule(cwd);
  const migrations = normalizeMigrations(manifest);
  const destructiveWarnings: MigrationCheckReport['destructiveWarnings'] = [];

  for (const migration of migrations) {
    const sql = await readFile(path.resolve(cwd, migration.file), 'utf8');
    if (/\bDROP\b|\bTRUNCATE\b|\bALTER\s+TABLE\b[\s\S]*\bDROP\b/i.test(sql)) {
      destructiveWarnings.push({
        migration: migration.id,
        message: 'Migration contains destructive SQL and requires manual reviewer attention.',
      });
    }
  }

  return {
    migrations,
    rollbackSupported: migrations.filter((migration) => migration.rollback).length,
    destructiveWarnings,
  };
};

export const inspectAdvisory = async (cwd: string): Promise<AdvisoryReport> => {
  const manifest = await validateModule(cwd);
  const moduleDependencies = normalizeModuleDependencies(manifest);
  const warnings: AdvisoryReport['warnings'] = [];
  const permissions = manifest.permissions as Record<string, unknown>;
  const network = permissions.network as { allow?: unknown } | undefined;
  const pricing = manifest.pricing as { kind?: unknown };

  if (Array.isArray(network?.allow) && network.allow.length > 0) {
    warnings.push({
      code: 'network-permission',
      severity: 'high',
      message: 'Module requests outbound network access; reviewer must verify destination scope.',
    });
    if (network.allow.some((entry) => typeof entry === 'string' && (entry === '*' || entry.includes('*')))) {
      warnings.push({
        code: 'network-wildcard',
        severity: 'high',
        message: 'Network allowlist contains wildcard entries; reviewer must verify this is strictly required.',
      });
    }
  }
  for (const dependency of moduleDependencies) {
    if (!dependency.required) {
      warnings.push({
        code: 'optional-module-dependency',
        severity: 'info',
        message: `Optional dependency ${dependency.namespace}/${dependency.slug} changes available features when installed.`,
      });
    }
    if (dependency.required && !dependency.reason?.trim()) {
      warnings.push({
        code: 'module-dependency-missing-reason',
        severity: 'warning',
        message: `Dependency ${dependency.namespace}/${dependency.slug} should document why it is needed.`,
      });
    }
  }
  for (const warning of buildDependencyWarnings(manifest, moduleDependencies)) {
    warnings.push(warning);
  }
  for (const warning of buildSecretDefaultWarnings(manifest)) {
    warnings.push(warning);
  }
  if (pricing.kind && pricing.kind !== 'free') {
    warnings.push({
      code: 'paid-disabled-v1',
      severity: 'warning',
      message: 'Paid module metadata is accepted but billing is disabled in v1.',
    });
  }

  return { warnings };
};

interface NpmDependencySize {
  name: string;
  version: string;
  bytes: number;
  resolved: boolean;
}

const readDependencyGroup = (group: unknown): Array<{ name: string; version: string }> => {
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    return [];
  }

  return Object.entries(group).flatMap(([name, version]) => {
    if (typeof version !== 'string') {
      return [];
    }
    return [{ name, version }];
  });
};

const collectNpmDependencies = (dependencies: Record<string, unknown>): Array<{ name: string; version: string }> => {
  const deduped = new Map<string, string>();
  for (const group of Object.values(dependencies || {})) {
    for (const dependency of readDependencyGroup(group)) {
      deduped.set(dependency.name, dependency.version);
    }
  }
  return [...deduped.entries()].map(([name, version]) => ({ name, version }));
};

const directorySize = async (directory: string): Promise<number> => {
  let totalBytes = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      totalBytes += await directorySize(entryPath);
      continue;
    }
    if (entry.isFile()) {
      totalBytes += (await stat(entryPath)).size;
    }
  }
  return totalBytes;
};

const estimateNpmDependencySizes = async (
  cwd: string,
  dependencies: Record<string, unknown>,
): Promise<NpmDependencySize[]> => {
  const entries = collectNpmDependencies(dependencies);
  const sizes: NpmDependencySize[] = [];

  for (const dependency of entries) {
    try {
      const packageJson = requireFromCli.resolve(`${dependency.name}/package.json`, { paths: [cwd] });
      sizes.push({
        ...dependency,
        bytes: await directorySize(path.dirname(packageJson)),
        resolved: true,
      });
    } catch {
      sizes.push({
        ...dependency,
        bytes: 0,
        resolved: false,
      });
    }
  }

  return sizes;
};

export const buildSizeReport = async (
  cwd: string,
  artifactRoot: string,
  files: string[],
  dependencies: Record<string, unknown> = {},
): Promise<Record<string, unknown>> => {
  const sizes: Record<string, number> = {};
  const gzipSizes: Record<string, number> = {};
  const brotliSizes: Record<string, number> = {};
  let totalBytes = 0;
  let totalGzipBytes = 0;
  let totalBrotliBytes = 0;
  for (const file of files) {
    const buffer = await readFile(path.join(artifactRoot, file));
    const rawBytes = buffer.byteLength;
    const gzipBytes = gzipSync(buffer).byteLength;
    const brotliBytes = brotliCompressSync(buffer).byteLength;
    sizes[file] = rawBytes;
    gzipSizes[file] = gzipBytes;
    brotliSizes[file] = brotliBytes;
    totalBytes += rawBytes;
    totalGzipBytes += gzipBytes;
    totalBrotliBytes += brotliBytes;
  }
  const npmDependencies = await estimateNpmDependencySizes(cwd, dependencies);
  const npmDependencyBytes = npmDependencies.reduce((sum, dependency) => sum + dependency.bytes, 0);

  return {
    totalBytes,
    totalGzipBytes,
    totalBrotliBytes,
    files: sizes,
    gzipFiles: gzipSizes,
    brotliFiles: brotliSizes,
    ownEditorBundleRawBytes: sizes['editor.js'] || 0,
    ownEditorBundleGzipBytes: gzipSizes['editor.js'] || 0,
    ownEditorBundleBrotliBytes: brotliSizes['editor.js'] || 0,
    ownRuntimeClientRawBytes: sizes['runtime-client.js'] || 0,
    ownRuntimeClientGzipBytes: gzipSizes['runtime-client.js'] || 0,
    ownRuntimeClientBrotliBytes: brotliSizes['runtime-client.js'] || 0,
    ownRuntimeServerBytes: sizes['runtime-server.js'] || 0,
    ownRuntimeServerGzipBytes: gzipSizes['runtime-server.js'] || 0,
    ownRuntimeServerBrotliBytes: brotliSizes['runtime-server.js'] || 0,
    npmDependencyBytes,
    npmDependencies,
    unresolvedNpmDependencies: npmDependencies
      .filter((dependency) => !dependency.resolved)
      .map((dependency) => dependency.name),
    assetBytes: Object.entries(sizes)
      .filter(([file]) => file.startsWith('asset-'))
      .reduce((sum, [, bytes]) => sum + bytes, 0),
    generatedAppDeltaBytes: totalBytes + npmDependencyBytes,
    largestFiles: Object.entries(sizes)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([file, bytes]) => ({ path: file, bytes })),
  };
};

const createManifest = (options: InitOptions): RaviumModuleManifest => {
  if (options.template === 'swiper') {
    return createSwiperManifest(options);
  }

  const base = {
    id: `${options.namespace}.${options.slug}`,
    namespace: options.namespace,
    slug: options.slug,
    name: options.name,
    description: 'Development module exercising every v1 Ravium module capability.',
    version: '1.0.0',
    license: 'MIT',
    author: { name: 'Ravium Developer' },
    raviumApiVersion: '^1.0.0',
    sdkVersionRange: '^1.0.0',
    compatibility: {
      minRaviumVersion: '1.0.0',
      maxRaviumVersion: '1.x',
      generatedAppRuntime: 'nuxt-postgres',
    },
    tags: ['test', 'components', 'functions', 'variables', 'routes', 'migrations'],
    entrypoints: {
      editor: 'src/editor.ts',
      runtimeClient: 'src/runtime-client.ts',
      runtimeServer: 'src/runtime-server.ts',
      styles: 'src/styles.css',
    },
    extensionPoints: {
      leftMenu: [{ id: 'kitchen-sink.section', label: 'Kitchen Sink', icon: 'Package' }],
      editorTabs: [
        {
          id: 'kitchen-sink.dashboard',
          label: 'Module Dashboard',
          icon: 'PanelTop',
          entrypoint: 'src/editor-dashboard.html',
        },
      ],
      canvasPalette: [
        {
          id: 'kitchen-sink.metric-card',
          label: 'Metric Card',
          icon: 'BarChart3',
          componentType: 'kitchen-sink.metric-card',
        },
        {
          id: 'kitchen-sink.lead-form',
          label: 'Lead Form',
          icon: 'ClipboardList',
          componentType: 'kitchen-sink.lead-form',
        },
      ],
      rightMenuSections: [
        {
          id: 'kitchen-sink.metric-settings',
          label: 'Metric settings',
          targetComponentTypes: ['kitchen-sink.metric-card'],
        },
      ],
      projectSettingsPages: [
        {
          id: 'kitchen-sink.project-settings',
          label: 'Kitchen Sink Settings',
          icon: 'Settings',
          entrypoint: 'src/project-settings.html',
        },
      ],
      functionNodes: [{ id: 'kitchen-sink.send-event', label: 'Send Analytics Event', icon: 'Radio' }],
      commands: [
        {
          id: 'kitchen-sink.insert-card',
          label: 'Insert metric card',
          icon: 'SquarePlus',
          handler: 'src/commands/insert-card.js',
          targetComponentType: 'kitchen-sink.metric-card',
        },
        {
          id: 'kitchen-sink.open-dashboard',
          label: 'Open module dashboard',
          icon: 'LayoutDashboard',
          targetEditorTabId: 'kitchen-sink.dashboard',
        },
      ],
    },
    permissions: {
      summary: [
        'editor.panels',
        'editor.palette',
        'editor.rightMenu',
        'editor.commands',
        'settings.project',
        'settings.component',
        'functions.runtime',
        'variables.public',
        'variables.server',
        'variables.encrypted',
        'storage.project',
        'secrets.read',
        'network.fetch',
        'generated.routes',
        'generated.serverRoutes',
        'migrations.postgres',
        'assets.read',
        'npm.dependencies',
      ],
      network: { allow: ['https://api.example-telemetry.test/*'], methods: ['GET', 'POST'] },
      storage: { scope: 'project', collections: ['events', 'settings', 'cache'] },
      secrets: [{ key: 'TELEMETRY_API_KEY', required: false }],
      variables: ['public', 'server', 'encrypted'],
      generatedRoutes: true,
      migrations: true,
      npmDependencies: true,
    },
    settingsSchema: {
      project: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', default: true },
          endpoint: { type: 'string', format: 'uri' },
          sampleRate: { type: 'number', minimum: 0, maximum: 1, default: 1 },
          mode: { type: 'string', enum: ['silent', 'debug', 'production'], default: 'debug' },
        },
      },
      metricCard: {
        type: 'object',
        properties: {
          title: { type: 'string', default: 'Metric' },
          value: { type: 'string', default: '42' },
          tone: { type: 'string', enum: ['neutral', 'success', 'warning', 'danger'], default: 'neutral' },
        },
      },
    },
    components: [
      {
        type: 'kitchen-sink.metric-card',
        label: 'Metric Card',
        category: 'Data',
        runtimeRenderer: 'src/components/MetricCard.vue',
        propsSchema: { $ref: '#/settingsSchema/metricCard' },
      },
      {
        type: 'kitchen-sink.lead-form',
        label: 'Lead Form',
        category: 'Forms',
        runtimeRenderer: 'src/components/LeadForm.vue',
        serverAction: 'routes.leads.create',
      },
    ],
    variables: [
      { key: 'kitchenSinkPublicCounter', mode: 'public', type: 'number', default: 0 },
      { key: 'kitchenSinkServerState', mode: 'server', type: 'object', default: {} },
      { key: 'kitchenSinkEncryptedToken', mode: 'encrypted', type: 'string' },
    ],
    functions: [
      {
        id: 'kitchen-sink.send-event',
        inputs: [{ name: 'eventName', type: 'string', required: true }],
        outputs: [{ name: 'ok', type: 'boolean' }],
        runtimeHandler: 'src/functions/send-event.ts',
      },
    ],
    routes: [
      { kind: 'page', path: '/kitchen-sink', entrypoint: 'src/routes/kitchen-sink-page.vue' },
      { kind: 'server', method: 'POST', path: '/api/kitchen-sink/events', entrypoint: 'src/routes/events.post.ts' },
    ],
    migrations: [
      {
        id: '202605300001_create_kitchen_sink_events',
        engine: 'postgres',
        file: 'migrations/202605300001_create_kitchen_sink_events.sql',
        rollback: true,
      },
    ],
    dependencies: { runtime: { zod: '^3.25.0', 'date-fns': '^4.1.0' }, editor: { 'lucide-vue-next': '^0.468.0' } },
    moduleDependencies: [
      {
        namespace: 'ravium',
        slug: 'forms-runtime',
        versionRange: '^1.0.0',
        required: false,
        reason: 'Enables richer lead form runtime integration when installed.',
        contract: 'forms-runtime:v1',
      },
    ],
    assets: [{ path: 'assets/placeholder.svg', type: 'image/svg+xml', usage: 'component-empty-state' }],
    sizeBudget: { editorBundleGzipBytes: 50000, runtimeClientGzipBytes: 45000, runtimeServerBytes: 80000 },
    pricing: { kind: 'free' },
  } satisfies RaviumModuleManifest;

  return base;
};

const createSwiperManifest = (options: InitOptions): RaviumModuleManifest => ({
  id: `${options.namespace}.${options.slug}`,
  namespace: options.namespace,
  slug: options.slug,
  name: options.name,
  description: 'Swiper.js carousel component for Ravium applications.',
  version: '1.0.0',
  license: 'MIT',
  author: { name: 'Ravium Developer' },
  raviumApiVersion: '^1.0.0',
  sdkVersionRange: '^1.0.0',
  compatibility: {
    minRaviumVersion: '1.0.0',
    maxRaviumVersion: '1.x',
    generatedAppRuntime: 'nuxt-postgres',
  },
  tags: ['slider', 'carousel', 'swiper', 'components'],
  entrypoints: {
    editor: 'src/editor.ts',
    runtimeClient: 'src/runtime-client.ts',
    runtimeServer: 'src/runtime-server.ts',
    styles: 'src/styles.css',
  },
  extensionPoints: {
    canvasPalette: [
      {
        id: 'swiper.carousel',
        label: 'Swiper Carousel',
        icon: 'GalleryHorizontal',
        componentType: 'swiper.carousel',
      },
    ],
    rightMenuSections: [
      {
        id: 'swiper.carousel.settings',
        label: 'Swiper carousel',
        targetComponentTypes: ['swiper.carousel'],
      },
    ],
    projectSettingsPages: [
      {
        id: 'swiper.project-settings',
        label: 'Swiper',
        icon: 'Settings',
      },
    ],
  },
  permissions: {
    summary: [
      'editor.palette',
      'editor.rightMenu',
      'settings.project',
      'settings.component',
      'variables.public',
      'assets.read',
      'npm.dependencies',
    ],
    assets: { read: true },
    settings: { project: true, component: true },
    npmDependencies: true,
  },
  settingsSchema: {
    project: {
      type: 'object',
      properties: {
        paginationEnabled: {
          type: 'boolean',
          title: 'Enable pagination',
          default: true,
        },
        paginationType: {
          type: 'string',
          title: 'Pagination type',
          enum: ['bullets', 'fraction', 'progressbar'],
          default: 'bullets',
        },
        paginationClickable: {
          type: 'boolean',
          title: 'Clickable pagination',
          default: true,
        },
        styleMode: {
          type: 'string',
          title: 'Styles',
          enum: ['swiper', 'ravium'],
          default: 'swiper',
          description: 'swiper uses bundled Swiper styles, ravium uses neutral Ravium defaults.',
        },
      },
    },
    carousel: {
      type: 'object',
      properties: {
        autoplayDelayMs: {
          type: 'number',
          title: 'Autoscroll delay',
          minimum: 0,
          maximum: 60000,
          default: 3000,
        },
        autoplayDisableOnInteraction: {
          type: 'boolean',
          title: 'Autoplay disable on interaction',
          default: false,
          'x-raviumDependsOn': { property: 'autoplayDelayMs', value: '0', operator: 'notEquals' },
        },
        autoplayPauseOnMouseEnter: {
          type: 'boolean',
          title: 'Autoplay pause on hover',
          default: true,
          'x-raviumDependsOn': { property: 'autoplayDelayMs', value: '0', operator: 'notEquals' },
        },
        autoplayReverseDirection: {
          type: 'boolean',
          title: 'Autoplay reverse direction',
          default: false,
          'x-raviumDependsOn': { property: 'autoplayDelayMs', value: '0', operator: 'notEquals' },
        },
        autoplayStopOnLastSlide: {
          type: 'boolean',
          title: 'Autoplay stop on last slide',
          default: false,
          'x-raviumDependsOn': { property: 'autoplayDelayMs', value: '0', operator: 'notEquals' },
        },
        slidesPerView: {
          type: 'number',
          title: 'Cards per view',
          minimum: 1,
          maximum: 8,
          default: 1,
        },
        slidesPerGroup: {
          type: 'number',
          title: 'Cards per scroll',
          minimum: 1,
          maximum: 8,
          default: 1,
        },
        direction: {
          type: 'string',
          title: 'Direction',
          enum: ['horizontal', 'vertical'],
          default: 'horizontal',
        },
        navigationEnabled: {
          type: 'boolean',
          title: 'Navigation arrows',
          default: false,
        },
        navigationHideOnClick: {
          type: 'boolean',
          title: 'Hide navigation on click',
          default: false,
          'x-raviumDependsOn': { property: 'navigationEnabled', value: 'true' },
        },
        scrollbarEnabled: {
          type: 'boolean',
          title: 'Scrollbar',
          default: false,
        },
        scrollbarDraggable: {
          type: 'boolean',
          title: 'Scrollbar draggable',
          default: true,
          'x-raviumDependsOn': { property: 'scrollbarEnabled', value: 'true' },
        },
        scrollbarHide: {
          type: 'boolean',
          title: 'Scrollbar auto hide',
          default: false,
          'x-raviumDependsOn': { property: 'scrollbarEnabled', value: 'true' },
        },
        scrollbarSnapOnRelease: {
          type: 'boolean',
          title: 'Scrollbar snap on release',
          default: true,
          'x-raviumDependsOn': { property: 'scrollbarEnabled', value: 'true' },
        },
        loopEnabled: {
          type: 'boolean',
          title: 'Loop',
          default: true,
        },
        rewindEnabled: {
          type: 'boolean',
          title: 'Rewind',
          default: false,
        },
        centeredSlides: {
          type: 'boolean',
          title: 'Centered slides',
          default: false,
        },
        freeModeEnabled: {
          type: 'boolean',
          title: 'Free mode',
          default: false,
        },
        freeModeMomentum: {
          type: 'boolean',
          title: 'Free mode momentum',
          default: true,
          'x-raviumDependsOn': { property: 'freeModeEnabled', value: 'true' },
        },
        freeModeMomentumRatio: {
          type: 'number',
          title: 'Free mode momentum ratio',
          minimum: 0,
          maximum: 5,
          default: 1,
          'x-raviumDependsOn': { property: 'freeModeEnabled', value: 'true' },
        },
        freeModeSticky: {
          type: 'boolean',
          title: 'Free mode sticky',
          default: false,
          'x-raviumDependsOn': { property: 'freeModeEnabled', value: 'true' },
        },
        mousewheelEnabled: {
          type: 'boolean',
          title: 'Mousewheel',
          default: false,
        },
        mousewheelForceToAxis: {
          type: 'boolean',
          title: 'Mousewheel force to axis',
          default: false,
          'x-raviumDependsOn': { property: 'mousewheelEnabled', value: 'true' },
        },
        mousewheelInvert: {
          type: 'boolean',
          title: 'Mousewheel invert',
          default: false,
          'x-raviumDependsOn': { property: 'mousewheelEnabled', value: 'true' },
        },
        mousewheelSensitivity: {
          type: 'number',
          title: 'Mousewheel sensitivity',
          minimum: 0.1,
          maximum: 10,
          default: 1,
          'x-raviumDependsOn': { property: 'mousewheelEnabled', value: 'true' },
        },
        keyboardEnabled: {
          type: 'boolean',
          title: 'Keyboard',
          default: false,
        },
        keyboardOnlyInViewport: {
          type: 'boolean',
          title: 'Keyboard only in viewport',
          default: true,
          'x-raviumDependsOn': { property: 'keyboardEnabled', value: 'true' },
        },
        keyboardPageUpDown: {
          type: 'boolean',
          title: 'Keyboard PageUp/PageDown',
          default: true,
          'x-raviumDependsOn': { property: 'keyboardEnabled', value: 'true' },
        },
        a11yEnabled: {
          type: 'boolean',
          title: 'Accessibility',
          default: true,
        },
        zoomEnabled: {
          type: 'boolean',
          title: 'Zoom',
          default: false,
        },
        zoomMaxRatio: {
          type: 'number',
          title: 'Zoom max ratio',
          minimum: 1,
          maximum: 10,
          default: 3,
          'x-raviumDependsOn': { property: 'zoomEnabled', value: 'true' },
        },
        zoomMinRatio: {
          type: 'number',
          title: 'Zoom min ratio',
          minimum: 1,
          maximum: 10,
          default: 1,
          'x-raviumDependsOn': { property: 'zoomEnabled', value: 'true' },
        },
        zoomToggle: {
          type: 'boolean',
          title: 'Zoom double tap toggle',
          default: true,
          'x-raviumDependsOn': { property: 'zoomEnabled', value: 'true' },
        },
        virtualEnabled: {
          type: 'boolean',
          title: 'Virtual slides',
          default: false,
        },
        parallaxEnabled: {
          type: 'boolean',
          title: 'Parallax',
          default: false,
        },
        parallaxOffset: {
          type: 'string',
          title: 'Parallax offset',
          default: '-18%',
        },
        hashNavigationEnabled: {
          type: 'boolean',
          title: 'Hash navigation',
          default: false,
        },
        hashNavigationWatchState: {
          type: 'boolean',
          title: 'Hash watch state',
          default: true,
          'x-raviumDependsOn': { property: 'hashNavigationEnabled', value: 'true' },
        },
        hashNavigationReplaceState: {
          type: 'boolean',
          title: 'Hash replace state',
          default: false,
          'x-raviumDependsOn': { property: 'hashNavigationEnabled', value: 'true' },
        },
        historyEnabled: {
          type: 'boolean',
          title: 'History navigation',
          default: false,
        },
        historyKey: {
          type: 'string',
          title: 'History key',
          default: 'slides',
          'x-raviumDependsOn': { property: 'historyEnabled', value: 'true' },
        },
        historyReplaceState: {
          type: 'boolean',
          title: 'History replace state',
          default: false,
          'x-raviumDependsOn': { property: 'historyEnabled', value: 'true' },
        },
        historyKeepQuery: {
          type: 'boolean',
          title: 'History keep query',
          default: false,
          'x-raviumDependsOn': { property: 'historyEnabled', value: 'true' },
        },
        effect: {
          type: 'string',
          title: 'Effect',
          enum: ['slide', 'fade', 'cube', 'coverflow', 'flip', 'cards', 'creative'],
          default: 'slide',
        },
        effectRotate: {
          type: 'number',
          title: 'Effect rotate',
          minimum: 0,
          maximum: 360,
          default: 50,
          'x-raviumDependsOn': { property: 'effect', value: ['cube', 'coverflow', 'flip', 'cards', 'creative'], operator: 'in' },
        },
        effectDepth: {
          type: 'number',
          title: 'Effect depth',
          minimum: 0,
          maximum: 1000,
          default: 100,
          'x-raviumDependsOn': { property: 'effect', value: ['cube', 'coverflow', 'creative'], operator: 'in' },
        },
        effectModifier: {
          type: 'number',
          title: 'Effect modifier',
          minimum: 0,
          maximum: 5,
          default: 1,
          'x-raviumDependsOn': { property: 'effect', value: ['coverflow', 'creative'], operator: 'in' },
        },
        effectShadows: {
          type: 'boolean',
          title: 'Effect shadows',
          default: true,
          'x-raviumDependsOn': { property: 'effect', value: ['cube', 'coverflow', 'flip', 'cards'], operator: 'in' },
        },
        speed: {
          type: 'number',
          title: 'Speed',
          minimum: 0,
          maximum: 10000,
          default: 420,
        },
        autoHeight: {
          type: 'boolean',
          title: 'Auto height',
          default: false,
        },
        grabCursor: {
          type: 'boolean',
          title: 'Grab cursor',
          default: false,
        },
        cssMode: {
          type: 'boolean',
          title: 'CSS mode',
          default: false,
        },
        gridRows: {
          type: 'number',
          title: 'Grid rows',
          minimum: 1,
          maximum: 4,
          default: 1,
        },
        allowTouchMove: {
          type: 'boolean',
          title: 'Touch drag',
          default: true,
        },
        simulateTouch: {
          type: 'boolean',
          title: 'Simulate touch',
          default: true,
        },
        touchRatio: {
          type: 'number',
          title: 'Touch ratio',
          minimum: 0,
          maximum: 5,
          default: 1,
        },
        touchAngle: {
          type: 'number',
          title: 'Touch angle',
          minimum: 0,
          maximum: 90,
          default: 45,
        },
        threshold: {
          type: 'number',
          title: 'Swipe threshold',
          minimum: 0,
          maximum: 100,
          default: 5,
        },
        slides: {
          type: 'array',
          title: 'Slides',
          'x-raviumInput': 'slides',
          default: [],
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['image', 'component'], default: 'image' },
              image: { type: 'string', title: 'Uploaded image' },
              imageAssetId: { type: 'string', title: 'Uploaded image id' },
              imageUrl: { type: 'string', title: 'Image URL' },
              alt: { type: 'string', title: 'Alt text' },
              componentId: { type: 'string', title: 'Ravium component id' },
              componentName: { type: 'string', title: 'Component name' },
              componentProps: { type: 'object', title: 'Component props', default: {} },
              caption: { type: 'string', title: 'Caption' },
            },
          },
        },
        spaceBetween: {
          type: 'number',
          title: 'Slide gap',
          minimum: 0,
          maximum: 80,
          default: 16,
        },
        slideBackgroundColor: {
          type: 'string',
          title: 'Slide background',
          format: 'color',
          default: '#ffffff',
        },
        slideBorderRadius: {
          type: 'string',
          title: 'Slide radius',
          default: '8px',
        },
        slideBorderWidth: {
          type: 'string',
          title: 'Slide border width',
          default: '1px',
        },
        slideBorderStyle: {
          type: 'string',
          title: 'Slide border style',
          enum: ['none', 'solid', 'dashed', 'dotted'],
          default: 'solid',
        },
        slideBorderColor: {
          type: 'string',
          title: 'Slide border',
          format: 'color',
          default: '#e5e7eb',
        },
        slidePadding: {
          type: 'string',
          title: 'Slide padding',
          default: '0px',
        },
        captionColor: {
          type: 'string',
          title: 'Caption color',
          format: 'color',
          default: '#374151',
        },
        captionPadding: {
          type: 'string',
          title: 'Caption padding',
          default: '10px',
        },
        captionFontSize: {
          type: 'string',
          title: 'Caption font size',
          default: '14px',
        },
        captionFontWeight: {
          type: 'string',
          title: 'Caption font weight',
          enum: ['400', '500', '600', '700'],
          default: '400',
        },
        imageFit: {
          type: 'string',
          title: 'Image fit',
          enum: ['cover', 'contain'],
          default: 'cover',
        },
      },
    },
  },
  components: [
    {
      type: 'swiper.carousel',
      label: 'Swiper Carousel',
      category: 'Media',
      runtimeRenderer: 'src/components/SwiperCarousel.vue',
      editorRenderer: 'src/editor-renderer.html',
      propsSchema: { $ref: '#/settingsSchema/carousel' },
      projectSettingsSchema: { $ref: '#/settingsSchema/project' },
      editorStyleDeclarations: [
        {
          label: 'Слайды: расстояние',
          inputs: [
            {
              prop: 'spaceBetween',
              type: 'number',
              units: ['px'],
              min: 0,
              max: 80,
              step: 1,
              defaultValue: '16px',
              showIncrementButtons: true,
            },
          ],
        },
        {
          label: 'Слайд: фон',
          inputs: [{ prop: 'slideBackgroundColor', type: 'color', defaultValue: '#ffffff' }],
        },
        {
          label: 'Слайд: радиус',
          inputs: [
            {
              prop: 'slideBorderRadius',
              type: 'number',
              units: ['px', '%'],
              min: 0,
              max: 80,
              step: 1,
              defaultValue: '8px',
              showIncrementButtons: true,
            },
          ],
        },
        {
          label: 'Слайд: граница',
          inputs: [
            { prop: 'slideBorderColor', type: 'color', defaultValue: '#e5e7eb' },
            {
              prop: 'slideBorderWidth',
              type: 'number',
              units: ['px'],
              min: 0,
              max: 16,
              step: 1,
              defaultValue: '1px',
              showIncrementButtons: true,
            },
            {
              prop: 'slideBorderStyle',
              type: 'select',
              options: [
                { value: 'none', label: 'None' },
                { value: 'solid', label: 'Solid' },
                { value: 'dashed', label: 'Dashed' },
                { value: 'dotted', label: 'Dotted' },
              ],
              defaultValue: 'solid',
            },
          ],
        },
        {
          label: 'Слайд: отступ',
          inputs: [
            {
              prop: 'slidePadding',
              type: 'number',
              units: ['px'],
              min: 0,
              max: 80,
              step: 1,
              defaultValue: '0px',
              showIncrementButtons: true,
            },
          ],
        },
        {
          label: 'Подпись: текст',
          inputs: [
            { prop: 'captionColor', type: 'color', defaultValue: '#374151' },
            {
              prop: 'captionFontSize',
              type: 'number',
              units: ['px'],
              min: 10,
              max: 32,
              step: 1,
              defaultValue: '14px',
              showIncrementButtons: true,
            },
            {
              prop: 'captionFontWeight',
              type: 'select',
              options: [
                { value: '400', label: 'Regular' },
                { value: '500', label: 'Medium' },
                { value: '600', label: 'Semi Bold' },
                { value: '700', label: 'Bold' },
              ],
              defaultValue: '400',
            },
          ],
        },
        {
          label: 'Подпись: отступ',
          inputs: [
            {
              prop: 'captionPadding',
              type: 'number',
              units: ['px'],
              min: 0,
              max: 48,
              step: 1,
              defaultValue: '10px',
              showIncrementButtons: true,
            },
          ],
        },
        {
          label: 'Картинка',
          inputs: [
            {
              prop: 'imageFit',
              type: 'select',
              options: [
                { value: 'cover', label: 'Cover' },
                { value: 'contain', label: 'Contain' },
              ],
              defaultValue: 'cover',
            },
          ],
        },
      ],
    },
  ],
  variables: [
    { key: 'swiperCarouselSlideGap', mode: 'public', type: 'string', default: '12px' },
    { key: 'swiperCarouselSlideRadius', mode: 'public', type: 'string', default: '8px' },
    { key: 'swiperCarouselSlideBorderColor', mode: 'public', type: 'string', default: '#e5e7eb' },
    { key: 'swiperCarouselCaptionColor', mode: 'public', type: 'string', default: '#374151' },
  ],
  functions: [],
  routes: [],
  migrations: [],
  dependencies: { runtime: { swiper: '^12.2.0' }, editor: {} },
  moduleDependencies: [],
  assets: [],
  sizeBudget: { editorBundleGzipBytes: 20000, runtimeClientGzipBytes: 70000, runtimeServerBytes: 10000 },
  pricing: { kind: 'free' },
});

const validateManifestShape = (manifest: RaviumModuleManifest): void => {
  for (const field of requiredManifestFields) {
    if (!(field in manifest)) {
      throw new Error(`manifest missing required field: ${field}`);
    }
  }
  if (manifest.id !== `${manifest.namespace}.${manifest.slug}`) {
    throw new Error('manifest id must equal namespace.slug');
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error('manifest version must be semver x.y.z');
  }
  if (!manifest.entrypoints.editor || !manifest.entrypoints.runtimeClient || !manifest.entrypoints.runtimeServer) {
    throw new Error('manifest entrypoints editor/runtimeClient/runtimeServer are required');
  }
  normalizeModuleDependencies(manifest);
  normalizeRoutes(manifest);
  validateManifestPermissions(manifest);
};

const readPermissionSummary = (permissions: Record<string, unknown>): string[] => {
  return Array.isArray(permissions.summary)
    ? permissions.summary.filter((permission): permission is string => typeof permission === 'string')
    : [];
};

const readPermissionObject = (permissions: Record<string, unknown>, key: string): Record<string, unknown> | null => {
  const value = permissions[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
};

const hasPermission = (manifest: RaviumModuleManifest, permission: string): boolean => {
  const summary = readPermissionSummary(manifest.permissions);
  if (summary.includes(permission)) {
    return true;
  }

  if (permission === 'npm.dependencies') {
    return manifest.permissions.npmDependencies === true;
  }
  if (permission === 'migrations.postgres') {
    return manifest.permissions.migrations === true;
  }
  if (permission === 'generated.routes' || permission === 'generated.serverRoutes') {
    return manifest.permissions.generatedRoutes === true;
  }
  if (permission === 'assets.read') {
    return readPermissionObject(manifest.permissions, 'assets')?.read === true;
  }
  if (permission === 'settings.project') {
    return readPermissionObject(manifest.permissions, 'settings')?.project === true;
  }
  if (permission === 'settings.component') {
    return readPermissionObject(manifest.permissions, 'settings')?.component === true;
  }
  if (permission.startsWith('variables.')) {
    const mode = permission.replace('variables.', '');
    return Array.isArray(manifest.permissions.variables) && manifest.permissions.variables.includes(mode);
  }

  return false;
};

const hasAnyExtensionPoint = (manifest: RaviumModuleManifest, keys: string[]): boolean => {
  return keys.some((key) => {
    const value = manifest.extensionPoints[key];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return Boolean(value);
  });
};

const assertPermission = (manifest: RaviumModuleManifest, permission: string, reason: string): void => {
  if (!hasPermission(manifest, permission)) {
    throw new Error(`manifest uses ${reason} but does not declare ${permission} permission`);
  }
};

const hasNpmDependencies = (dependencies: Record<string, unknown>): boolean => {
  return Object.values(dependencies || {}).some((group) => {
    return Boolean(group && typeof group === 'object' && !Array.isArray(group) && Object.keys(group).length > 0);
  });
};

const validateManifestPermissions = (manifest: RaviumModuleManifest): void => {
  const routes = normalizeRoutes(manifest);
  if (routes.length > 0) {
    assertPermission(manifest, 'generated.routes', 'generated routes');
  }
  if (Array.isArray(manifest.middleware) && manifest.middleware.length > 0) {
    assertPermission(manifest, 'generated.middleware', 'generated middleware');
  }
  if (Array.isArray(manifest.composables) && manifest.composables.length > 0) {
    assertPermission(manifest, 'generated.composables', 'generated composables');
  }
  if (routes.some((route) => route.kind === 'server')) {
    assertPermission(manifest, 'generated.serverRoutes', 'generated server routes');
  }
  if (manifest.migrations.length > 0) {
    assertPermission(manifest, 'migrations.postgres', 'postgres migrations');
  }
  if (hasNpmDependencies(manifest.dependencies)) {
    assertPermission(manifest, 'npm.dependencies', 'npm dependencies');
  }
  if (manifest.assets.length > 0) {
    assertPermission(manifest, 'assets.read', 'module assets');
  }
  if (manifest.functions.length > 0 || hasAnyExtensionPoint(manifest, ['functionNodes'])) {
    assertPermission(manifest, 'functions.runtime', 'runtime functions');
  }
  if (hasAnyExtensionPoint(manifest, ['canvasPalette'])) {
    assertPermission(manifest, 'editor.palette', 'editor palette extension points');
  }
  if (hasAnyExtensionPoint(manifest, ['rightMenuSections'])) {
    assertPermission(manifest, 'editor.rightMenu', 'right menu extension points');
    assertPermission(manifest, 'settings.component', 'component settings extension points');
  }
  if (hasAnyExtensionPoint(manifest, ['leftMenu', 'editorTabs'])) {
    assertPermission(manifest, 'editor.panels', 'editor panel extension points');
  }
  if (hasAnyExtensionPoint(manifest, ['commands'])) {
    assertPermission(manifest, 'editor.commands', 'editor command extension points');
  }
  if (hasAnyExtensionPoint(manifest, ['projectSettingsPages'])) {
    assertPermission(manifest, 'settings.project', 'project settings extension points');
  }
  for (const variable of manifest.variables) {
    const mode = readString(variable.mode);
    if (mode) {
      assertPermission(manifest, `variables.${mode}`, `${mode} variables`);
    }
  }
};

const countExtensionPoints = (extensionPoints: Record<string, unknown>): Record<string, number> => {
  return Object.fromEntries(
    Object.entries(extensionPoints).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value.length];
      }
      if (value && typeof value === 'object') {
        return [key, Object.keys(value).length];
      }
      return [key, value ? 1 : 0];
    }),
  );
};

const normalizeModuleDependencies = (manifest: RaviumModuleManifest): DependencyReport['moduleDependencies'] => {
  const seen = new Set<string>();
  return manifest.moduleDependencies.map((dependency, index) => {
    const namespace = readString(dependency.namespace);
    const slug = readString(dependency.slug);
    const versionRange = readString(dependency.versionRange);
    const required = dependency.required === true;
    const reason = readString(dependency.reason);
    const contract = readString(dependency.contract);
    if (!namespace || !slug || !versionRange) {
      throw new Error(`module dependency ${index + 1} must include namespace, slug, and versionRange`);
    }
    if (namespace === manifest.namespace && slug === manifest.slug) {
      throw new Error('module dependency cannot reference itself');
    }
    const dependencyKey = `${namespace}/${slug}`;
    if (seen.has(dependencyKey)) {
      throw new Error(`module dependency ${dependencyKey} is declared more than once`);
    }
    seen.add(dependencyKey);
    if (!/^[~^]?\d+\.\d+\.\d+/.test(versionRange)) {
      throw new Error(`module dependency ${namespace}/${slug} has invalid version range`);
    }
    return {
      namespace,
      slug,
      versionRange,
      required,
      ...(reason ? { reason } : {}),
      ...(contract ? { contract } : {}),
    };
  });
};

const isUnsafePackageRange = (version: string): boolean => {
  const normalized = version.trim().toLowerCase();
  return (
    normalized === '*' ||
    normalized === 'latest' ||
    normalized.startsWith('file:') ||
    normalized.startsWith('link:') ||
    normalized.startsWith('workspace:') ||
    normalized.startsWith('git+') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://')
  );
};

const collectNpmDependencyEntries = (
  dependencies: Record<string, unknown>,
): Array<{ group: string; name: string; version: string }> => {
  const entries: Array<{ group: string; name: string; version: string }> = [];
  for (const [groupName, group] of Object.entries(dependencies || {})) {
    for (const dependency of readDependencyGroup(group)) {
      entries.push({ group: groupName, ...dependency });
    }
  }
  return entries;
};

const buildDependencyWarnings = (
  manifest: RaviumModuleManifest,
  moduleDependencies: DependencyReport['moduleDependencies'],
): DependencyReport['warnings'] => {
  const warnings: DependencyReport['warnings'] = [];
  const seenPackages = new Map<string, string>();

  for (const dependency of moduleDependencies) {
    if (!dependency.required && !dependency.reason?.trim()) {
      warnings.push({
        code: 'optional-dependency-missing-reason',
        severity: 'info',
        message: `Optional module dependency ${dependency.namespace}/${dependency.slug} should include a reason.`,
      });
    }
  }

  for (const dependency of collectNpmDependencyEntries(manifest.dependencies)) {
    if (isUnsafePackageRange(dependency.version)) {
      warnings.push({
        code: 'unsafe-npm-range',
        severity: 'high',
        message: `NPM dependency ${dependency.name}@${dependency.version} in ${dependency.group} is not immutable enough for review.`,
      });
    }
    const previousGroup = seenPackages.get(dependency.name);
    if (previousGroup && previousGroup !== dependency.group) {
      warnings.push({
        code: 'duplicate-npm-dependency',
        severity: 'warning',
        message: `NPM dependency ${dependency.name} appears in both ${previousGroup} and ${dependency.group}.`,
      });
    }
    seenPackages.set(dependency.name, dependency.group);
  }

  return warnings;
};

const looksSecretLike = (key: string): boolean => {
  return /secret|token|password|private|api[_-]?key|client[_-]?secret/i.test(key);
};

const schemaDefaultValue = (schema: unknown): unknown => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return undefined;
  }
  return (schema as Record<string, unknown>).default;
};

const buildSecretDefaultWarnings = (manifest: RaviumModuleManifest): AdvisoryReport['warnings'] => {
  const warnings: AdvisoryReport['warnings'] = [];
  for (const variable of manifest.variables) {
    const key = readString(variable.key);
    const mode = readString(variable.mode);
    const defaultValue = variable.default;
    if ((mode === 'server' || mode === 'encrypted') && defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      warnings.push({
        code: 'server-variable-default',
        severity: 'high',
        message: `Server-only variable ${key} has a default value; secrets and project data must be configured per project.`,
      });
    }
  }

  const settingsSchema = manifest.settingsSchema as Record<string, unknown>;
  for (const [schemaName, schemaValue] of Object.entries(settingsSchema)) {
    if (!schemaValue || typeof schemaValue !== 'object' || Array.isArray(schemaValue)) {
      continue;
    }
    const properties = (schemaValue as Record<string, unknown>).properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      continue;
    }
    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      const defaultValue = schemaDefaultValue(propertySchema);
      if (looksSecretLike(propertyName) && defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
        warnings.push({
          code: 'secret-setting-default',
          severity: 'high',
          message: `Setting ${schemaName}.${propertyName} looks secret-like and must not ship a default value.`,
        });
      }
    }
  }

  return warnings;
};

const normalizeMigrations = (manifest: RaviumModuleManifest): MigrationCheckReport['migrations'] => {
  return manifest.migrations.map((migration, index) => {
    const id = readString(migration.id);
    const engine = readString(migration.engine);
    const file = readString(migration.file);
    const rollbackFile = readString(migration.rollbackFile);
    const rollback = migration.rollback === true;
    if (!id || !engine || !file) {
      throw new Error(`migration ${index + 1} must include id, engine, and file`);
    }
    if (engine !== 'postgres') {
      throw new Error(`migration ${id} has unsupported engine: ${engine}`);
    }
    if (!file.endsWith('.sql')) {
      throw new Error(`migration ${id} must reference a .sql file`);
    }
    if (rollbackFile && !rollbackFile.endsWith('.sql')) {
      throw new Error(`migration ${id} rollbackFile must reference a .sql file`);
    }
    return { id, engine, file, ...(rollbackFile ? { rollbackFile } : {}), rollback };
  });
};

const normalizeRoutes = (manifest: RaviumModuleManifest): Array<Record<string, string>> => {
  return manifest.routes.map((route, index) => {
    const kind = readString(route.kind);
    const method = readString(route.method).toUpperCase();
    const routePath = readString(route.path);
    const entrypoint = readString(route.entrypoint);
    if (kind !== 'page' && kind !== 'server') {
      throw new Error(`route ${index + 1} kind must be page or server`);
    }
    if (!routePath || !routePath.startsWith('/')) {
      throw new Error(`route ${index + 1} path must start with /`);
    }
    if (routePath.includes('..') || routePath.includes('//')) {
      throw new Error(`route ${index + 1} path contains unsafe segments`);
    }
    if (!entrypoint) {
      throw new Error(`route ${index + 1} entrypoint is required`);
    }
    if (kind === 'server') {
      if (routePath.startsWith('/api/modules/')) {
        throw new Error('module server routes must not declare the reserved /api/modules namespace');
      }
      if (method && !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method)) {
        throw new Error(`server route ${routePath} uses unsupported method ${method}`);
      }
    }
    if (kind === 'page' && routePath.startsWith('/api/')) {
      throw new Error(`page route ${routePath} must not be under /api`);
    }
    return { kind, method: method || 'GET', path: routePath, entrypoint };
  });
};

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const moduleTablePrefix = (manifest: RaviumModuleManifest): string => {
  const slug = manifest.slug.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return `module_${slug}_`;
};

const moduleScopedTableName = (slug: string, suffix: string): string => {
  const normalizedSlug = slug.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  const normalizedSuffix = suffix.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return `module_${normalizedSlug}_${normalizedSuffix}`;
};

const collectMigrationTableRefs = (sql: string): string[] => {
  const refs = new Set<string>();
  const patterns = [
    /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.]+"?)/gi,
    /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?)/gi,
    /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?)/gi,
    /\bTRUNCATE\s+TABLE\s+("?[\w.]+"?)/gi,
    /\bREFERENCES\s+("?[\w.]+"?)/gi,
    /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?[\w.]+"?\s+ON\s+("?[\w.]+"?)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of sql.matchAll(pattern)) {
      const table = match[1]?.replaceAll('"', '').split('.').pop()?.trim();
      if (table) {
        refs.add(table);
      }
    }
  }
  return [...refs].sort();
};

const assertMigrationsScopedToModule = async (cwd: string, manifest: RaviumModuleManifest): Promise<void> => {
  const migrations = normalizeMigrations(manifest);
  const prefix = moduleTablePrefix(manifest);
  for (const migration of migrations) {
    const sql = await readFile(path.resolve(cwd, migration.file), 'utf8');
    const outsideTables = collectMigrationTableRefs(sql).filter((table) => !table.toLowerCase().startsWith(prefix));
    if (outsideTables.length > 0) {
      throw new Error(
        `migration ${migration.id} references tables outside module namespace ${prefix}: ${outsideTables.join(', ')}`,
      );
    }
  }
};

const collectReferencedFiles = (manifest: RaviumModuleManifest): string[] => {
  const files = new Set<string>();
  files.add(manifest.entrypoints.editor);
  files.add(manifest.entrypoints.runtimeClient);
  files.add(manifest.entrypoints.runtimeServer);
  if (manifest.entrypoints.styles) {
    files.add(manifest.entrypoints.styles);
  }
  for (const component of manifest.components) {
    addStringField(files, component.runtimeRenderer);
    addStringField(files, component.editorRenderer);
    for (const renderer of readArrayRecords(component.runtimeRendererVariants)) {
      addStringField(files, renderer.entrypoint);
      addStringField(files, renderer.runtimeRenderer);
    }
    for (const renderer of readArrayRecords(component.runtimeRenderers)) {
      addStringField(files, renderer.entrypoint);
      addStringField(files, renderer.runtimeRenderer);
    }
  }
  for (const extensionPoint of Object.values(manifest.extensionPoints)) {
    for (const item of Array.isArray(extensionPoint) ? extensionPoint : []) {
      addStringField(files, isRecord(item) ? item.entrypoint : undefined);
      addStringField(files, isRecord(item) ? item.handler : undefined);
    }
  }
  for (const fn of manifest.functions) {
    addStringField(files, fn.runtimeHandler);
  }
  for (const route of manifest.routes) {
    addStringField(files, route.entrypoint);
  }
  for (const migration of manifest.migrations) {
    addStringField(files, migration.file);
    addStringField(files, migration.rollbackFile);
  }
  for (const asset of manifest.assets) {
    addStringField(files, asset.path);
  }
  collectCapabilityReferencedFiles(manifest.capabilities, files);
  return [...files].sort();
};

const addStringField = (files: Set<string>, value: unknown): void => {
  if (typeof value === 'string' && value.trim()) {
    files.add(value);
  }
};

const artifactFileName = (file: string): string => {
  const normalized = file.replaceAll('\\', '/');
  if (normalized === 'src/editor.ts') {
    return 'editor.js';
  }
  if (normalized === 'src/runtime-client.ts') {
    return 'runtime-client.js';
  }
  if (normalized === 'src/runtime-server.ts') {
    return 'runtime-server.js';
  }
  if (normalized === 'src/styles.css') {
    return 'styles.css';
  }
  return normalized.replaceAll('/', '__');
};

const sourceSnapshotExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
  '.vue',
]);

const shouldIncludeSourceSnapshot = (file: string): boolean => {
  return sourceSnapshotExtensions.has(path.extname(file).toLowerCase());
};

const capabilityFileKeys = new Set([
  'entrypoint',
  'file',
  'handler',
  'path',
  'runtimeRenderer',
  'editorRenderer',
  'source',
  'sourceFile',
]);

const looksLikeLocalReferencedFile = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('#')) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return false;
  }
  if (normalized.includes('..')) {
    return false;
  }
  return Boolean(path.extname(normalized));
};

const addLocalStringField = (files: Set<string>, value: unknown): void => {
  if (typeof value === 'string' && looksLikeLocalReferencedFile(value)) {
    files.add(value.trim());
  }
};

const collectCapabilityReferencedFiles = (value: unknown, files: Set<string>, parentKey = ''): void => {
  if (typeof value === 'string') {
    if (capabilityFileKeys.has(parentKey)) {
      addLocalStringField(files, value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectCapabilityReferencedFiles(item, files, parentKey);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (capabilityFileKeys.has(key)) {
      addLocalStringField(files, nested);
      continue;
    }
    collectCapabilityReferencedFiles(nested, files, key);
  }
};

const detectFunctionExportName = (source: string): string => {
  if (/\bexport\s+(?:async\s+)?function\s+run\b/.test(source) || /\bexport\s+const\s+run\s*=/.test(source)) {
    return 'run';
  }
  if (/\bexport\s+default\b/.test(source)) {
    return 'default';
  }
  return 'run';
};

const buildArtifactRefs = async (
  cwd: string,
  manifest: RaviumModuleManifest,
  copiedFiles: string[],
): Promise<Record<string, unknown>> => {
  const base = `artifact://${manifest.namespace}/${manifest.slug}/${manifest.version}`;
  const refs: Record<string, unknown> = {
    editorBundle: `${base}/editor.js`,
    runtimeClientBundle: `${base}/runtime-client.js`,
    runtimeServerBundle: `${base}/runtime-server.js`,
  };
  if (copiedFiles.includes('styles.css')) {
    refs.styles = `${base}/styles.css`;
  }
  refs.files = Object.fromEntries(copiedFiles.map((file) => [file, `${base}/${file}`]));

  const sourceFiles: Record<string, string> = {};
  for (const file of collectReferencedFiles(manifest)) {
    const artifactName = artifactFileName(file);
    if (!copiedFiles.includes(artifactName) || !shouldIncludeSourceSnapshot(file)) {
      continue;
    }
    sourceFiles[artifactName] = await readFile(path.resolve(cwd, file), 'utf8');
  }
  if (Object.keys(sourceFiles).length > 0) {
    refs.sourceFiles = sourceFiles;
  }

  const functionHandlers: Record<string, Record<string, string>> = {};
  for (const fn of manifest.functions) {
    const id = readString(fn.id);
    const runtimeHandler = readString(fn.runtimeHandler);
    if (!id || !runtimeHandler) {
      continue;
    }
    const artifactName = artifactFileName(runtimeHandler);
    if (!copiedFiles.includes(artifactName) || !shouldIncludeSourceSnapshot(runtimeHandler)) {
      continue;
    }
    const source = sourceFiles[artifactName] || (await readFile(path.resolve(cwd, runtimeHandler), 'utf8'));
    functionHandlers[id] = {
      sourceFile: artifactName,
      exportName: detectFunctionExportName(source),
      artifactRef: `${base}/${artifactName}`,
    };
  }
  if (Object.keys(functionHandlers).length > 0) {
    refs.functionHandlers = functionHandlers;
  }

  const migrationSql: Record<string, string> = {};
  const migrationRollbackSql: Record<string, string> = {};
  for (const migration of manifest.migrations) {
    const file = readString(migration.file);
    const artifactName = artifactFileName(file);
    if (!file || !copiedFiles.includes(artifactName)) {
      continue;
    }
    migrationSql[artifactName] = await readFile(path.resolve(cwd, file), 'utf8');
    const rollbackFile = readString(migration.rollbackFile);
    const rollbackArtifactName = artifactFileName(rollbackFile);
    if (rollbackFile && copiedFiles.includes(rollbackArtifactName)) {
      migrationRollbackSql[artifactName] = await readFile(path.resolve(cwd, rollbackFile), 'utf8');
    }
  }
  if (Object.keys(migrationSql).length > 0) {
    refs.migrationSql = migrationSql;
  }
  if (Object.keys(migrationRollbackSql).length > 0) {
    refs.migrationRollbackSql = migrationRollbackSql;
  }

  return refs;
};

const buildChecksums = async (artifactRoot: string, files: string[]): Promise<Record<string, unknown>> => {
  const fileChecksums: Record<string, string> = {};
  const aggregate = createHash('sha256');
  for (const file of files) {
    const buffer = await readFile(path.join(artifactRoot, file));
    const checksum = createHash('sha256').update(buffer).digest('hex');
    fileChecksums[file] = checksum;
    aggregate.update(file);
    aggregate.update(checksum);
  }
  return {
    sha256: aggregate.digest('hex'),
    files: fileChecksums,
  };
};

const buildDependencyReport = async (cwd: string, manifest: RaviumModuleManifest): Promise<DependencyReport> => {
  const moduleDependencies = normalizeModuleDependencies(manifest);
  const installOrder = moduleDependencies
    .filter((dependency) => dependency.required)
    .concat(moduleDependencies.filter((dependency) => !dependency.required))
    .map((dependency) => `${dependency.namespace}/${dependency.slug}@${dependency.versionRange}`);
  const packageLockPackages = await readPackageLockPackages(cwd);
  const vulnerabilities = await readNpmAuditVulnerabilities(cwd);
  const warnings = [
    ...buildDependencyWarnings(manifest, moduleDependencies),
    ...buildPackageMetadataWarnings(packageLockPackages),
    ...buildVulnerabilityWarnings(vulnerabilities),
  ];
  return {
    dependencies: moduleDependencies.map((dependency) => ({
      namespace: dependency.namespace,
      slug: dependency.slug,
      version: dependency.versionRange,
      required: dependency.required,
      ...(dependency.reason ? { reason: dependency.reason } : {}),
      ...(dependency.contract ? { contract: dependency.contract } : {}),
    })),
    npm: manifest.dependencies,
    moduleDependencies,
    npmDependencies: manifest.dependencies,
    installOrder,
    dependencyGraph: {
      module: {
        namespace: manifest.namespace,
        slug: manifest.slug,
        version: manifest.version,
      },
      dependencies: moduleDependencies.map((dependency) => ({
        id: `${dependency.namespace}/${dependency.slug}`,
        ...dependency,
      })),
      cycles: [],
    },
    packages: packageLockPackages,
    vulnerabilities,
    warnings,
  };
};

const readPackageLockPackages = async (cwd: string): Promise<DependencyReport['packages']> => {
  const lockPath = path.resolve(cwd, 'package-lock.json');
  if (!(await fileExists(lockPath))) {
    return [];
  }
  let lock: Record<string, unknown>;
  try {
    lock = JSON.parse(await readFile(lockPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return [];
  }
  const packages = lock.packages;
  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    return [];
  }
  const result: DependencyReport['packages'] = [];
  for (const [packagePath, rawPackage] of Object.entries(packages)) {
    if (!packagePath.startsWith('node_modules/') || !rawPackage || typeof rawPackage !== 'object' || Array.isArray(rawPackage)) {
      continue;
    }
    const packageObject = rawPackage as Record<string, unknown>;
    const name = readString(packageObject.name) || packageNameFromLockPath(packagePath);
    const version = readString(packageObject.version);
    if (!name || !version) {
      continue;
    }
    const license = readPackageLicense(packageObject);
    const resolved = readString(packageObject.resolved);
    result.push({
      name,
      version,
      ...(license ? { license } : {}),
      ...(resolved ? { resolved } : {}),
      ...(packageObject.hasInstallScript === true ? { hasInstallScript: true } : {}),
    });
  }
  return result.sort((left, right) => left.name.localeCompare(right.name));
};

const readNpmAuditVulnerabilities = async (cwd: string): Promise<DependencyReport['vulnerabilities']> => {
  const storedAudit = await readStoredNpmAuditVulnerabilities(cwd);
  if (storedAudit) {
    return storedAudit;
  }
  if (!(await fileExists(path.resolve(cwd, 'package-lock.json')))) {
    return [];
  }
  let stdout = '';
  try {
    const result = await execFile('npm', ['audit', '--json', '--omit=dev'], {
      cwd,
      timeout: 30_000,
      maxBuffer: 1024 * 1024 * 8,
    });
    stdout = result.stdout;
  } catch (error) {
    const maybeOutput = error as { stdout?: unknown };
    stdout = typeof maybeOutput.stdout === 'string' ? maybeOutput.stdout : '';
  }
  if (!stdout.trim()) {
    return [];
  }
  let audit: Record<string, unknown>;
  try {
    audit = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return [];
  }
  const vulnerabilities = audit.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    return [];
  }
  const result: DependencyReport['vulnerabilities'] = [];
  for (const [packageName, rawVulnerability] of Object.entries(vulnerabilities)) {
    if (!rawVulnerability || typeof rawVulnerability !== 'object' || Array.isArray(rawVulnerability)) {
      continue;
    }
    const vulnerability = rawVulnerability as Record<string, unknown>;
    const severity = normalizeFindingSeverity(readString(vulnerability.severity));
    const via = readAuditVia(vulnerability.via);
    result.push({
      package: packageName,
      severity,
      title: via[0] || `${packageName} vulnerability`,
      ...(readString(vulnerability.range) ? { range: readString(vulnerability.range) } : {}),
      ...(via.length ? { via } : {}),
      ...(typeof vulnerability.fixAvailable === 'boolean' ? { fixAvailable: vulnerability.fixAvailable } : {}),
    });
  }
  return result.sort((left, right) => left.package.localeCompare(right.package));
};

const readStoredNpmAuditVulnerabilities = async (cwd: string): Promise<DependencyReport['vulnerabilities'] | null> => {
  for (const fileName of ['ravium.npm-audit.json', 'npm-audit.json']) {
    const filePath = path.resolve(cwd, fileName);
    if (!(await fileExists(filePath))) {
      continue;
    }
    try {
      const audit = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      const vulnerabilities = audit.vulnerabilities;
      if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
        return [];
      }
      const result: DependencyReport['vulnerabilities'] = [];
      for (const [packageName, rawVulnerability] of Object.entries(vulnerabilities)) {
        if (!rawVulnerability || typeof rawVulnerability !== 'object' || Array.isArray(rawVulnerability)) {
          continue;
        }
        const vulnerability = rawVulnerability as Record<string, unknown>;
        const severity = normalizeFindingSeverity(readString(vulnerability.severity));
        const via = readAuditVia(vulnerability.via);
        result.push({
          package: packageName,
          severity,
          title: via[0] || `${packageName} vulnerability`,
          ...(readString(vulnerability.range) ? { range: readString(vulnerability.range) } : {}),
          ...(via.length ? { via } : {}),
          ...(typeof vulnerability.fixAvailable === 'boolean' ? { fixAvailable: vulnerability.fixAvailable } : {}),
        });
      }
      return result.sort((left, right) => left.package.localeCompare(right.package));
    } catch {
      return [];
    }
  }
  return null;
};

const packageNameFromLockPath = (packagePath: string): string => {
  const parts = packagePath.split('/').filter(Boolean);
  const nodeModulesIndex = parts.lastIndexOf('node_modules');
  const nameParts = parts.slice(nodeModulesIndex + 1);
  if (nameParts[0]?.startsWith('@') && nameParts[1]) {
    return `${nameParts[0]}/${nameParts[1]}`;
  }
  return nameParts[0] || '';
};

const readPackageLicense = (packageObject: Record<string, unknown>): string => {
  const license = readString(packageObject.license);
  if (license) {
    return license;
  }
  const licenses = packageObject.licenses;
  if (Array.isArray(licenses)) {
    return licenses
      .map((entry) => readString(entry))
      .filter(Boolean)
      .join(', ');
  }
  return '';
};

const buildPackageMetadataWarnings = (packages: DependencyReport['packages']): DependencyReport['warnings'] => {
  const warnings: DependencyReport['warnings'] = [];
  for (const packageInfo of packages) {
    if (packageInfo.hasInstallScript) {
      warnings.push({
        code: 'npm-install-script',
        severity: 'high',
        package: packageInfo.name,
        path: `packages.${packageInfo.name}`,
        message: `NPM dependency ${packageInfo.name}@${packageInfo.version} has install scripts; reviewer must verify build-time behavior.`,
      });
    }
    const licenseSeverity = licenseSeverityForReview(packageInfo.license || '');
    if (licenseSeverity) {
      warnings.push({
        code: 'copyleft-license',
        severity: licenseSeverity,
        package: packageInfo.name,
        path: `packages.${packageInfo.name}`,
        message: `NPM dependency ${packageInfo.name}@${packageInfo.version} uses ${packageInfo.license} license.`,
      });
    }
  }
  return warnings;
};

const buildVulnerabilityWarnings = (
  vulnerabilities: DependencyReport['vulnerabilities'],
): DependencyReport['warnings'] => vulnerabilities.map((vulnerability) => ({
  code: 'known-vulnerability',
  severity: vulnerability.severity,
  package: vulnerability.package,
  path: `vulnerabilities.${vulnerability.package}`,
  message: `${vulnerability.package}: ${vulnerability.title}`,
}));

const licenseSeverityForReview = (license: string): DependencyReport['warnings'][number]['severity'] | null => {
  const normalized = license.toUpperCase();
  if (normalized.includes('AGPL') || normalized.includes('SSPL')) {
    return 'critical';
  }
  if (normalized.includes('GPL') || normalized.includes('LGPL')) {
    return 'warning';
  }
  return null;
};

const normalizeFindingSeverity = (severity: string): DependencyReport['warnings'][number]['severity'] => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'low':
    case 'info':
      return 'info';
    default:
      return 'warning';
  }
};

const readAuditVia = (via: unknown): string[] => {
  if (!Array.isArray(via)) {
    return [];
  }
  return via
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return readString((entry as Record<string, unknown>).title) || readString((entry as Record<string, unknown>).name);
      }
      return '';
    })
    .filter(Boolean);
};

const assertVersionNotSubmitted = async (options: {
  apiUrl: string;
  headers: Record<string, string>;
  namespace: string;
  slug: string;
  version: string;
}): Promise<void> => {
  const versions = await apiRequest<{ versions: ModuleVersionSummary[] }>({
    method: 'GET',
    url: `${options.apiUrl}/modules/${encodeURIComponent(options.namespace)}/${encodeURIComponent(options.slug)}/versions`,
    headers: options.headers,
  });
  const existingVersion = versions.versions.find((version) => version.version === options.version);
  if (existingVersion) {
    throw new Error(
      `module version ${options.namespace}/${options.slug}@${options.version} already exists with status ${existingVersion.status}`,
    );
  }
};

const readVersionChangelog = async (cwd: string, version: string): Promise<string> => {
  const changelogPath = path.resolve(cwd, 'CHANGELOG.md');
  let changelog = '';
  try {
    changelog = await readFile(changelogPath, 'utf8');
  } catch {
    throw new Error(`CHANGELOG.md must include an entry for ${version}`);
  }

  const heading = new RegExp(`^##\\s+\\[?${escapeRegExp(version)}\\]?\\b.*$`, 'm');
  const match = heading.exec(changelog);
  if (!match || match.index === undefined) {
    throw new Error(`CHANGELOG.md must include an entry for ${version}`);
  }
  const nextHeading = changelog.slice(match.index + match[0].length).search(/^##\s+/m);
  const end = nextHeading === -1 ? changelog.length : match.index + match[0].length + nextHeading;
  const entry = changelog.slice(match.index, end).trim();
  const body = entry.replace(/^##[^\n]*\n?/, '').trim();
  if (!body) {
    throw new Error(`CHANGELOG.md must include an entry for ${version}`);
  }
  return entry;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const apiRequest = async <Response>(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<Response> => {
  const response = await fetch(options.url, {
    method: options.method,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message =
      typeof payload?.error?.message === 'string' ? payload.error.message : `request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload as Response;
};

const assertFileExists = async (filePath: string, displayPath: string): Promise<void> => {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error(`${displayPath} is not a file`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`referenced file missing: ${displayPath}`);
    }
    throw error;
  }
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
};

const writeJSON = async (filePath: string, payload: unknown): Promise<void> => {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

export const listFilesRecursive = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
};

const modulePackageJson = (manifest: RaviumModuleManifest): Record<string, unknown> => ({
  name: `@${manifest.namespace}/${manifest.slug}`,
  version: manifest.version,
  private: true,
  type: 'module',
  scripts: {
    dev: 'ravium module dev',
    validate: 'ravium module validate',
    build: 'ravium module build',
  },
  dependencies: {
    '@ravium/module-sdk': '^1.0.0',
  },
  devDependencies: {
    '@ravium/cli': '^1.0.0',
    typescript: '^5.7.2',
  },
});

const moduleFrameworkSource = (manifest: RaviumModuleManifest): string => `const createRawManifestModule = (options) => ({
  kind: 'ravium.module',
  options,
  toManifest() {
    const manifest = {
      id: \`\${options.meta.namespace}.\${options.meta.slug}\`,
      namespace: options.meta.namespace,
      slug: options.meta.slug,
      name: options.meta.name,
      description: options.meta.description,
      version: options.meta.version,
      license: options.meta.license || 'MIT',
      author: options.meta.author || { name: 'Ravium Developer' },
      raviumApiVersion: options.meta.raviumApiVersion || '^1.0.0',
      sdkVersionRange: options.meta.sdkVersionRange || '^1.0.0',
      compatibility: options.meta.compatibility || {},
      tags: options.meta.tags || [],
      entrypoints: options.entrypoints || {
        editor: 'src/editor.ts',
        runtimeClient: 'src/runtime-client.ts',
        runtimeServer: 'src/runtime-server.ts',
        styles: 'src/styles.css',
      },
      extensionPoints: {},
      permissions: { summary: [] },
      settingsSchema: {},
      components: [],
      variables: [],
      functions: [],
      routes: [],
      migrations: [],
      dependencies: {},
      moduleDependencies: [],
      assets: [],
      sizeBudget: options.meta.sizeBudget || {},
      pricing: options.meta.pricing || { kind: 'free' },
      capabilities: {},
    };
    const pushCapability = (name, payload) => {
      const existing = manifest.capabilities[name];
      if (Array.isArray(existing)) existing.push(payload);
      else manifest.capabilities[name] = [payload];
    };
    const setByPath = (path, value) => {
      const segments = String(path).split('.').filter(Boolean);
      let current = manifest;
      for (const segment of segments.slice(0, -1)) {
        current[segment] = current[segment] && typeof current[segment] === 'object' && !Array.isArray(current[segment]) ? current[segment] : {};
        current = current[segment];
      }
      if (segments.length) current[segments[segments.length - 1]] = value;
    };
    options.setup?.({
      raw: {
        manifest: (patch) => Object.assign(manifest, patch),
        set: setByPath,
        merge: (path, value) => setByPath(path, { ...(String(path).split('.').filter(Boolean).reduce((current, segment) => current && current[segment], manifest) || {}), ...value }),
        push: (path, value) => {
          const segments = String(path).split('.').filter(Boolean);
          const existing = segments.reduce((current, segment) => current && current[segment], manifest);
          setByPath(path, Array.isArray(existing) ? [...existing, value] : [value]);
        },
        permission: (permission) => {
          manifest.permissions.summary = Array.from(new Set([...(manifest.permissions.summary || []), permission]));
        },
        capability: pushCapability,
        extensionPoint: (name, value) => {
          const existing = manifest.extensionPoints[name];
          if (Array.isArray(existing)) existing.push(value);
          else manifest.extensionPoints[name] = [value];
        },
        file: (path, options = {}) => pushCapability('rawFiles', { path, ...options }),
        files: (paths, options = {}) => paths.forEach((path) => pushCapability('rawFiles', { path, ...options })),
        artifact: (artifact) => pushCapability('artifacts', artifact),
        compilerFile: (file) => pushCapability('compilerFiles', file),
      },
    });
    return manifest;
  },
});

const { defineRaviumModule } = await import('@ravium/module-sdk').catch(() => ({
  defineRaviumModule: createRawManifestModule,
}));

export default defineRaviumModule({
  meta: ${JSON.stringify(
    {
      namespace: manifest.namespace,
      slug: manifest.slug,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      license: manifest.license,
      author: manifest.author,
      tags: manifest.tags,
      raviumApiVersion: manifest.raviumApiVersion,
      sdkVersionRange: manifest.sdkVersionRange,
      compatibility: manifest.compatibility,
      sizeBudget: manifest.sizeBudget,
      pricing: manifest.pricing,
    },
    null,
    2,
  )},
  entrypoints: ${JSON.stringify(manifest.entrypoints, null, 2)},
  setup(ravium) {
    ravium.raw.manifest(${JSON.stringify(
      {
        extensionPoints: manifest.extensionPoints,
        permissions: manifest.permissions,
        settingsSchema: manifest.settingsSchema,
        components: manifest.components,
        variables: manifest.variables,
        functions: manifest.functions,
        routes: manifest.routes,
        middleware: manifest.middleware,
        composables: manifest.composables,
        migrations: manifest.migrations,
        projectTransforms: manifest.projectTransforms,
        dependencies: manifest.dependencies,
        moduleDependencies: manifest.moduleDependencies,
        assets: manifest.assets,
      },
      null,
      4,
    )});
  },
});
`;

const moduleTsconfig = (): Record<string, unknown> => ({
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    strict: true,
    target: 'ES2022',
    types: [],
  },
  include: ['ravium.module.mjs', 'src/**/*.ts', 'src/**/*.vue'],
});

const readmeFor = (manifest: RaviumModuleManifest, template: InitOptions['template'] = 'basic'): string => {
  if (template === 'swiper') {
    return `# ${manifest.name}

${manifest.description}

## Global settings

- Enable pagination: toggles Swiper pagination bullets.
- Styles: choose bundled Swiper styles or neutral Ravium defaults.

## Component settings

- Autoscroll delay in milliseconds. Use 0 to disable autoplay.
- Cards per view.
- Direction: horizontal or vertical.
- Slides: image slides can point to uploaded Ravium asset ids or URLs; component slides reference existing Ravium component ids/names and optional props.

## Commands

\`\`\`bash
ravium module dev
ravium module validate
ravium module build --out ../../module-artifacts/modules
\`\`\`
`;
  }

  return `# ${manifest.name}

${manifest.description}

## Commands

\`\`\`bash
ravium module dev
ravium module validate
ravium module build --out ../../module-artifacts/modules
\`\`\`
`;
};

const editorSource = (template: InitOptions['template'] = 'basic'): string => {
  if (template === 'swiper') {
    return `import { defineEditorEntrypoint } from '@ravium/module-sdk';

export const registerEditorExtensions = defineEditorEntrypoint((ctx) => {
  ctx.registerPaletteItem({ id: 'swiper.carousel', label: 'Swiper Carousel', icon: 'GalleryHorizontal', componentType: 'swiper.carousel' });
  ctx.registerRightMenuSection({ id: 'swiper.carousel.settings', label: 'Swiper carousel', targetComponentTypes: ['swiper.carousel'] });
});
`;
  }

  return `import { defineEditorEntrypoint } from '@ravium/module-sdk';

export const registerEditorExtensions = defineEditorEntrypoint((ctx) => {
  ctx.registerLeftMenuSection({ id: 'kitchen-sink.section', label: 'Kitchen Sink', icon: 'Package' });
  ctx.registerPaletteItem({ id: 'kitchen-sink.metric-card', label: 'Metric Card', icon: 'BarChart3', componentType: 'kitchen-sink.metric-card' });
  ctx.registerCommand({ id: 'kitchen-sink.insert-card', label: 'Insert metric card', icon: 'SquarePlus' });
});
`;
};

const editorDashboardSource = (): string => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        background: #ffffff;
        color: #111827;
      }
      .shell {
        display: grid;
        gap: 16px;
        padding: 20px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 12px;
      }
      .title {
        margin: 0;
        font-size: 18px;
        line-height: 1.35;
      }
      .muted {
        color: #6b7280;
        font-size: 13px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }
      .panel {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
      }
      .value {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 600;
        word-break: break-word;
      }
      pre {
        overflow: auto;
        margin: 0;
        border-radius: 6px;
        background: #f3f4f6;
        padding: 10px;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="header">
        <div>
          <h1 class="title">Kitchen Sink Dashboard</h1>
          <div id="module-ref" class="muted">module loading</div>
        </div>
        <div id="project-ref" class="muted">project loading</div>
      </header>
      <section class="grid">
        <div class="panel">
          <div class="muted">Extension</div>
          <div id="extension-id" class="value">-</div>
        </div>
        <div class="panel">
          <div class="muted">Project</div>
          <div id="project-id" class="value">-</div>
        </div>
        <div class="panel">
          <div class="muted">Module</div>
          <div id="module-id" class="value">-</div>
        </div>
      </section>
      <section class="panel">
        <div class="muted">Public config</div>
        <pre id="public-config">{}</pre>
      </section>
    </main>
    <script>
      window.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type !== 'ravium:module-editor-init') {
          return;
        }
        const moduleRef = [data.module?.namespace, data.module?.slug].filter(Boolean).join('/');
        document.getElementById('module-ref').textContent = moduleRef + '@' + (data.module?.version || '');
        document.getElementById('project-ref').textContent = data.project?.name || data.project?.id || 'project';
        document.getElementById('extension-id').textContent = data.extension?.id || '-';
        document.getElementById('project-id').textContent = data.project?.id || '-';
        document.getElementById('module-id').textContent = data.module?.moduleId || '-';
        document.getElementById('public-config').textContent = JSON.stringify(data.publicConfig || {}, null, 2);
      });
      window.RaviumModuleEditor?.ready?.();
    </script>
  </body>
</html>
`;

const insertCardCommandSource = (): string => `export const run = (ctx) => {
  return { type: 'addComponent', componentType: 'kitchen-sink.metric-card' };
};
`;

const projectSettingsSource = (): string => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        background: #ffffff;
        color: #111827;
      }
      .shell {
        display: grid;
        gap: 12px;
        padding: 14px;
      }
      .title {
        margin: 0;
        font-size: 15px;
        font-weight: 650;
      }
      .muted {
        color: #6b7280;
        font-size: 12px;
      }
      .row {
        display: grid;
        gap: 6px;
      }
      label {
        font-size: 12px;
        color: #4b5563;
      }
      input {
        height: 34px;
        border: 1px solid #d1d5db;
        border-radius: 7px;
        padding: 0 10px;
        font: inherit;
      }
      button {
        width: fit-content;
        border: 1px solid #111827;
        border-radius: 7px;
        background: #111827;
        color: #ffffff;
        padding: 8px 12px;
        font: inherit;
        cursor: pointer;
      }
      #status {
        min-height: 16px;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div>
        <h1 class="title">Kitchen Sink Settings</h1>
        <div id="module-ref" class="muted">module loading</div>
      </div>
      <div class="row">
        <label for="endpoint">Telemetry endpoint</label>
        <input id="endpoint" placeholder="https://api.example.test/events" />
      </div>
      <button id="save" type="button">Save settings</button>
      <div id="status" class="muted"></div>
    </main>
    <script>
      let currentPayload = {};
      const endpoint = document.getElementById('endpoint');
      const status = document.getElementById('status');
      window.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type !== 'ravium:module-project-settings-init') {
          return;
        }
        currentPayload = data;
        const moduleRef = [data.module?.namespace, data.module?.slug].filter(Boolean).join('/');
        document.getElementById('module-ref').textContent = moduleRef + '@' + (data.module?.version || '');
        endpoint.value = data.publicConfig?.endpoint || '';
        status.textContent = '';
      });
      document.getElementById('save').addEventListener('click', () => {
        window.RaviumModuleProjectSettings?.save?.({
          publicConfig: {
            endpoint: endpoint.value.trim(),
          },
        });
        status.textContent = 'Saving';
      });
      window.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'ravium:module-project-settings-save-result') {
          status.textContent = data.ok ? 'Saved' : data.message || 'Save failed';
        }
      });
      window.RaviumModuleProjectSettings?.ready?.();
    </script>
  </body>
</html>
`;

const runtimeClientSource = (template: InitOptions['template'] = 'basic'): string => {
  if (template === 'swiper') {
    return `import { defineRuntimeClientEntrypoint } from '@ravium/module-sdk';

export const setupRuntimeClient = defineRuntimeClientEntrypoint(() => {
  return { name: 'swiper-carousel-runtime-client' };
});
`;
  }

  return `import { defineRuntimeClientEntrypoint } from '@ravium/module-sdk';

export const setupRuntimeClient = defineRuntimeClientEntrypoint((ctx) => {
  ctx.onPageMounted(() => ctx.variables?.increment('kitchenSinkPublicCounter', 1));
});
`;
};

const runtimeServerSource = (template: InitOptions['template'] = 'basic'): string => {
  if (template === 'swiper') {
    return `import { defineRuntimeServerEntrypoint } from '@ravium/module-sdk';

export const setupRuntimeServer = defineRuntimeServerEntrypoint(() => {
  return { routes: [] };
});
`;
  }

  return `import { defineRuntimeServerEntrypoint } from '@ravium/module-sdk';

export const setupRuntimeServer = defineRuntimeServerEntrypoint((ctx) => {
  ctx.registerRoute({ method: 'POST', path: '/api/kitchen-sink/events', handler: async () => ({ ok: true }) });
});
`;
};

const stylesSource = (template: InitOptions['template'], slug: string): string => {
  if (template === 'swiper') {
    return `.ravium-swiper-carousel {
  width: 100%;
  min-height: 160px;
}

.ravium-swiper-carousel--ravium {
  --swiper-theme-color: #111827;
  --swiper-pagination-bullet-inactive-color: #9ca3af;
}

.ravium-swiper-carousel .swiper {
  width: 100%;
  height: 100%;
}

.ravium-swiper-carousel .swiper-slide {
  display: flex;
  height: auto;
  box-sizing: border-box;
}

.ravium-swiper-carousel__slide {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 180px;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.ravium-swiper-carousel__zoomless,
.ravium-swiper-carousel .swiper-zoom-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.ravium-swiper-carousel__image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 180px;
  object-fit: cover;
}

.ravium-swiper-carousel__component,
.ravium-swiper-carousel__empty {
  display: flex;
  width: 100%;
  min-height: 180px;
  flex: 1;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 16px;
}

.ravium-swiper-carousel__slide > :where(.ravium-module-slot-component) {
  display: block;
  width: 100%;
  min-height: 0;
  flex: 1;
}

.ravium-swiper-carousel__slide > :where(.ravium-module-slot-component) > * {
  width: 100%;
  height: 100%;
}

.ravium-swiper-carousel__caption {
  padding: 10px 12px;
  color: #374151;
  font-size: 14px;
}

.ravium-swiper-carousel .swiper-button-next,
.ravium-swiper-carousel .swiper-button-prev {
  position: absolute;
  top: 50%;
  z-index: 10;
  display: flex;
  width: 32px;
  height: 32px;
  margin-top: -16px;
  align-items: center;
  justify-content: center;
  color: var(--swiper-theme-color, #111827);
  cursor: pointer;
  user-select: none;
}

.ravium-swiper-carousel .swiper-button-next {
  right: 10px;
  left: auto;
}

.ravium-swiper-carousel .swiper-button-prev {
  right: auto;
  left: 10px;
}

.ravium-swiper-carousel .swiper-button-next::after,
.ravium-swiper-carousel .swiper-button-prev::after {
  font-size: var(--swiper-navigation-size, 28px);
  font-weight: 700;
  line-height: 1;
}

.ravium-swiper-carousel .swiper-button-next::after {
  content: ">";
}

.ravium-swiper-carousel .swiper-button-prev::after {
  content: "<";
}

.ravium-swiper-carousel .swiper-button-disabled {
  opacity: 0.35;
  pointer-events: none;
}

.ravium-swiper-carousel .swiper-pagination {
  position: absolute;
  z-index: 10;
  text-align: center;
  transform: translate3d(0, 0, 0);
  transition: 300ms opacity;
}

.ravium-swiper-carousel .swiper-pagination-bullets.swiper-pagination-horizontal {
  bottom: 8px;
  left: 0;
  width: 100%;
}

.ravium-swiper-carousel .swiper-pagination-bullet {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin: 0 4px;
  border-radius: 999px;
  opacity: 0.35;
  cursor: pointer;
}

.ravium-swiper-carousel .swiper-pagination-bullet-active {
  opacity: 1;
}

.ravium-swiper-carousel .swiper-pagination-progressbar {
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: rgba(17, 24, 39, 0.12);
}

.ravium-swiper-carousel .swiper-pagination-progressbar .swiper-pagination-progressbar-fill,
.ravium-swiper-carousel .swiper-pagination-bullet {
  background: var(--swiper-theme-color, #111827);
}

.ravium-swiper-carousel .swiper-pagination-progressbar .swiper-pagination-progressbar-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: scale(0);
  transform-origin: left top;
}

.ravium-swiper-carousel .swiper-scrollbar {
  position: absolute;
  bottom: 4px;
  left: 1%;
  z-index: 50;
  width: 98%;
  height: 5px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.12);
}

.ravium-swiper-carousel .swiper-scrollbar-drag {
  position: relative;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: var(--swiper-theme-color, #111827);
}

.ravium-swiper-carousel .swiper-zoom-container > img,
.ravium-swiper-carousel .swiper-zoom-container > canvas,
.ravium-swiper-carousel .swiper-zoom-container > svg {
  max-width: none;
}

`;
  }

  return `.ravium-module-${slug} { color: var(--foreground); }\n`;
};

const swiperEditorRendererSource = (): string => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.css" />
<style>
html,
body,
#root {
  width: 100%;
  height: 100%;
  min-height: 156px;
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.rv-swiper {
  width: 100%;
  height: 100%;
  min-height: 156px;
  box-sizing: border-box;
  --swiper-theme-color: #111827;
  --swiper-navigation-size: 28px;
}

.rv-swiper .swiper {
  width: 100%;
  height: 100%;
}

.rv-swiper .swiper-slide {
  display: flex;
  height: auto;
  box-sizing: border-box;
}

.rv-swiper__zoomless,
.swiper-zoom-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.rv-swiper__slide {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 140px;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border: var(--slide-border-width, 1px) var(--slide-border-style, solid) var(--slide-border-color, #e5e7eb);
  border-radius: var(--slide-radius, 8px);
  padding: var(--slide-padding, 0);
  background: var(--slide-bg, #fff);
}

.rv-swiper__image {
  display: block;
  width: 100%;
  min-height: 0;
  flex: 1;
  object-fit: var(--image-fit, cover);
}

.rv-swiper__empty,
.rv-swiper__component {
  display: flex;
  width: 100%;
  min-height: 140px;
  flex: 1;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 16px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
}

.rv-swiper__caption {
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  padding: var(--caption-padding, 10px);
  color: var(--caption-color, #374151);
  font-size: var(--caption-font-size, 14px);
  font-weight: var(--caption-font-weight, 400);
}
</style>
</head>
<body>
<div id="root"></div>
<script src="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js"></script>
<script>
(function () {
  var root = document.getElementById('root');
  var payload = null;
  var swiper = null;
  var slotPublishFrame = 0;
  var slotPublishUntil = 0;

  function destroySwiper() {
    if (swiper && typeof swiper.destroy === 'function') {
      swiper.destroy(true, true);
    }
    swiper = null;
  }

  function readNumber(value, fallback) {
    var parsed = Number.parseFloat(String(value == null ? '' : value));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function readBool(value, fallback) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return fallback;
  }

  function readCssValue(value, fallback) {
    return value == null || value === '' ? fallback : String(value);
  }

  function readEnum(value, allowed, fallback) {
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }

  function imageSource(slide) {
    var value = slide.image || slide.imageUrl || slide.src || slide.imageAssetId || '';
    if (!value) return '';

    try {
      var parsed = JSON.parse(value);
      if (parsed && parsed.type === 'project-image-asset') {
        return (parsed.full && parsed.full.url) || (parsed.small && parsed.small.url) || '';
      }
    } catch (_) {
      return String(value);
    }

    return String(value);
  }

  function setVar(element, name, value) {
    element.style.setProperty(name, value);
  }

  function publishSlots() {
    if (!payload) return;
    if (slotPublishFrame) {
      cancelAnimationFrame(slotPublishFrame);
    }
    slotPublishFrame = requestAnimationFrame(function () {
      slotPublishFrame = 0;
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var slotMap = new Map();
      Array.prototype.slice.call(document.querySelectorAll('[data-ravium-component-id]')).forEach(function (element, index) {
        var rect = element.getBoundingClientRect();
        var visible = rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < viewportWidth &&
          rect.top < viewportHeight;
        if (!visible) return;
        var slotName = element.getAttribute('data-ravium-slot-name') ||
          element.getAttribute('data-ravium-slot-id') ||
          element.getAttribute('data-ravium-component-id') ||
          'slot-' + index;
        var left = Math.max(0, rect.left);
        var top = Math.max(0, rect.top);
        var width = Math.min(rect.width, viewportWidth - left);
        var height = Math.min(rect.height, viewportHeight - top);
        var slot = {
          id: slotName,
          componentId: element.getAttribute('data-ravium-component-id') || '',
          componentName: element.getAttribute('data-ravium-component-name') || '',
          left: left,
          top: top,
          width: width,
          height: height,
          area: width * height,
        };
        var existing = slotMap.get(slotName);
        if (!existing || existing.area < slot.area) {
          slotMap.set(slotName, slot);
        }
      });
      var slots = Array.from(slotMap.values()).map(function (slot) {
        return {
          id: slot.id,
          componentId: slot.componentId,
          componentName: slot.componentName,
          left: slot.left,
          top: slot.top,
          width: slot.width,
          height: slot.height,
        };
      });
      window.parent.postMessage({ type: 'ravium:module-slots', blockId: payload.blockId || '', slots: slots }, '*');
      if (Date.now() < slotPublishUntil) {
        publishSlots();
      }
    });
  }

  function scheduleSlotPublishing() {
    var speed = payload && payload.props ? Math.max(0, Math.min(10000, Math.round(readNumber(payload.props.speed, 420)))) : 420;
    slotPublishUntil = Math.max(slotPublishUntil, Date.now() + speed + 220);
    publishSlots();
    setTimeout(publishSlots, 80);
    setTimeout(publishSlots, 240);
    setTimeout(publishSlots, 480);
  }

  function renderSlide(slide, index, zoomEnabled, parallaxEnabled, parallaxOffset) {
    var slideNode = document.createElement('div');
    slideNode.className = 'swiper-slide';
    var hash = slide && (slide.hash || slide.id) ? String(slide.hash || slide.id) : 'slide-' + (index + 1);
    slideNode.setAttribute('data-hash', hash);
    slideNode.setAttribute('data-history', hash);

    var zoomNode = document.createElement('div');
    zoomNode.className = zoomEnabled ? 'swiper-zoom-container' : 'rv-swiper__zoomless';

    var item = document.createElement('article');
    item.className = 'rv-swiper__slide';
    if (parallaxEnabled) {
      item.setAttribute('data-swiper-parallax', parallaxOffset || '-18%');
    }

    if (slide && slide.type === 'image' && imageSource(slide)) {
      var image = document.createElement('img');
      image.className = 'rv-swiper__image';
      image.src = imageSource(slide);
      image.alt = slide.alt || slide.caption || '';
      item.appendChild(image);
    } else if (slide && slide.type === 'component') {
      var component = document.createElement('div');
      component.className = 'rv-swiper__component';
      component.setAttribute('data-ravium-component-id', slide.componentId || '');
      component.setAttribute('data-ravium-component-name', slide.componentName || '');
      component.setAttribute('data-ravium-slot-name', slide.slotName || slide.id || 'component-' + index);
      component.textContent = slide.componentName || slide.componentId || 'Компонент проекта';
      item.appendChild(component);
    } else {
      var fallback = document.createElement('div');
      fallback.className = 'rv-swiper__empty';
      fallback.textContent = 'Slide ' + (index + 1);
      item.appendChild(fallback);
    }

    if (slide && slide.caption) {
      var caption = document.createElement('footer');
      caption.className = 'rv-swiper__caption';
      caption.textContent = slide.caption;
      item.appendChild(caption);
    }

    zoomNode.appendChild(item);
    slideNode.appendChild(zoomNode);
    return slideNode;
  }

  function render() {
    if (!payload) return;
    destroySwiper();

    var props = payload.props || {};
    var slides = Array.isArray(props.slides) ? props.slides : [];
    var direction = props.direction === 'vertical' ? 'vertical' : 'horizontal';
    var slidesPerView = Math.max(1, Math.min(8, Math.round(readNumber(props.slidesPerView, 1))));
    var slidesPerGroup = Math.max(1, Math.min(8, Math.round(readNumber(props.slidesPerGroup, 1))));
    var delay = Math.max(0, Math.round(readNumber(props.autoplayDelayMs, 0)));
    var speed = Math.max(0, Math.min(10000, Math.round(readNumber(props.speed, 420))));
    var effect = readEnum(props.effect, ['slide', 'fade', 'cube', 'coverflow', 'flip', 'cards', 'creative'], 'slide');
    var cssMode = readBool(props.cssMode, false);
    var zoomEnabled = readBool(props.zoomEnabled, false);
    var virtualEnabled = readBool(props.virtualEnabled, false);
    var parallaxEnabled = readBool(props.parallaxEnabled, false);
    var parallaxOffset = readCssValue(props.parallaxOffset, '-18%');
    var loopEnabled = readBool(props.loopEnabled, true);
    var rewindEnabled = readBool(props.rewindEnabled, false);
    var freeModeEnabled = readBool(props.freeModeEnabled, false);
    var hasComponentSlides = slides.some(function (slide) { return slide && slide.type === 'component'; });
    var gridRows = Math.max(1, Math.min(4, Math.round(readNumber(props.gridRows, 1))));
    var effectRotate = Math.max(0, Math.min(360, readNumber(props.effectRotate, 50)));
    var effectDepth = Math.max(0, Math.min(1000, readNumber(props.effectDepth, 100)));
    var effectModifier = Math.max(0, Math.min(5, readNumber(props.effectModifier, 1)));
    var effectShadows = readBool(props.effectShadows, true);
    var zoomMinRatio = Math.max(1, Math.min(10, readNumber(props.zoomMinRatio, 1)));
    var zoomMaxRatio = Math.max(zoomMinRatio, Math.min(10, readNumber(props.zoomMaxRatio, 3)));

    if (cssMode || direction === 'vertical') {
      effect = 'slide';
    }

    var container = document.createElement('section');
    container.className = 'rv-swiper';
    setVar(container, '--slide-bg', readCssValue(props.slideBackgroundColor, '#fff'));
    setVar(container, '--slide-radius', readCssValue(props.slideBorderRadius, '8px'));
    setVar(container, '--slide-border-width', readCssValue(props.slideBorderWidth, '1px'));
    setVar(container, '--slide-border-style', readCssValue(props.slideBorderStyle, 'solid'));
    setVar(container, '--slide-border-color', readCssValue(props.slideBorderColor, '#e5e7eb'));
    setVar(container, '--slide-padding', readCssValue(props.slidePadding, '0'));
    setVar(container, '--caption-color', readCssValue(props.captionColor, '#374151'));
    setVar(container, '--caption-padding', readCssValue(props.captionPadding, '10px'));
    setVar(container, '--caption-font-size', readCssValue(props.captionFontSize, '14px'));
    setVar(container, '--caption-font-weight', readCssValue(props.captionFontWeight, '400'));
    setVar(container, '--image-fit', props.imageFit === 'contain' ? 'contain' : 'cover');

    if (slides.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'rv-swiper__empty';
      empty.textContent = 'Добавьте слайды в параметрах модуля';
      container.appendChild(empty);
      root.replaceChildren(container);
      publishSlots();
      return;
    }

    var swiperNode = document.createElement('div');
    swiperNode.className = 'swiper';
    var wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    slides.forEach(function (slide, index) {
      wrapper.appendChild(renderSlide(slide, index, zoomEnabled, parallaxEnabled, parallaxOffset));
    });
    swiperNode.appendChild(wrapper);

    if (readBool(props.paginationEnabled, true)) {
      var pagination = document.createElement('div');
      pagination.className = 'swiper-pagination';
      swiperNode.appendChild(pagination);
    }
    if (readBool(props.navigationEnabled, false)) {
      var next = document.createElement('div');
      next.className = 'swiper-button-next';
      var prev = document.createElement('div');
      prev.className = 'swiper-button-prev';
      swiperNode.appendChild(next);
      swiperNode.appendChild(prev);
    }
    if (readBool(props.scrollbarEnabled, false)) {
      var scrollbar = document.createElement('div');
      scrollbar.className = 'swiper-scrollbar';
      swiperNode.appendChild(scrollbar);
    }

    container.appendChild(swiperNode);
    root.replaceChildren(container);

    if (!window.Swiper) {
      throw new Error('Swiper bundle failed to load');
    }

    swiper = new window.Swiper(swiperNode, {
      slidesPerView: slidesPerView,
      slidesPerGroup: slidesPerGroup,
      direction: direction,
      spaceBetween: Math.max(0, Math.min(160, Math.round(readNumber(props.spaceBetween, 16)))),
      speed: speed,
      effect: effect,
      loop: loopEnabled && !hasComponentSlides && slides.length > slidesPerView && effect !== 'fade',
      rewind: rewindEnabled && !(loopEnabled && !hasComponentSlides && slides.length > slidesPerView),
      centeredSlides: readBool(props.centeredSlides, false),
      freeMode: freeModeEnabled ? {
        enabled: true,
        momentum: readBool(props.freeModeMomentum, true),
        momentumRatio: Math.max(0, Math.min(5, readNumber(props.freeModeMomentumRatio, 1))),
        sticky: readBool(props.freeModeSticky, false),
      } : false,
      mousewheel: readBool(props.mousewheelEnabled, false) ? {
        enabled: true,
        forceToAxis: readBool(props.mousewheelForceToAxis, false),
        invert: readBool(props.mousewheelInvert, false),
        sensitivity: Math.max(0.1, Math.min(10, readNumber(props.mousewheelSensitivity, 1))),
      } : false,
      keyboard: readBool(props.keyboardEnabled, false) ? {
        enabled: true,
        onlyInViewport: readBool(props.keyboardOnlyInViewport, true),
        pageUpDown: readBool(props.keyboardPageUpDown, true),
      } : false,
      a11y: readBool(props.a11yEnabled, true) ? { enabled: true } : false,
      zoom: zoomEnabled ? {
        maxRatio: zoomMaxRatio,
        minRatio: zoomMinRatio,
        toggle: readBool(props.zoomToggle, true),
      } : false,
      virtual: virtualEnabled ? { enabled: true } : false,
      parallax: parallaxEnabled,
      hashNavigation: readBool(props.hashNavigationEnabled, false) ? {
        watchState: readBool(props.hashNavigationWatchState, true),
        replaceState: readBool(props.hashNavigationReplaceState, false),
      } : false,
      history: false,
      coverflowEffect: { rotate: effectRotate, depth: effectDepth, modifier: effectModifier, slideShadows: effectShadows },
      cubeEffect: { shadow: effectShadows, slideShadows: effectShadows, shadowOffset: 20, shadowScale: 0.94 },
      flipEffect: { slideShadows: effectShadows, limitRotation: true },
      cardsEffect: { slideShadows: effectShadows, rotate: true, perSlideOffset: 8, perSlideRotate: 2 },
      creativeEffect: {
        limitProgress: 3,
        prev: { translate: ['-120%', 0, -effectDepth], rotate: [0, 0, -effectRotate] },
        next: { translate: ['120%', 0, -effectDepth], rotate: [0, 0, effectRotate] }
      },
      autoplay: delay > 0 ? {
        delay: delay,
        disableOnInteraction: readBool(props.autoplayDisableOnInteraction, false),
        pauseOnMouseEnter: readBool(props.autoplayPauseOnMouseEnter, true),
        reverseDirection: readBool(props.autoplayReverseDirection, false),
        stopOnLastSlide: readBool(props.autoplayStopOnLastSlide, false),
      } : false,
      pagination: readBool(props.paginationEnabled, true)
        ? { el: swiperNode.querySelector('.swiper-pagination'), clickable: readBool(props.paginationClickable, true), type: readEnum(props.paginationType, ['bullets', 'fraction', 'progressbar'], 'bullets') }
        : false,
      navigation: readBool(props.navigationEnabled, false)
        ? { nextEl: swiperNode.querySelector('.swiper-button-next'), prevEl: swiperNode.querySelector('.swiper-button-prev'), hideOnClick: readBool(props.navigationHideOnClick, false) }
        : false,
      scrollbar: readBool(props.scrollbarEnabled, false)
        ? {
          el: swiperNode.querySelector('.swiper-scrollbar'),
          draggable: readBool(props.scrollbarDraggable, true),
          hide: readBool(props.scrollbarHide, false),
          snapOnRelease: readBool(props.scrollbarSnapOnRelease, true),
        }
        : false,
      autoHeight: readBool(props.autoHeight, false),
      grabCursor: readBool(props.grabCursor, false),
      cssMode: cssMode,
      grid: { rows: effect === 'slide' ? gridRows : 1, fill: 'row' },
      allowTouchMove: readBool(props.allowTouchMove, true),
      simulateTouch: readBool(props.simulateTouch, true),
      touchRatio: Math.max(0, Math.min(5, readNumber(props.touchRatio, 1))),
      touchAngle: Math.max(0, Math.min(90, readNumber(props.touchAngle, 45))),
      threshold: Math.max(0, Math.min(100, readNumber(props.threshold, 5))),
      watchOverflow: true,
      on: {
        init: scheduleSlotPublishing,
        beforeTransitionStart: scheduleSlotPublishing,
        transitionStart: scheduleSlotPublishing,
        setTranslate: publishSlots,
        progress: publishSlots,
        sliderMove: publishSlots,
        touchMove: publishSlots,
        touchEnd: scheduleSlotPublishing,
        slideChange: scheduleSlotPublishing,
        transitionEnd: scheduleSlotPublishing,
        reachBeginning: scheduleSlotPublishing,
        reachEnd: scheduleSlotPublishing,
        snapGridLengthChange: scheduleSlotPublishing,
        slidesGridLengthChange: scheduleSlotPublishing,
        resize: scheduleSlotPublishing,
        observerUpdate: scheduleSlotPublishing,
        autoplayStart: scheduleSlotPublishing,
        autoplayStop: scheduleSlotPublishing,
        autoplayPause: scheduleSlotPublishing,
        autoplayResume: scheduleSlotPublishing,
      },
    });
    if (delay > 0 && swiper.autoplay && typeof swiper.autoplay.start === 'function') {
      swiper.autoplay.start();
    }
    scheduleSlotPublishing();
  }

  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type !== 'ravium:module-render') return;

    payload = data.payload || {};
    try {
      render();
    } catch (error) {
      window.parent.postMessage({
        type: 'ravium:module-error',
        message: error && error.message ? error.message : String(error),
      }, '*');
    }
  });

  window.addEventListener('beforeunload', destroySwiper);
})();
</script>
</body>
</html>

`;

const swiperCarouselSource = (): string => `<template>
  <Swiper
    :class="['ravium-swiper-carousel', styleMode === 'ravium' ? 'ravium-swiper-carousel--ravium' : 'ravium-swiper-carousel--swiper']"
    :modules="modules"
    :slides-per-view="normalizedSlidesPerView"
    :slides-per-group="normalizedSlidesPerGroup"
    :direction="direction"
    :pagination="paginationConfig"
    :navigation="navigationConfig"
    :scrollbar="scrollbarConfig"
    :autoplay="autoplayConfig"
    :space-between="normalizedSpaceBetween"
    :loop="loopConfig"
    :rewind="rewindConfig"
    :centered-slides="centeredSlides"
    :free-mode="freeModeConfig"
    :mousewheel="mousewheelConfig"
    :keyboard="keyboardConfig"
    :a11y="a11yConfig"
    :zoom="zoomConfig"
    :virtual="virtualConfig"
    :parallax="parallaxEnabled"
    :hash-navigation="hashNavigationConfig"
    :history="historyConfig"
    :effect="normalizedEffect"
    :coverflow-effect="coverflowEffectConfig"
    :cube-effect="cubeEffectConfig"
    :flip-effect="flipEffectConfig"
    :cards-effect="cardsEffectConfig"
    :creative-effect="creativeEffectConfig"
    :speed="normalizedSpeed"
    :auto-height="autoHeight"
    :grab-cursor="grabCursor"
    :css-mode="cssMode"
    :grid="gridConfig"
    :allow-touch-move="allowTouchMove"
    :simulate-touch="simulateTouch"
    :touch-ratio="touchRatio"
    :touch-angle="touchAngle"
    :threshold="threshold"
    :watch-overflow="true"
  >
    <SwiperSlide
      v-for="(slide, index) in normalizedSlides"
      :key="slide.id || index"
      :virtual-index="virtualEnabled ? index : undefined"
      :data-hash="slide.hash || slide.id || \`slide-\${index + 1}\`"
      :data-history="slide.hash || slide.id || \`slide-\${index + 1}\`"
    >
      <div :class="zoomEnabled ? 'swiper-zoom-container' : 'ravium-swiper-carousel__zoomless'">
        <article
          class="ravium-swiper-carousel__slide"
          :style="slideStyle"
          :data-swiper-parallax="parallaxEnabled ? parallaxOffset : undefined"
        >
          <img
            v-if="slide.type === 'image' && imageSource(slide)"
            class="ravium-swiper-carousel__image"
            :src="imageSource(slide)"
            :alt="slide.alt || slide.caption || ''"
            :style="{ objectFit: imageFit }"
          />
          <slot
            v-else-if="slide.type === 'component'"
            :name="componentSlotName(slide, index)"
          >
            <div class="ravium-swiper-carousel__empty">Component slot is empty</div>
          </slot>
          <div v-else class="ravium-swiper-carousel__empty">Empty slide</div>
          <footer v-if="slide.caption" class="ravium-swiper-carousel__caption" :style="captionStyle">
            {{ slide.caption }}
          </footer>
        </article>
      </div>
    </SwiperSlide>
  </Swiper>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import {
  A11y,
  Autoplay,
  EffectCards,
  EffectCoverflow,
  EffectCreative,
  EffectCube,
  EffectFade,
  EffectFlip,
  FreeMode,
  Grid,
  HashNavigation,
  History,
  Keyboard,
  Mousewheel,
  Navigation,
  Pagination,
  Parallax,
  Scrollbar,
  Virtual,
  Zoom,
} from 'swiper/modules';
import 'swiper/css';

type SlideConfig = {
  id?: string;
  slotName?: string;
  type?: 'image' | 'component';
  image?: string;
  imageAssetId?: string;
  imageUrl?: string;
  src?: string;
  alt?: string;
  componentId?: string;
  componentName?: string;
  componentProps?: Record<string, unknown>;
  caption?: string;
  hash?: string;
};

type SwiperEffect = 'slide' | 'fade' | 'cube' | 'coverflow' | 'flip' | 'cards' | 'creative';
type PaginationType = 'bullets' | 'fraction' | 'progressbar';

const props = withDefaults(
  defineProps<{
    paginationEnabled?: boolean;
    paginationType?: PaginationType;
    paginationClickable?: boolean;
    navigationEnabled?: boolean;
    navigationHideOnClick?: boolean;
    scrollbarEnabled?: boolean;
    scrollbarDraggable?: boolean;
    scrollbarHide?: boolean;
    scrollbarSnapOnRelease?: boolean;
    styleMode?: 'swiper' | 'ravium';
    autoplayDelayMs?: number;
    autoplayDisableOnInteraction?: boolean;
    autoplayPauseOnMouseEnter?: boolean;
    autoplayReverseDirection?: boolean;
    autoplayStopOnLastSlide?: boolean;
    slidesPerView?: number;
    slidesPerGroup?: number;
    direction?: 'horizontal' | 'vertical';
    loopEnabled?: boolean;
    rewindEnabled?: boolean;
    centeredSlides?: boolean;
    freeModeEnabled?: boolean;
    freeModeMomentum?: boolean;
    freeModeMomentumRatio?: number;
    freeModeSticky?: boolean;
    mousewheelEnabled?: boolean;
    mousewheelForceToAxis?: boolean;
    mousewheelInvert?: boolean;
    mousewheelSensitivity?: number;
    keyboardEnabled?: boolean;
    keyboardOnlyInViewport?: boolean;
    keyboardPageUpDown?: boolean;
    a11yEnabled?: boolean;
    zoomEnabled?: boolean;
    zoomMaxRatio?: number;
    zoomMinRatio?: number;
    zoomToggle?: boolean;
    virtualEnabled?: boolean;
    parallaxEnabled?: boolean;
    parallaxOffset?: string;
    hashNavigationEnabled?: boolean;
    hashNavigationWatchState?: boolean;
    hashNavigationReplaceState?: boolean;
    historyEnabled?: boolean;
    historyKey?: string;
    historyReplaceState?: boolean;
    historyKeepQuery?: boolean;
    effect?: SwiperEffect;
    effectRotate?: number;
    effectDepth?: number;
    effectModifier?: number;
    effectShadows?: boolean;
    speed?: number;
    autoHeight?: boolean;
    grabCursor?: boolean;
    cssMode?: boolean;
    gridRows?: number;
    allowTouchMove?: boolean;
    simulateTouch?: boolean;
    touchRatio?: number;
    touchAngle?: number;
    threshold?: number;
    slides?: SlideConfig[];
    spaceBetween?: number;
    slideBackgroundColor?: string;
    slideBorderRadius?: string;
    slideBorderWidth?: string;
    slideBorderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
    slideBorderColor?: string;
    slidePadding?: string;
    captionColor?: string;
    captionPadding?: string;
    captionFontSize?: string;
    captionFontWeight?: string;
    imageFit?: 'cover' | 'contain';
  }>(),
  {
    paginationEnabled: true,
    paginationType: 'bullets',
    paginationClickable: true,
    navigationEnabled: false,
    navigationHideOnClick: false,
    scrollbarEnabled: false,
    scrollbarDraggable: true,
    scrollbarHide: false,
    scrollbarSnapOnRelease: true,
    styleMode: 'swiper',
    autoplayDelayMs: 3000,
    autoplayDisableOnInteraction: false,
    autoplayPauseOnMouseEnter: true,
    autoplayReverseDirection: false,
    autoplayStopOnLastSlide: false,
    slidesPerView: 1,
    slidesPerGroup: 1,
    direction: 'horizontal',
    loopEnabled: true,
    rewindEnabled: false,
    centeredSlides: false,
    freeModeEnabled: false,
    freeModeMomentum: true,
    freeModeMomentumRatio: 1,
    freeModeSticky: false,
    mousewheelEnabled: false,
    mousewheelForceToAxis: false,
    mousewheelInvert: false,
    mousewheelSensitivity: 1,
    keyboardEnabled: false,
    keyboardOnlyInViewport: true,
    keyboardPageUpDown: true,
    a11yEnabled: true,
    zoomEnabled: false,
    zoomMaxRatio: 3,
    zoomMinRatio: 1,
    zoomToggle: true,
    virtualEnabled: false,
    parallaxEnabled: false,
    parallaxOffset: '-18%',
    hashNavigationEnabled: false,
    hashNavigationWatchState: true,
    hashNavigationReplaceState: false,
    historyEnabled: false,
    historyKey: 'slides',
    historyReplaceState: false,
    historyKeepQuery: false,
    effect: 'slide',
    effectRotate: 50,
    effectDepth: 100,
    effectModifier: 1,
    effectShadows: true,
    speed: 420,
    autoHeight: false,
    grabCursor: false,
    cssMode: false,
    gridRows: 1,
    allowTouchMove: true,
    simulateTouch: true,
    touchRatio: 1,
    touchAngle: 45,
    threshold: 5,
    slides: () => [],
    spaceBetween: 16,
    slideBackgroundColor: '#ffffff',
    slideBorderRadius: '8px',
    slideBorderWidth: '1px',
    slideBorderStyle: 'solid',
    slideBorderColor: '#e5e7eb',
    slidePadding: '0px',
    captionColor: '#374151',
    captionPadding: '10px',
    captionFontSize: '14px',
    captionFontWeight: '400',
    imageFit: 'cover',
  },
);

const normalizedSlidesPerView = computed(() => Math.max(1, Math.min(8, Math.round(Number(props.slidesPerView) || 1))));
const normalizedSlidesPerGroup = computed(() => Math.max(1, Math.min(8, Math.round(Number(props.slidesPerGroup) || 1))));
const normalizedSpaceBetween = computed(() => Math.max(0, Math.min(160, Math.round(Number(props.spaceBetween) || 0))));
const normalizedSpeed = computed(() => Math.max(0, Math.min(10000, Math.round(Number(props.speed) || 0))));
const normalizedSlides = computed(() => props.slides.length > 0 ? props.slides : [{ type: 'image', caption: 'Add slides in component settings' }]);
const hasComponentSlides = computed(() => normalizedSlides.value.some((slide) => slide.type === 'component'));
const normalizedEffect = computed<SwiperEffect>(() => {
  const effect = props.effect;
  if (props.cssMode || props.direction === 'vertical') {
    return 'slide';
  }
  return ['slide', 'fade', 'cube', 'coverflow', 'flip', 'cards', 'creative'].includes(effect) ? effect : 'slide';
});
const paginationConfig = computed(() =>
  props.paginationEnabled
    ? {
        clickable: props.paginationClickable,
        type: props.paginationType,
      }
    : false,
);
const navigationConfig = computed(() =>
  props.navigationEnabled
    ? {
        hideOnClick: props.navigationHideOnClick,
      }
    : false,
);
const scrollbarConfig = computed(() =>
  props.scrollbarEnabled
    ? {
        draggable: props.scrollbarDraggable,
        hide: props.scrollbarHide,
        snapOnRelease: props.scrollbarSnapOnRelease,
      }
    : false,
);
const autoplayConfig = computed(() => {
  const delay = Math.max(0, Math.round(Number(props.autoplayDelayMs) || 0));
  return delay > 0
    ? {
        delay,
        disableOnInteraction: props.autoplayDisableOnInteraction,
        pauseOnMouseEnter: props.autoplayPauseOnMouseEnter,
        reverseDirection: props.autoplayReverseDirection,
        stopOnLastSlide: props.autoplayStopOnLastSlide,
      }
    : false;
});
const loopConfig = computed(() => props.loopEnabled && !hasComponentSlides.value && normalizedSlides.value.length > normalizedSlidesPerView.value && normalizedEffect.value !== 'fade');
const rewindConfig = computed(() => props.rewindEnabled && !loopConfig.value);
const freeModeConfig = computed(() =>
  props.freeModeEnabled
    ? {
        enabled: true,
        momentum: props.freeModeMomentum,
        momentumRatio: Math.max(0, Math.min(5, Number(props.freeModeMomentumRatio) || 1)),
        sticky: props.freeModeSticky,
      }
    : false,
);
const mousewheelConfig = computed(() =>
  props.mousewheelEnabled
    ? {
        enabled: true,
        forceToAxis: props.mousewheelForceToAxis,
        invert: props.mousewheelInvert,
        sensitivity: Math.max(0.1, Math.min(10, Number(props.mousewheelSensitivity) || 1)),
      }
    : false,
);
const keyboardConfig = computed(() =>
  props.keyboardEnabled
    ? {
        enabled: true,
        onlyInViewport: props.keyboardOnlyInViewport,
        pageUpDown: props.keyboardPageUpDown,
      }
    : false,
);
const a11yConfig = computed(() => props.a11yEnabled ? { enabled: true } : false);
const zoomConfig = computed(() => {
  if (!props.zoomEnabled) {
    return false;
  }
  const minRatio = Math.max(1, Math.min(10, Number(props.zoomMinRatio) || 1));
  return {
    maxRatio: Math.max(minRatio, Math.min(10, Number(props.zoomMaxRatio) || 3)),
    minRatio,
    toggle: props.zoomToggle,
  };
});
const virtualConfig = computed(() => props.virtualEnabled);
const hashNavigationConfig = computed(() =>
  props.hashNavigationEnabled
    ? {
        watchState: props.hashNavigationWatchState,
        replaceState: props.hashNavigationReplaceState,
      }
    : false,
);
const historyConfig = computed(() =>
  props.historyEnabled
    ? {
        enabled: true,
        key: props.historyKey || 'slides',
        replaceState: props.historyReplaceState,
        keepQuery: props.historyKeepQuery,
      }
    : false,
);
const gridConfig = computed(() => {
  const rows = Math.max(1, Math.min(4, Math.round(Number(props.gridRows) || 1)));
  return { rows: normalizedEffect.value === 'slide' ? rows : 1, fill: 'row' as const };
});
const modules = computed(() => {
  const active: Array<typeof A11y> = [];
  if (autoplayConfig.value) {
    active.push(Autoplay);
  }
  if (paginationConfig.value) {
    active.push(Pagination);
  }
  if (navigationConfig.value) {
    active.push(Navigation);
  }
  if (scrollbarConfig.value) {
    active.push(Scrollbar);
  }
  if (freeModeConfig.value) {
    active.push(FreeMode);
  }
  if (mousewheelConfig.value) {
    active.push(Mousewheel);
  }
  if (keyboardConfig.value) {
    active.push(Keyboard);
  }
  if (a11yConfig.value) {
    active.push(A11y);
  }
  if (zoomConfig.value) {
    active.push(Zoom);
  }
  if (virtualConfig.value) {
    active.push(Virtual);
  }
  if (props.parallaxEnabled) {
    active.push(Parallax);
  }
  if (hashNavigationConfig.value) {
    active.push(HashNavigation);
  }
  if (historyConfig.value) {
    active.push(History);
  }
  if (gridConfig.value.rows > 1) {
    active.push(Grid);
  }

  switch (normalizedEffect.value) {
    case 'fade':
      active.push(EffectFade);
      break;
    case 'cube':
      active.push(EffectCube);
      break;
    case 'coverflow':
      active.push(EffectCoverflow);
      break;
    case 'flip':
      active.push(EffectFlip);
      break;
    case 'cards':
      active.push(EffectCards);
      break;
    case 'creative':
      active.push(EffectCreative);
      break;
  }

  return active;
});
const effectRotate = computed(() => Math.max(0, Math.min(360, Number(props.effectRotate) || 50)));
const effectDepth = computed(() => Math.max(0, Math.min(1000, Number(props.effectDepth) || 100)));
const effectModifier = computed(() => Math.max(0, Math.min(5, Number(props.effectModifier) || 1)));
const coverflowEffectConfig = computed(() => ({
  rotate: effectRotate.value,
  depth: effectDepth.value,
  modifier: effectModifier.value,
  slideShadows: props.effectShadows,
}));
const cubeEffectConfig = computed(() => ({
  shadow: props.effectShadows,
  slideShadows: props.effectShadows,
  shadowOffset: 20,
  shadowScale: 0.94,
}));
const flipEffectConfig = computed(() => ({
  slideShadows: props.effectShadows,
  limitRotation: true,
}));
const cardsEffectConfig = computed(() => ({
  slideShadows: props.effectShadows,
  rotate: true,
  perSlideOffset: 8,
  perSlideRotate: 2,
}));
const creativeEffectConfig = computed(() => ({
  limitProgress: 3,
  prev: { translate: ['-120%', 0, -effectDepth.value], rotate: [0, 0, -effectRotate.value] },
  next: { translate: ['120%', 0, -effectDepth.value], rotate: [0, 0, effectRotate.value] },
}));

const slideStyle = computed(() => ({
  backgroundColor: props.slideBackgroundColor,
  borderColor: props.slideBorderColor,
  borderRadius: props.slideBorderRadius,
  borderStyle: props.slideBorderStyle,
  borderWidth: props.slideBorderWidth,
  padding: props.slidePadding,
}));
const captionStyle = computed(() => ({
  color: props.captionColor,
  fontSize: props.captionFontSize,
  fontWeight: props.captionFontWeight,
  padding: props.captionPadding,
}));
const imageFit = computed(() => props.imageFit === 'contain' ? 'contain' : 'cover');

const imageSource = (slide: SlideConfig): string => {
  const raw = slide.image || slide.imageUrl || slide.src || (slide.imageAssetId ? \`/assets/\${slide.imageAssetId}\` : '');
  if (!raw.trim().startsWith('{')) {
    return raw;
  }
  try {
    const parsed = JSON.parse(raw) as { full?: { url?: string }; small?: { url?: string } };
    return parsed.full?.url || parsed.small?.url || raw;
  } catch {
    return raw;
  }
};
const slotNamePart = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const componentSlotName = (slide: SlideConfig, index: number): string => {
  if (slide.slotName) {
    return slide.slotName;
  }
  const base = slide.id || \`slide-\${index + 1}\`;
  return \`ravium-slot-\${slotNamePart(base) || 'slide'}\`;
};
</script>

`;

const metricCardSource =
  (): string => `<template><section class="ravium-module-kitchen-sink"><strong>{{ title }}</strong><span>{{ value }}</span></section></template>
<script setup lang="ts">
defineProps<{ title?: string; value?: string }>();
</script>
`;

const leadFormSource =
  (): string => `<template><form class="ravium-module-kitchen-sink"><input name="email" type="email" /><button type="submit">Send</button></form></template>
`;

const sendEventSource = (): string => `export async function run(input, ctx) {
  const eventId = ctx.id?.() || crypto.randomUUID();
  await ctx.storage?.insert?.('events', { id: eventId, eventName: input.eventName, payload: input.payload || {} });
  return { ok: true, eventId };
}
`;

const routePageSource =
  (): string => `<template><main class="ravium-module-kitchen-sink">Kitchen Sink Route</main></template>
`;

const routePostSource = (): string => `export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return { ok: true, eventName: body?.eventName || 'unknown' };
});
`;
