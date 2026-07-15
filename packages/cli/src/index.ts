import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
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
  template: 'basic' | 'kitchen-sink';
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

export interface AiBridgeConnectOptions {
  cwd: string;
  apiUrl: string;
  pairingCode: string;
  workspaceName?: string;
}

export interface AiBridgeConnectResult {
  sessionID: string;
  projectID: string;
  workspaceName: string;
  expiresAt: string;
  token: string;
}

interface DeveloperModuleSummary {
  id: string;
  namespace: string;
  slug: string;
}

interface CatalogModuleSummary {
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
  await writeFile(
    path.join(moduleDir, 'ravium.module.mjs'),
    moduleFrameworkSource(manifest),
    'utf8',
  );
  await writeJSON(path.join(moduleDir, 'ravium.module.json'), manifest);
  await writeJSON(path.join(moduleDir, 'ravium.module-lock.json'), await buildDependencyReport(moduleDir, manifest));
  await writeFile(path.join(moduleDir, 'README.md'), readmeFor(manifest, options.template), 'utf8');
  await writeFile(
    path.join(moduleDir, 'CHANGELOG.md'),
    `# Changelog\n\n## ${manifest.version}\n\n- Initial module.\n`,
    'utf8',
  );
  await writeFile(path.join(moduleDir, 'src/editor.ts'), editorSource(options.template), 'utf8');
  await writeFile(path.join(moduleDir, 'src/editor-dashboard.html'), editorDashboardSource(), 'utf8');
  await writeFile(path.join(moduleDir, 'src/project-settings.html'), projectSettingsSource(), 'utf8');
  await writeFile(path.join(moduleDir, 'src/runtime-client.ts'), runtimeClientSource(options.template), 'utf8');
  await writeFile(path.join(moduleDir, 'src/runtime-server.ts'), runtimeServerSource(options.template), 'utf8');
  await writeFile(path.join(moduleDir, 'src/styles.css'), stylesSource(options.template, manifest.slug), 'utf8');
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
  const runtimeSupportPaths = new Set(collectRuntimeSupportFiles(manifest).map((file) => file.path));
  const referencedFiles = await collectBuildFiles(cwd, manifest);
  for (const file of referencedFiles) {
    if (runtimeSupportPaths.has(file)) {
      continue;
    }
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

  const runtimeSupportFiles = collectRuntimeSupportFiles(manifest);
  const runtimeSupportPaths = new Set(runtimeSupportFiles.map((file) => file.path));
  const filesToCopy = (await collectBuildFiles(cwd, manifest)).filter((file) => !runtimeSupportPaths.has(file));
  const copiedFiles: string[] = [];
  for (const file of filesToCopy) {
    const targetFile = artifactFileName(file);
    await copyFile(path.resolve(cwd, file), path.join(artifactRoot, targetFile));
    copiedFiles.push(targetFile);
  }
  for (const file of runtimeSupportFiles) {
    const targetFile = artifactFileName(file.path);
    await writeFile(path.join(artifactRoot, targetFile), file.content);
    if (!copiedFiles.includes(targetFile)) {
      copiedFiles.push(targetFile);
    }
  }

  const runtimeComponentBundles = await buildRuntimeComponentBundles(cwd, artifactRoot, manifest);
  for (const file of runtimeComponentBundles.files) {
    if (!copiedFiles.includes(file)) {
      copiedFiles.push(file);
    }
  }

  const sizeReport = await buildSizeReport(cwd, artifactRoot, copiedFiles, manifest.dependencies);
  const dependencyReport = await buildDependencyReport(cwd, manifest);
  const checksums = await buildChecksums(artifactRoot, copiedFiles);
  const artifactRefs = await buildArtifactRefs(
    cwd,
    manifest,
    filesToCopy,
    copiedFiles,
    runtimeSupportFiles,
    runtimeComponentBundles.refs,
  );
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
    (await resolvePublishModuleID({
      apiUrl,
      headers,
      namespace: build.manifest.namespace,
      slug: build.manifest.slug,
      name: build.manifest.name,
      description: build.manifest.description,
      tags: build.manifest.tags,
    }));

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

const resolvePublishModuleID = async (options: {
  apiUrl: string;
  headers: Record<string, string>;
  namespace: string;
  slug: string;
  name: string;
  description: string;
  tags: string[];
}): Promise<string> => {
  try {
    return (
      await apiRequest<{ module: { id: string } }>({
        method: 'POST',
        url: `${options.apiUrl}/modules/developer/modules`,
        headers: options.headers,
        body: {
          namespace: options.namespace,
          slug: options.slug,
          name: options.name,
          description: options.description,
          tags: options.tags,
        },
      })
    ).module.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('module namespace and slug already exist')) {
      throw error;
    }
    const detail = await apiRequest<{ module: CatalogModuleSummary }>({
      method: 'GET',
      url: `${options.apiUrl}/modules/${encodeURIComponent(options.namespace)}/${encodeURIComponent(options.slug)}`,
      headers: options.headers,
    });
    return detail.module.id;
  }
};

export const connectAiBridge = async (options: AiBridgeConnectOptions): Promise<AiBridgeConnectResult> => {
  const apiUrl = options.apiUrl.trim().replace(/\/+$/, '');
  const pairingCode = options.pairingCode.trim();
  if (!apiUrl) {
    throw new Error('--api-url or RAVIUM_API_URL is required');
  }
  if (!pairingCode) {
    throw new Error('pairing code is required');
  }
  const workspaceName = (options.workspaceName || path.basename(path.resolve(options.cwd)) || 'local-module').trim();
  const response = await apiRequest<{
    token?: string;
    session?: {
      id?: string;
      projectId?: string;
      workspaceName?: string;
      expiresAt?: string;
    };
  }>({
    method: 'POST',
    url: `${apiUrl}/ai/bridge/connect`,
    body: {
      pairingCode,
      workspaceName,
    },
  });
  if (!response.token || !response.session?.id) {
    throw new Error('bridge connect response is invalid');
  }
  return {
    sessionID: response.session.id,
    projectID: response.session.projectId || '',
    workspaceName: response.session.workspaceName || workspaceName,
    expiresAt: response.session.expiresAt || '',
    token: response.token,
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

const sourceImportExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.json', '.css', '.html'];

const collectBuildFiles = async (cwd: string, manifest: RaviumModuleManifest): Promise<string[]> => {
  const files = new Set(collectReferencedFiles(manifest));
  const queue = [...files];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !shouldIncludeSourceSnapshot(current)) {
      continue;
    }
    const absolute = path.resolve(cwd, current);
    let source = '';
    try {
      source = await readFile(absolute, 'utf8');
    } catch {
      continue;
    }
    for (const specifier of collectLocalImportSpecifiers(source)) {
      const resolved = await resolveLocalImport(cwd, current, specifier);
      if (resolved && !files.has(resolved)) {
        files.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...files].sort();
};

const collectLocalImportSpecifiers = (source: string): string[] => {
  const specifiers = new Set<string>();
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier?.startsWith('.')) {
        specifiers.add(specifier);
      }
    }
  }
  return [...specifiers].sort();
};

