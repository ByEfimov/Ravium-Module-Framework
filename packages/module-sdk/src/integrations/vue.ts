import type {
  RaviumComponentDefinition,
  RaviumJSONSchema,
  RaviumModuleBuilder,
  RaviumVariableDefinition,
} from '../framework/types.js';
import { registerNpmPackages, type RaviumNpmPackageDefinition } from './npm.js';

export interface RaviumVueNpmComponentIntegration {
  component: RaviumComponentDefinition;
  npm?: RaviumNpmPackageDefinition[];
  settings?: {
    component?: {
      name: string;
      schema: RaviumJSONSchema;
    };
    project?: {
      name: string;
      schema: RaviumJSONSchema;
      page?: Record<string, unknown>;
    };
  };
  variables?: RaviumVariableDefinition[];
  projectImages?: false | Record<string, unknown>;
  capabilities?: Record<string, Record<string, unknown> | Record<string, unknown>[]>;
}

export const createVueNpmComponentIntegration = (
  ravium: RaviumModuleBuilder,
  integration: RaviumVueNpmComponentIntegration,
): void => {
  if (integration.settings?.project) {
    ravium.project.settings.schema(integration.settings.project.name, integration.settings.project.schema);
    if (integration.settings.project.page) {
      ravium.layout.projectSettings.addPage(integration.settings.project.page);
    }
  }

  if (integration.settings?.component) {
    ravium.project.settings.schema(integration.settings.component.name, integration.settings.component.schema);
  }

  ravium.components.createComponent(integration.component);

  if (integration.projectImages !== false) {
    ravium.user.files.enableProjectImages(integration.projectImages || {});
  }

  for (const variable of integration.variables || []) {
    ravium.variables.add(variable);
  }

  registerNpmPackages(ravium, integration.npm || []);

  for (const [name, payload] of Object.entries(integration.capabilities || {})) {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        ravium.raw.capability(name, item);
      }
    } else {
      ravium.raw.capability(name, payload);
    }
  }
};
