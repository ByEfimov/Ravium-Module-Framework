import type { BuilderContext } from './builder-context.js';
import { pushCapability, requestPermission } from './manifest.js';
import type { RaviumModuleBuilder } from './types.js';

type CoreNamespaces = Pick<RaviumModuleBuilder, 'fields' | 'declarations' | 'entrypoints' | 'artifacts' | 'meta' | 'permissions'>;

const noopEditorEntrypoint = `export const registerEditorExtensions = () => undefined;
export default registerEditorExtensions;
`;

const noopRuntimeClientEntrypoint = `export const setupRuntimeClient = () => undefined;
export default setupRuntimeClient;
`;

const noopRuntimeServerEntrypoint = `export const setupRuntimeServer = () => undefined;
export default setupRuntimeServer;
`;

export const createCoreNamespaces = (context: BuilderContext): CoreNamespaces => {
  const { manifest, fields } = context;

  const addGeneratedSourceFile = (path: string, content: string): void => {
    pushCapability(manifest, 'runtimeSupportFiles', { path, content });
  };

  return {
    fields,
    declarations: { field: fields },
    entrypoints: {
      editor: (entrypoint) => {
        manifest.entrypoints.editor = entrypoint;
      },
      runtimeClient: (entrypoint) => {
        manifest.entrypoints.runtimeClient = entrypoint;
      },
      runtimeServer: (entrypoint) => {
        manifest.entrypoints.runtimeServer = entrypoint;
      },
      styles: (entrypoint) => {
        if (entrypoint === false) {
          delete manifest.entrypoints.styles;
          return;
        }
        manifest.entrypoints.styles = entrypoint;
      },
      generated: {
        editor: (entrypoint = 'src/ravium-framework/editor.ts') => {
          manifest.entrypoints.editor = entrypoint;
          addGeneratedSourceFile(entrypoint, noopEditorEntrypoint);
        },
        runtimeClient: (entrypoint = 'src/ravium-framework/runtime-client.ts') => {
          manifest.entrypoints.runtimeClient = entrypoint;
          addGeneratedSourceFile(entrypoint, noopRuntimeClientEntrypoint);
        },
        runtimeServer: (entrypoint = 'src/ravium-framework/runtime-server.ts') => {
          manifest.entrypoints.runtimeServer = entrypoint;
          addGeneratedSourceFile(entrypoint, noopRuntimeServerEntrypoint);
        },
      },
    },
    artifacts: {
      sourceFile: (file) => addGeneratedSourceFile(file.path, file.content),
      sourceFiles: (files) => {
        for (const file of files) {
          addGeneratedSourceFile(file.path, file.content);
        }
      },
    },
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