const resolveLocalImport = async (cwd: string, importer: string, specifier: string): Promise<string | null> => {
  const importerDir = path.dirname(importer);
  const base = path.resolve(cwd, importerDir, specifier);
  const candidates = path.extname(base)
    ? [base]
    : [...sourceImportExtensions.map((extension) => `${base}${extension}`), ...sourceImportExtensions.map((extension) => path.join(base, `index${extension}`))];
  for (const candidate of candidates) {
    const relative = path.relative(cwd, candidate).replaceAll('\\', '/');
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      continue;
    }
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) {
        return relative;
      }
    } catch {
      // Keep trying other extension candidates.
    }
  }
  return null;
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

interface RuntimeComponentBundleReference {
  componentType: string;
  renderer: string;
  key: string;
  format: 'iife-vue-global';
  globalName: string;
  artifact: string;
  source: string;
  cssArtifact?: string;
  css?: string;
}

interface RuntimeComponentBundleBuildResult {
  files: string[];
  refs: Record<string, RuntimeComponentBundleReference>;
}

const normalizeRuntimeGlobalNamePart = (value: string): string =>
  value
    .trim()
    .replace(/[^A-Za-z0-9_$]+/g, '_')
    .replace(/^([^A-Za-z_$])/, '_$1') || 'Module';

const runtimeComponentBundleKey = (manifest: RaviumModuleManifest, componentType: string): string =>
  `${manifest.namespace}/${manifest.slug}/${componentType}`;

const runtimeComponentBundleBaseName = (
  manifest: RaviumModuleManifest,
  componentType: string,
  renderer: string,
): string => {
  const hash = createHash('sha256')
    .update(`${manifest.namespace}/${manifest.slug}/${manifest.version}/${componentType}/${renderer}`)
    .digest('hex')
    .slice(0, 10);
  const typePart = componentType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'component';
  return `runtime-component-${typePart}-${hash}`;
};

const runtimeComponentGlobalName = (manifest: RaviumModuleManifest, componentType: string, renderer: string): string =>
  `RaviumModule_${normalizeRuntimeGlobalNamePart(manifest.namespace)}_${normalizeRuntimeGlobalNamePart(
    manifest.slug,
  )}_${normalizeRuntimeGlobalNamePart(componentType)}_${createHash('sha256').update(renderer).digest('hex').slice(0, 8)}`;

