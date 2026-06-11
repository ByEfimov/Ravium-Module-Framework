import type { BuilderContext } from './builder-context.js';
import { pushCapability, requestPermission } from './manifest.js';
import type { RaviumModuleBuilder } from './types.js';

type ExtraNamespaces = Pick<
  RaviumModuleBuilder,
  'migrations' | 'dependencies' | 'commands' | 'diagnostics' | 'moderation' | 'testing'
>;

export const createExtraNamespaces = (context: BuilderContext): ExtraNamespaces => {
  const { manifest, addDependency, addExtensionPoint } = context;

  return {
    migrations: {
      postgres: (migration) => {
        manifest.migrations.push({ engine: 'postgres', ...migration });
        requestPermission(manifest, 'migrations.postgres');
      },
    },
    dependencies: {
      npm: addDependency,
      module: (dependency) => {
        manifest.moduleDependencies.push(dependency);
      },
    },
    commands: {
      define: (command) => {
        addExtensionPoint('commands', command);
        requestPermission(manifest, 'editor.commands');
      },
    },
    diagnostics: {
      define: (diagnostic) => pushCapability(manifest, 'diagnostics', diagnostic),
      record: (diagnostic) => pushCapability(manifest, 'diagnosticRecords', diagnostic),
    },
    moderation: {
      note: (note) => pushCapability(manifest, 'moderationNotes', note),
      risk: (risk) => pushCapability(manifest, 'moderationRisks', risk),
    },
    testing: {
      scenario: (scenario) => pushCapability(manifest, 'testingScenarios', scenario),
    },
  };
};
