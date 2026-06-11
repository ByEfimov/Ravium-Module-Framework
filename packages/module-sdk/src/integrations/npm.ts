import type { RaviumModuleBuilder } from '../framework/types.js';

export type RaviumNpmDependencyTarget = 'runtime' | 'editor' | 'server';

export interface RaviumNpmPackageDefinition {
  name: string;
  version: string;
  target?: RaviumNpmDependencyTarget;
  allowNetwork?: string[];
}

export const registerNpmPackage = (
  ravium: Pick<RaviumModuleBuilder, 'dependencies' | 'permissions'>,
  definition: RaviumNpmPackageDefinition,
): void => {
  ravium.dependencies.npm(definition.name, definition.version, definition.target || 'runtime');
  if (definition.allowNetwork) {
    for (const pattern of definition.allowNetwork) {
      ravium.permissions.network.allow(pattern);
    }
  }
};

export const registerNpmPackages = (
  ravium: Pick<RaviumModuleBuilder, 'dependencies' | 'permissions'>,
  definitions: RaviumNpmPackageDefinition[],
): void => {
  for (const definition of definitions) {
    registerNpmPackage(ravium, definition);
  }
};