const isRuntimeComponentBundleCandidate = (renderer: string): boolean => {
  if (!renderer || /\.html?$/i.test(renderer)) {
    return false;
  }
  return ['.vue', '.js', '.mjs', '.ts', '.tsx', '.jsx'].includes(path.extname(renderer).toLowerCase());
};

const collectRuntimeComponentBundleEntries = (
  manifest: RaviumModuleManifest,
): Array<{ componentType: string; renderer: string }> => {
  const entries = new Map<string, { componentType: string; renderer: string }>();
  for (const component of manifest.components) {
    const componentType = readString(component.type);
    const renderer = readString(component.runtimeRenderer);
    if (!componentType || !isRuntimeComponentBundleCandidate(renderer)) {
      continue;
    }
    entries.set(runtimeComponentBundleKey(manifest, componentType), { componentType, renderer });
  }
  return [...entries.values()].sort((left, right) => left.componentType.localeCompare(right.componentType));
};

const readDirectoryFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readDirectoryFiles(entryPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
};

const buildRuntimeComponentBundleEntrySource = (
  componentFileUrl: string,
  registryKey: string,
): string => `import Component from ${JSON.stringify(componentFileUrl)};

const runtimeGlobal = globalThis.__RAVIUM_MODULE_RUNTIME__ || (globalThis.__RAVIUM_MODULE_RUNTIME__ = {});
const registry = runtimeGlobal.components || (runtimeGlobal.components = {});
registry[${JSON.stringify(registryKey)}] = Component;
export default Component;
`;

