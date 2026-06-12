export type {
  RaviumDefinedModule,
  RaviumComponentSlotDefinition,
  RaviumFieldFactory,
  RaviumFieldOptions,
  RaviumFunctionDefinition,
  RaviumJSONSchema,
  RaviumModuleBuilder,
  RaviumModuleDiscoverOptions,
  RaviumModuleFrameworkOptions,
  RaviumModuleManifestLike,
  RaviumModuleMeta,
  RaviumModulePermission,
  RaviumServerRouteDefinition,
  RaviumSourceFileDefinition,
  RaviumVariableDefinition,
} from './framework.js';
export { createRaviumManifest, defineRaviumModule } from './framework.js';
export { registerNpmPackage, registerNpmPackages } from './integrations/npm.js';
export { createVueNpmComponentIntegration } from './integrations/vue.js';
export type {
  RaviumNpmDependencyTarget,
  RaviumNpmPackageDefinition,
} from './integrations/npm.js';
export type { RaviumVueNpmComponentIntegration } from './integrations/vue.js';

export type RaviumPermission =
  | 'assets.read'
  | 'editor.commands'
  | 'editor.palette'
  | 'editor.panels'
  | 'editor.rightMenu'
  | 'functions.runtime'
  | 'generated.composables'
  | 'generated.env'
  | 'generated.middleware'
  | 'generated.plugins'
  | 'generated.routes'
  | 'generated.serverRoutes'
  | 'migrations.postgres'
  | 'network.fetch'
  | 'npm.dependencies'
  | 'runtime.cache'
  | 'runtime.cookies'
  | 'runtime.files'
  | 'runtime.localStorage'
  | 'runtime.sessionStorage'
  | 'runtime.timers'
  | 'secrets.read'
  | 'settings.component'
  | 'settings.project'
  | 'storage.kv'
  | 'storage.project'
  | `variables.${'public' | 'server' | 'encrypted'}`
  | (string & {});

export interface RaviumIconDescriptor {
  icon?: string;
}

export interface RaviumPaletteItem extends RaviumIconDescriptor {
  id: string;
  label: string;
  componentType: string;
  category?: string;
}

export interface RaviumRightMenuSection extends RaviumIconDescriptor {
  id: string;
  label: string;
  targetComponentTypes: string[];
}

export interface RaviumLeftMenuSection extends RaviumIconDescriptor {
  id: string;
  label: string;
}

export interface RaviumCommand extends RaviumIconDescriptor {
  id: string;
  label: string;
  handler?: string;
  componentType?: string;
  targetComponentType?: string;
  targetEditorTabId?: string;
}

export interface RaviumEditorContext {
  module: {
    namespace: string;
    slug: string;
    version: string;
  };
  permissions: {
    has(permission: RaviumPermission): boolean;
    require(permission: RaviumPermission): void;
  };
  registerPaletteItem(item: RaviumPaletteItem): void;
  registerRightMenuSection(section: RaviumRightMenuSection): void;
  registerLeftMenuSection(section: RaviumLeftMenuSection): void;
  registerCommand(command: RaviumCommand): void;
}

export interface RaviumRuntimeClientContext {
  module: {
    namespace: string;
    slug: string;
    version: string;
  };
  onPageMounted(callback: () => void | Promise<void>): void;
  variables?: {
    increment(key: string, delta: number): void | Promise<void>;
    read<TValue = unknown>(key: string): TValue | Promise<TValue>;
    write<TValue = unknown>(key: string, value: TValue): void | Promise<void>;
  };
}

export interface RaviumRuntimeRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: `/api/${string}`;
  handler: (event: unknown) => unknown | Promise<unknown>;
}

export interface RaviumRuntimeServerContext {
  module: {
    namespace: string;
    slug: string;
    version: string;
  };
  permissions: {
    require(permission: RaviumPermission): void;
  };
  registerRoute(route: RaviumRuntimeRoute): void;
  variables?: {
    read<TValue = unknown>(key: string): TValue | Promise<TValue>;
    write<TValue = unknown>(key: string, value: TValue): void | Promise<void>;
  };
  secrets?: {
    read(key: string): string | Promise<string>;
  };
}

export type RaviumEntrypointResult = unknown | Promise<unknown>;

export type RaviumEditorEntrypoint = (ctx: RaviumEditorContext) => RaviumEntrypointResult;
export type RaviumRuntimeClientEntrypoint = (ctx: RaviumRuntimeClientContext) => RaviumEntrypointResult;
export type RaviumRuntimeServerEntrypoint = (ctx: RaviumRuntimeServerContext) => RaviumEntrypointResult;

export const defineEditorEntrypoint = (entrypoint: RaviumEditorEntrypoint): RaviumEditorEntrypoint => entrypoint;

export const defineRuntimeClientEntrypoint = (
  entrypoint: RaviumRuntimeClientEntrypoint,
): RaviumRuntimeClientEntrypoint => entrypoint;

export const defineRuntimeServerEntrypoint = (
  entrypoint: RaviumRuntimeServerEntrypoint,
): RaviumRuntimeServerEntrypoint => entrypoint;

export const requirePermission = (
  ctx: Pick<RaviumEditorContext | RaviumRuntimeServerContext, 'permissions'>,
  permission: RaviumPermission,
): void => {
  ctx.permissions.require(permission);
};
