import type { BuilderContext } from './builder-context.js';
import { pushCapability, requestPermission } from './manifest.js';
import type { RaviumModuleBuilder } from './types.js';

type EditorNamespaces = Pick<
  RaviumModuleBuilder,
  'layout' | 'editor' | 'canvas' | 'blocks' | 'properties' | 'styles' | 'interactions'
>;

export const createEditorNamespaces = (context: BuilderContext): EditorNamespaces => {
  const { manifest, addExtensionPoint } = context;
  const rightMenu = {
    addSection: (section: Record<string, unknown>) => {
      addExtensionPoint('rightMenuSections', section);
      requestPermission(manifest, 'editor.rightMenu');
      requestPermission(manifest, 'settings.component');
    },
  };

  return {
    layout: {
      leftMenu: {
        addGroup: (group) => {
          addExtensionPoint('leftMenu', group);
          requestPermission(manifest, 'editor.panels');
        },
        addAction: (action) => {
          addExtensionPoint('leftMenuActions', action);
          requestPermission(manifest, 'editor.panels');
        },
      },
      rightPanel: rightMenu,
      rightMenu,
      editorTabs: {
        add: (tab) => {
          addExtensionPoint('editorTabs', tab);
          requestPermission(manifest, 'editor.panels');
        },
      },
      projectSettings: {
        addPage: (page) => {
          addExtensionPoint('projectSettingsPages', page);
          requestPermission(manifest, 'settings.project');
        },
      },
      toolbar: {
        addAction: (action) => {
          addExtensionPoint('toolbarActions', action);
          requestPermission(manifest, 'editor.commands');
        },
      },
    },
    editor: {
      panel: (panel) => {
        addExtensionPoint('editorPanels', panel);
        requestPermission(manifest, 'editor.panels');
      },
      command: (command) => {
        addExtensionPoint('commands', command);
        requestPermission(manifest, 'editor.commands');
      },
      sandbox: (entrypoint, options) => {
        addExtensionPoint('sandboxes', { entrypoint, ...options });
        requestPermission(manifest, 'editor.panels');
      },
      diagnostic: (definition) => pushCapability(manifest, 'diagnostics', definition),
    },
    canvas: {
      palette: {
        add: (item) => {
          addExtensionPoint('canvasPalette', item);
          requestPermission(manifest, 'editor.palette');
        },
      },
      contextMenu: { addAction: (action) => addExtensionPoint('canvasContextMenuActions', action) },
      selection: { addInspector: (inspector) => addExtensionPoint('canvasSelectionInspectors', inspector) },
      dropTargets: { define: (target) => addExtensionPoint('canvasDropTargets', target) },
    },
    blocks: {
      defineType: (definition) => pushCapability(manifest, 'blockTypes', definition),
      template: (template) => {
        addExtensionPoint('canvasPalette', template);
        requestPermission(manifest, 'editor.palette');
      },
    },
    properties: {
      section: (section) => {
        addExtensionPoint('propertySections', section);
        requestPermission(manifest, 'editor.rightMenu');
      },
    },
    styles: {
      group: (group) => {
        addExtensionPoint('styleGroups', group);
        requestPermission(manifest, 'editor.rightMenu');
      },
    },
    interactions: {
      define: (interaction) => pushCapability(manifest, 'interactions', interaction),
      preset: (preset) => pushCapability(manifest, 'interactionPresets', preset),
    },
  };
};
