import type { MutableManifest, RaviumModuleFrameworkOptions, RaviumModulePermission } from './types.js';

export const push = (record: Record<string, unknown>, key: string, value: unknown): void => {
  const existing = record[key];
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }
  record[key] = [value];
};

export const pushCapability = (manifest: MutableManifest, key: string, value: unknown): void => {
  push(manifest.capabilities, key, value);
};

const ensureRecord = (record: Record<string, unknown>, key: string): Record<string, unknown> => {
  const existing = record[key];
  if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  record[key] = next;
  return next;
};

const applyPermissionDetails = (manifest: MutableManifest, permission: RaviumModulePermission): void => {
  const permissions = manifest.permissions;
  switch (permission) {
    case 'assets.read':
      ensureRecord(permissions, 'assets').read = true;
      break;
    case 'settings.project':
      ensureRecord(permissions, 'settings').project = true;
      break;
    case 'settings.component':
      ensureRecord(permissions, 'settings').component = true;
      break;
    case 'npm.dependencies':
      permissions.npmDependencies = true;
      break;
    case 'network.fetch':
      ensureRecord(permissions, 'network');
      break;
    case 'storage.project':
      ensureRecord(permissions, 'storage').scope = 'project';
      break;
    case 'secrets.read':
      permissions.secrets = Array.isArray(permissions.secrets) ? permissions.secrets : [];
      break;
  }
};

export const requestPermission = (
  manifest: MutableManifest,
  permission: RaviumModulePermission,
  context?: Record<string, unknown>,
): void => {
  const summary = Array.isArray(manifest.permissions.summary) ? manifest.permissions.summary : [];
  if (!summary.includes(permission)) {
    summary.push(permission);
  }
  manifest.permissions.summary = summary;
  applyPermissionDetails(manifest, permission);
  if (context && Object.keys(context).length > 0) {
    pushCapability(manifest, 'permissionContext', { permission, ...context });
  }
};

export const emptyManifest = (options: RaviumModuleFrameworkOptions): MutableManifest => {
  const meta = options.meta;
  return {
    id: `${meta.namespace}.${meta.slug}`,
    namespace: meta.namespace,
    slug: meta.slug,
    name: meta.name,
    description: meta.description,
    version: meta.version,
    license: meta.license || 'MIT',
    author: meta.author || { name: 'Ravium Developer' },
    raviumApiVersion: meta.raviumApiVersion || '^1.0.0',
    sdkVersionRange: meta.sdkVersionRange || '^1.0.0',
    compatibility: meta.compatibility || {
      minRaviumVersion: '1.0.0',
      maxRaviumVersion: '1.x',
      generatedAppRuntime: 'nuxt-postgres',
    },
    tags: meta.tags || [],
    entrypoints: {
      editor: options.entrypoints?.editor || 'src/editor.ts',
      runtimeClient: options.entrypoints?.runtimeClient || 'src/runtime-client.ts',
      runtimeServer: options.entrypoints?.runtimeServer || 'src/runtime-server.ts',
      ...(options.entrypoints?.styles ? { styles: options.entrypoints.styles } : { styles: 'src/styles.css' }),
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
    sizeBudget: meta.sizeBudget || {},
    pricing: meta.pricing || { kind: 'free' },
    ...(options.discover ? { discover: options.discover } : {}),
    capabilities: {},
  };
};
