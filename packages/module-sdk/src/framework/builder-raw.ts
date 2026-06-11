import type { BuilderContext } from './builder-context.js';
import { pushCapability, requestPermission } from './manifest.js';
import { mergeByPath, pushByPath, setByPath } from './path.js';
import type { RaviumModuleBuilder } from './types.js';

type EscapeHatchNamespaces = Pick<RaviumModuleBuilder, 'raw' | 'experimental'>;

export const createEscapeHatchNamespaces = (context: BuilderContext): EscapeHatchNamespaces => {
  const { manifest, addExtensionPoint } = context;

  return {
    raw: {
      manifest: (patch) => {
        Object.assign(manifest, patch);
      },
      set: (path, value) => setByPath(manifest as unknown as Record<string, unknown>, path, value),
      merge: (path, value) => mergeByPath(manifest as unknown as Record<string, unknown>, path, value),
      push: (path, value) => pushByPath(manifest as unknown as Record<string, unknown>, path, value),
      permission: (permission, permissionContext) => requestPermission(manifest, permission, permissionContext),
      capability: (name, payload) => pushCapability(manifest, name, payload),
      extensionPoint: addExtensionPoint,
      file: (filePath, options = {}) => pushCapability(manifest, 'rawFiles', { path: filePath, ...options }),
      files: (paths, options = {}) => {
        for (const filePath of paths) {
          pushCapability(manifest, 'rawFiles', { path: filePath, ...options });
        }
      },
      artifact: (artifact) => pushCapability(manifest, 'artifacts', artifact),
      compilerFile: (file) => pushCapability(manifest, 'compilerFiles', file),
    },
    experimental: {
      capability: (name, payload) => pushCapability(manifest, `experimental:${name}`, payload),
      hostAction: (action) => pushCapability(manifest, 'experimentalHostActions', action),
    },
  };
};
