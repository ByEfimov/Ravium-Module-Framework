import type { BuilderContext } from './builder-context.js';
import { requestPermission } from './manifest.js';
import type { RaviumModuleBuilder } from './types.js';

type CoreNamespaces = Pick<RaviumModuleBuilder, 'fields' | 'declarations' | 'meta' | 'permissions'>;

export const createCoreNamespaces = (context: BuilderContext): CoreNamespaces => {
  const { manifest, fields } = context;

  return {
    fields,
    declarations: { field: fields },
    meta: {
      tag: (tag) => {
        if (!manifest.tags.includes(tag)) {
          manifest.tags.push(tag);
        }
      },
      compatibility: (value) => {
        manifest.compatibility = { ...manifest.compatibility, ...value };
      },
    },
    permissions: {
      request: (permission, permissionContext) => requestPermission(manifest, permission, permissionContext),
      network: {
        allow: (pattern, methods = ['GET', 'POST']) => {
          const permissions = manifest.permissions as Record<string, unknown>;
          const network = (permissions.network || { allow: [], methods: [] }) as { allow: string[]; methods: string[] };
          network.allow = [...new Set([...network.allow, pattern])];
          network.methods = [...new Set([...network.methods, ...methods])];
          permissions.network = network;
          requestPermission(manifest, 'network.fetch');
        },
      },
    },
  };
};
