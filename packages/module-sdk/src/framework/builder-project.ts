import type { BuilderContext } from './builder-context.js';
import { pushCapability, requestPermission } from './manifest.js';
import type { RaviumModuleBuilder } from './types.js';

type ProjectNamespaces = Pick<RaviumModuleBuilder, 'project' | 'assets' | 'user' | 'storage' | 'secrets'>;

export const createProjectNamespaces = (context: BuilderContext): ProjectNamespaces => {
  const { manifest, fields } = context;

  return {
    project: {
      settings: {
        schema: (name, schema) => {
          manifest.settingsSchema[name] = schema;
          requestPermission(manifest, 'settings.project');
        },
      },
      transforms: { add: (transform) => (manifest.projectTransforms = [...(manifest.projectTransforms || []), transform]) },
      install: { onInstall: (hook) => pushCapability(manifest, 'installHooks', hook) },
      update: { migrationAssistant: (assistant) => pushCapability(manifest, 'migrationAssistants', assistant) },
      uninstall: { dataExport: (exporter) => pushCapability(manifest, 'uninstallDataExports', exporter) },
      assets: {
        images: {
          enable: (options = {}) => {
            pushCapability(manifest, 'projectImageAssets', { enabled: true, ...options });
            requestPermission(manifest, 'assets.read');
          },
          field: (options) => fields.image(options),
        },
      },
    },
    assets: {
      module: {
        add: (asset) => {
          manifest.assets.push(asset);
          requestPermission(manifest, 'assets.read');
        },
      },
    },
    user: {
      files: {
        bucket: (bucket) => {
          pushCapability(manifest, 'runtimeFileBuckets', bucket);
          requestPermission(manifest, 'runtime.files');
        },
        uploadRoute: (route) => {
          context.addServerRoute({ ...route, upload: true });
          requestPermission(manifest, 'runtime.files');
        },
        imageField: (options) => fields.image(options),
        imageListField: (options) => fields.imageList(options),
        enableProjectImages: (options = {}) => {
          pushCapability(manifest, 'projectImageAssets', { enabled: true, ...options });
          requestPermission(manifest, 'assets.read');
        },
      },
    },
    storage: {
      table: (table) => {
        pushCapability(manifest, 'storageTables', table);
        requestPermission(manifest, 'storage.project');
      },
      collection: (collection) => {
        pushCapability(manifest, 'storageCollections', collection);
        requestPermission(manifest, 'storage.project');
      },
      kv: (store) => {
        pushCapability(manifest, 'storageKv', store);
        requestPermission(manifest, 'storage.kv');
      },
    },
    secrets: {
      define: (secret) => {
        pushCapability(manifest, 'secrets', secret);
        requestPermission(manifest, 'secrets.read');
      },
      read: (key) => ({ key, permission: 'secrets.read' }),
    },
  };
};
