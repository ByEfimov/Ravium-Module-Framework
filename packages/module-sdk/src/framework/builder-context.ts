import { createFields } from './fields.js';
import { push, requestPermission } from './manifest.js';
import type {
  MutableManifest,
  RaviumFieldFactory,
  RaviumServerRouteDefinition,
} from './types.js';

export interface BuilderContext {
  readonly manifest: MutableManifest;
  readonly fields: RaviumFieldFactory;
  readonly addExtensionPoint: (name: string, value: unknown) => void;
  readonly addDependency: (name: string, version: string, target?: 'runtime' | 'editor' | 'server') => void;
  readonly addServerRoute: (route: RaviumServerRouteDefinition) => void;
}

export const createBuilderContext = (manifest: MutableManifest): BuilderContext => {
  const fields = createFields();

  const addExtensionPoint = (name: string, value: unknown): void => {
    push(manifest.extensionPoints, name, value);
  };

  const addDependency = (
    name: string,
    version: string,
    target: 'runtime' | 'editor' | 'server' = 'runtime',
  ): void => {
    const dependencies = manifest.dependencies as Record<string, Record<string, string>>;
    dependencies[target] = dependencies[target] || {};
    dependencies[target][name] = version;
    requestPermission(manifest, 'npm.dependencies');
  };

  const addServerRoute = (route: RaviumServerRouteDefinition): void => {
    manifest.routes.push({ kind: 'server', method: route.method || 'GET', ...route });
    requestPermission(manifest, 'generated.routes');
    requestPermission(manifest, 'generated.serverRoutes');
  };

  return { manifest, fields, addExtensionPoint, addDependency, addServerRoute };
};
