import { createBuilder } from './builder.js';
import { emptyManifest } from './manifest.js';
import type { RaviumDefinedModule, RaviumModuleFrameworkOptions, RaviumModuleManifestLike } from './types.js';

export type * from './types.js';

export const createRaviumManifest = (options: RaviumModuleFrameworkOptions): RaviumModuleManifestLike => {
  const manifest = emptyManifest(options);
  options.setup?.(createBuilder(manifest));
  return manifest;
};

export const defineRaviumModule = (options: RaviumModuleFrameworkOptions): RaviumDefinedModule => ({
  kind: 'ravium.module',
  options,
  toManifest: () => createRaviumManifest(options),
});
