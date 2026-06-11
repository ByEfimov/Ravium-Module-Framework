import { createBuilderContext } from './builder-context.js';
import { createContentNamespaces } from './builder-content.js';
import { createCoreNamespaces } from './builder-core.js';
import { createEditorNamespaces } from './builder-editor.js';
import { createEscapeHatchNamespaces } from './builder-raw.js';
import { createExtraNamespaces } from './builder-extras.js';
import { createProjectNamespaces } from './builder-project.js';
import { createRuntimeNamespaces } from './builder-runtime.js';
import type { MutableManifest, RaviumModuleBuilder } from './types.js';

export const createBuilder = (manifest: MutableManifest): RaviumModuleBuilder => {
  const context = createBuilderContext(manifest);

  return {
    ...createCoreNamespaces(context),
    ...createEditorNamespaces(context),
    ...createContentNamespaces(context),
    ...createProjectNamespaces(context),
    ...createRuntimeNamespaces(context),
    ...createExtraNamespaces(context),
    ...createEscapeHatchNamespaces(context),
  };
};