const buildRuntimeComponentBundles = async (
  cwd: string,
  artifactRoot: string,
  manifest: RaviumModuleManifest,
): Promise<RuntimeComponentBundleBuildResult> => {
  const entries = collectRuntimeComponentBundleEntries(manifest);
  if (entries.length === 0) {
    return { files: [], refs: {} };
  }

  const [{ build }, vuePluginModule] = await Promise.all([
    import('vite'),
    import('@vitejs/plugin-vue'),
  ]);
  const vuePlugin = vuePluginModule.default;
  const files: string[] = [];
  const refs: Record<string, RuntimeComponentBundleReference> = {};

  for (const entry of entries) {
    const rendererPath = path.resolve(cwd, entry.renderer);
    await assertFileExists(rendererPath, entry.renderer);

    const registryKey = runtimeComponentBundleKey(manifest, entry.componentType);
    const fileBase = runtimeComponentBundleBaseName(manifest, entry.componentType, entry.renderer);
    const globalName = runtimeComponentGlobalName(manifest, entry.componentType, entry.renderer);
    const tmpRoot = await mkdtemp(path.join(tmpdir(), 'ravium-runtime-component-'));
    try {
      const entryPath = path.join(tmpRoot, 'entry.js');
      await writeFile(
        entryPath,
        buildRuntimeComponentBundleEntrySource(pathToFileURL(rendererPath).href, registryKey),
        'utf8',
      );

      await build({
        configFile: false,
        root: cwd,
        logLevel: 'silent',
        plugins: [vuePlugin()],
        build: {
          outDir: tmpRoot,
          emptyOutDir: false,
          minify: false,
          sourcemap: false,
          cssCodeSplit: false,
          lib: {
            entry: entryPath,
            name: globalName,
            formats: ['iife'],
            fileName: () => `${fileBase}.js`,
          },
          rollupOptions: {
            external: ['vue'],
            output: {
              globals: {
                vue: '__RAVIUM_MODULE_RUNTIME__.vue',
              },
              inlineDynamicImports: true,
              entryFileNames: `${fileBase}.js`,
              assetFileNames: `${fileBase}.[name][extname]`,
            },
          },
        },
      });

      const outputFiles = (await readDirectoryFiles(tmpRoot)).filter((file) => file !== entryPath);
      const jsFile = outputFiles.find((file) => path.basename(file) === `${fileBase}.js`);
      if (!jsFile) {
        throw new Error(`runtime component bundle was not emitted for ${entry.componentType}`);
      }

      const jsArtifactName = `${fileBase}.js`;
      const source = await readFile(jsFile, 'utf8');
      await writeFile(path.join(artifactRoot, jsArtifactName), source, 'utf8');
      files.push(jsArtifactName);

      const cssFile = outputFiles.find((file) => path.extname(file).toLowerCase() === '.css');
      let cssArtifactName: string | undefined;
      let cssSource: string | undefined;
      if (cssFile) {
        cssArtifactName = `${fileBase}.css`;
        cssSource = await readFile(cssFile, 'utf8');
        await writeFile(path.join(artifactRoot, cssArtifactName), cssSource, 'utf8');
        files.push(cssArtifactName);
      }

      refs[registryKey] = {
        componentType: entry.componentType,
        renderer: entry.renderer,
        key: registryKey,
        format: 'iife-vue-global',
        globalName,
        artifact: `artifact://${manifest.namespace}/${manifest.slug}/${manifest.version}/${jsArtifactName}`,
        source,
        ...(cssArtifactName && cssSource
          ? {
              cssArtifact: `artifact://${manifest.namespace}/${manifest.slug}/${manifest.version}/${cssArtifactName}`,
              css: cssSource,
            }
          : {}),
      };
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  }

  return { files, refs };
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
    if (key === 'runtimeSupportFiles') {
      continue;
    }
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
  sourceFilesToCopy: string[],
  copiedFiles: string[],
  runtimeSupportFiles: RuntimeSupportFile[] = collectRuntimeSupportFiles(manifest),
  runtimeComponentBundles: Record<string, RuntimeComponentBundleReference> = {},
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
  const sourceFileAliases: Record<string, string> = {};
  for (const file of sourceFilesToCopy) {
    const artifactName = artifactFileName(file);
    if (!copiedFiles.includes(artifactName) || !shouldIncludeSourceSnapshot(file)) {
      continue;
    }
    const source = await readFile(path.resolve(cwd, file), 'utf8');
    sourceFiles[file] = source;
    if (artifactName !== file) {
      sourceFiles[artifactName] = source;
      sourceFileAliases[artifactName] = file;
    }
  }
  addRuntimeSupportSourceFiles(runtimeSupportFiles, sourceFiles, sourceFileAliases);
  if (Object.keys(sourceFiles).length > 0) {
    refs.sourceFiles = sourceFiles;
  }
  if (Object.keys(sourceFileAliases).length > 0) {
    refs.sourceFileAliases = sourceFileAliases;
  }
  if (Object.keys(runtimeComponentBundles).length > 0) {
    refs.runtimeComponentBundles = runtimeComponentBundles;
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
    const source = sourceFiles[runtimeHandler] || sourceFiles[artifactName] || (await readFile(path.resolve(cwd, runtimeHandler), 'utf8'));
    functionHandlers[id] = {
      sourceFile: runtimeHandler,
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

interface RuntimeSupportFile {
  path: string;
  content: string;
}

const collectRuntimeSupportFiles = (
  manifest: RaviumModuleManifest,
): RuntimeSupportFile[] => {
  const supportFiles = readArrayRecords(manifest.capabilities?.runtimeSupportFiles);
  const deduped = new Map<string, string>();
  for (const file of supportFiles) {
    const filePath = readString(file.path);
    const content = typeof file.content === 'string' ? file.content : '';
    if (!filePath || !content || !looksLikeLocalReferencedFile(filePath)) {
      continue;
    }
    deduped.set(filePath, content);
  }
  return [...deduped.entries()].map(([filePath, content]) => ({ path: filePath, content }));
};

const addRuntimeSupportSourceFiles = (
  supportFiles: RuntimeSupportFile[],
  sourceFiles: Record<string, string>,
  sourceFileAliases: Record<string, string>,
): void => {
  for (const file of supportFiles) {
    const artifactName = artifactFileName(file.path);
    sourceFiles[file.path] = file.content;
    if (artifactName !== file.path) {
      sourceFiles[artifactName] = file.content;
      sourceFileAliases[artifactName] = file.path;
    }
  }
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
  include: ['ravium.module.mjs', 'src/**/*.mjs', 'src/**/*.ts', 'src/**/*.vue'],
});

const readmeFor = (manifest: RaviumModuleManifest, template: InitOptions['template'] = 'basic'): string => {
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
  return `import { defineRuntimeClientEntrypoint } from '@ravium/module-sdk';

export const setupRuntimeClient = defineRuntimeClientEntrypoint((ctx) => {
  ctx.onPageMounted(() => ctx.variables?.increment('kitchenSinkPublicCounter', 1));
});
`;
};

const runtimeServerSource = (template: InitOptions['template'] = 'basic'): string => {
  return `import { defineRuntimeServerEntrypoint } from '@ravium/module-sdk';

export const setupRuntimeServer = defineRuntimeServerEntrypoint((ctx) => {
  ctx.registerRoute({ method: 'POST', path: '/api/kitchen-sink/events', handler: async () => ({ ok: true }) });
});
`;
};

const stylesSource = (_template: InitOptions['template'], slug: string): string => `.ravium-module-${slug} { color: var(--foreground); }\n`;

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
