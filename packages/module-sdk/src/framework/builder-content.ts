import type { BuilderContext } from './builder-context.js';
import { toSchemaObject } from './fields.js';
import { pushCapability, requestPermission } from './manifest.js';
import type { RaviumModuleBuilder } from './types.js';

type ContentNamespaces = Pick<RaviumModuleBuilder, 'components' | 'functions' | 'variables' | 'references'>;

export const createContentNamespaces = (context: BuilderContext): ContentNamespaces => {
  const { manifest, addExtensionPoint } = context;
  const defineComponent = (definition: Parameters<ContentNamespaces['components']['define']>[0]): void => {
    const propsSchema = definition.propsSchema || (definition.props ? toSchemaObject(definition.props) : undefined);
    const { props, palette, rightPanel, ...component } = definition;
    manifest.components.push({ ...component, ...(propsSchema ? { propsSchema } : {}) });
    if (palette !== false) {
      addExtensionPoint('canvasPalette', {
        id: palette?.id || definition.type,
        label: palette?.label || definition.label,
        icon: palette?.icon || 'Package',
        category: palette?.category || definition.category,
        componentType: definition.type,
      });
      requestPermission(manifest, 'editor.palette');
    }
    if (rightPanel !== false && propsSchema) {
      addExtensionPoint('rightMenuSections', {
        id: rightPanel?.id || `${definition.type}.settings`,
        label: rightPanel?.title || definition.label,
        icon: rightPanel?.icon,
        targetComponentTypes: [definition.type],
      });
      requestPermission(manifest, 'editor.rightMenu');
      requestPermission(manifest, 'settings.component');
    }
  };
  const defineFunction = (definition: Parameters<ContentNamespaces['functions']['defineNode']>[0]): void => {
    manifest.functions.push(definition);
    addExtensionPoint('functionNodes', {
      id: definition.id,
      label: definition.label || definition.id,
      icon: definition.icon || 'Zap',
    });
    requestPermission(manifest, 'functions.runtime');
  };
  const defineVariable = (definition: Parameters<ContentNamespaces['variables']['define']>[0]): void => {
    manifest.variables.push(definition);
    if (definition.mode) {
      requestPermission(manifest, `variables.${definition.mode}`);
    }
  };

  return {
    components: {
      define: defineComponent,
      create: defineComponent,
      createComponent: defineComponent,
      props: toSchemaObject,
      variant: (variant) => variant,
      slot: (slot) => slot,
      editorPreview: (preview) => preview,
      editorRenderer: (entrypoint) => entrypoint,
      runtimeRenderer: (entrypoint) => entrypoint,
    },
    functions: {
      define: defineFunction,
      defineNode: defineFunction,
      input: (input) => input,
      output: (output) => output,
      handler: (entrypoint) => entrypoint,
      editorCard: (card) => card,
      playgroundAdapter: (adapter) => adapter,
    },
    variables: {
      add: defineVariable,
      define: defineVariable,
      public: (definition) => {
        manifest.variables.push({ ...definition, mode: 'public' });
        requestPermission(manifest, 'variables.public');
      },
      server: (definition) => {
        manifest.variables.push({ ...definition, mode: 'server' });
        requestPermission(manifest, 'variables.server');
      },
      encrypted: (definition) => {
        manifest.variables.push({ ...definition, mode: 'encrypted' });
        requestPermission(manifest, 'variables.encrypted');
      },
      model: (model) => pushCapability(manifest, 'variableModels', model),
    },
    references: {
      source: (source) => pushCapability(manifest, 'referenceSources', source),
      picker: (picker) => pushCapability(manifest, 'referencePickers', picker),
    },
  };
};
