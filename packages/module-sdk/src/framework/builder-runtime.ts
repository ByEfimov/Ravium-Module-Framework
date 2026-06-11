import type { BuilderContext } from './builder-context.js';
import { pushCapability, requestPermission } from './manifest.js';
import type { RaviumModuleBuilder } from './types.js';

type RuntimeNamespaces = Pick<RaviumModuleBuilder, 'runtime' | 'generated'>;

export const createRuntimeNamespaces = (context: BuilderContext): RuntimeNamespaces => {
  const { manifest, addDependency, addServerRoute } = context;

  return {
    runtime: {
      client: {
        onMounted: (entrypoint) => pushCapability(manifest, 'runtimeClientMounted', entrypoint),
        localStorage: (options = {}) => {
          pushCapability(manifest, 'runtimeLocalStorage', options);
          requestPermission(manifest, 'runtime.localStorage');
        },
        sessionStorage: (options = {}) => {
          pushCapability(manifest, 'runtimeSessionStorage', options);
          requestPermission(manifest, 'runtime.sessionStorage');
        },
        cookie: (options) => {
          pushCapability(manifest, 'runtimeCookies', options);
          requestPermission(manifest, 'runtime.cookies');
        },
        fetch: (options) => {
          for (const pattern of options.allow) {
            const permissions = manifest.permissions as Record<string, unknown>;
            const network = (permissions.network || { allow: [], methods: [] }) as { allow: string[]; methods: string[] };
            network.allow = [...new Set([...network.allow, pattern])];
            network.methods = [...new Set([...network.methods, ...(options.methods || ['GET'])])];
            permissions.network = network;
          }
          requestPermission(manifest, 'network.fetch');
        },
        timer: (options) => {
          pushCapability(manifest, 'runtimeTimers', options);
          requestPermission(manifest, 'runtime.timers');
        },
        composable: (composable) => {
          manifest.composables = [...(manifest.composables || []), composable];
          requestPermission(manifest, 'generated.composables');
        },
      },
      server: {
        route: addServerRoute,
        middleware: (middleware) => {
          manifest.middleware = [...(manifest.middleware || []), middleware];
          requestPermission(manifest, 'generated.middleware');
        },
        uploadRoute: (route) => {
          addServerRoute({ ...route, upload: true });
          requestPermission(manifest, 'runtime.files');
        },
        requestSchema: (id, schema) => pushCapability(manifest, 'serverRequestSchemas', { id, schema }),
        responseSchema: (id, schema) => pushCapability(manifest, 'serverResponseSchemas', { id, schema }),
        handler: (handler) => pushCapability(manifest, 'serverHandlers', handler),
      },
      files: {
        bucket: (bucket) => {
          pushCapability(manifest, 'runtimeFileBuckets', bucket);
          requestPermission(manifest, 'runtime.files');
        },
        uploadRoute: (route) => {
          addServerRoute({ ...route, upload: true });
          requestPermission(manifest, 'runtime.files');
        },
      },
    },
    generated: {
      nuxt: {
        page: (route) => {
          manifest.routes.push({ kind: 'page', ...route });
          requestPermission(manifest, 'generated.routes');
        },
        plugin: (plugin) => {
          pushCapability(manifest, 'nuxtPlugins', plugin);
          requestPermission(manifest, 'generated.plugins');
        },
        composable: (composable) => {
          manifest.composables = [...(manifest.composables || []), composable];
          requestPermission(manifest, 'generated.composables');
        },
        middleware: (middleware) => {
          manifest.middleware = [...(manifest.middleware || []), middleware];
          requestPermission(manifest, 'generated.middleware');
        },
      },
      env: {
        require: (variable) => {
          pushCapability(manifest, 'envRequirements', variable);
          requestPermission(manifest, 'generated.env');
        },
      },
      package: { dependency: addDependency },
    },
  };
};
