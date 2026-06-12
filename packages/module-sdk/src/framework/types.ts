export type RaviumJSONSchema = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: RaviumJSONSchema;
  properties?: Record<string, RaviumJSONSchema>;
  required?: string[];
  $ref?: string;
  'x-raviumInput'?: string;
  [key: string]: unknown;
};

export type RaviumModulePermission =
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

export interface RaviumModuleMeta {
  namespace: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  license?: string;
  author?: {
    name: string;
    email?: string;
  };
  tags?: string[];
  raviumApiVersion?: string;
  sdkVersionRange?: string;
  compatibility?: Record<string, unknown>;
  sizeBudget?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
}

export interface RaviumModuleDiscoverOptions {
  components?: string | false;
  functions?: string | false;
  routes?: string | false;
  migrations?: string | false;
  assets?: string | false;
}

export interface RaviumModuleFrameworkOptions {
  meta: RaviumModuleMeta;
  discover?: RaviumModuleDiscoverOptions;
  entrypoints?: Partial<RaviumModuleManifestLike['entrypoints']>;
  setup?: (ravium: RaviumModuleBuilder) => void;
}

export interface RaviumModuleManifestLike {
  id: string;
  namespace: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  license: string;
  author: {
    name: string;
    email?: string;
  };
  raviumApiVersion: string;
  sdkVersionRange: string;
  compatibility: Record<string, unknown>;
  tags: string[];
  entrypoints: {
    editor: string;
    runtimeClient: string;
    runtimeServer: string;
    styles?: string;
  };
  extensionPoints: Record<string, unknown>;
  permissions: Record<string, unknown>;
  settingsSchema: Record<string, unknown>;
  components: Array<Record<string, unknown>>;
  variables: Array<Record<string, unknown>>;
  functions: Array<Record<string, unknown>>;
  routes: Array<Record<string, unknown>>;
  middleware?: Array<Record<string, unknown>>;
  composables?: Array<Record<string, unknown>>;
  migrations: Array<Record<string, unknown>>;
  projectTransforms?: Array<Record<string, unknown>>;
  dependencies: Record<string, unknown>;
  moduleDependencies: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  sizeBudget: Record<string, unknown>;
  pricing: Record<string, unknown>;
  discover?: RaviumModuleDiscoverOptions;
  capabilities?: Record<string, unknown>;
}

export interface RaviumDefinedModule {
  readonly kind: 'ravium.module';
  readonly options: RaviumModuleFrameworkOptions;
  toManifest(): RaviumModuleManifestLike;
}

export interface RaviumFieldFactory {
  text(options?: RaviumFieldOptions): RaviumJSONSchema;
  textarea(options?: RaviumFieldOptions): RaviumJSONSchema;
  number(options?: RaviumNumberFieldOptions): RaviumJSONSchema;
  integer(options?: RaviumNumberFieldOptions): RaviumJSONSchema;
  boolean(options?: RaviumFieldOptions): RaviumJSONSchema;
  color(options?: RaviumFieldOptions): RaviumJSONSchema;
  select(options: RaviumSelectFieldOptions): RaviumJSONSchema;
  image(options?: RaviumFieldOptions): RaviumJSONSchema;
  imageList(options?: RaviumArrayFieldOptions): RaviumJSONSchema;
  componentSelect(options?: RaviumFieldOptions): RaviumJSONSchema;
  variable(options?: RaviumFieldOptions): RaviumJSONSchema;
  function(options?: RaviumFieldOptions): RaviumJSONSchema;
  json(options?: RaviumFieldOptions): RaviumJSONSchema;
  array(item: RaviumJSONSchema, options?: RaviumArrayFieldOptions): RaviumJSONSchema;
  object(properties: Record<string, RaviumJSONSchema>, options?: RaviumObjectFieldOptions): RaviumJSONSchema;
  ref(ref: string): RaviumJSONSchema;
  custom(schema: RaviumJSONSchema): RaviumJSONSchema;
}

export interface RaviumFieldOptions {
  title?: string;
  description?: string;
  default?: unknown;
}

export interface RaviumNumberFieldOptions extends RaviumFieldOptions {
  min?: number;
  max?: number;
  step?: number;
}

export interface RaviumSelectFieldOptions extends RaviumFieldOptions {
  options: Array<string | { label: string; value: string }>;
}

export interface RaviumArrayFieldOptions extends RaviumFieldOptions {
  minItems?: number;
  maxItems?: number;
}

export interface RaviumObjectFieldOptions extends RaviumFieldOptions {
  required?: string[];
}

export interface RaviumComponentDefinition {
  type: string;
  label: string;
  category?: string;
  runtimeRenderer?: string;
  editorRenderer?: string;
  props?: Record<string, RaviumJSONSchema>;
  propsSchema?: RaviumJSONSchema;
  variants?: Array<Record<string, unknown>>;
  slots?: Array<Record<string, unknown>>;
  palette?: false | { id?: string; label?: string; icon?: string; category?: string };
  rightPanel?: false | { id?: string; title?: string; icon?: string };
  editorPreview?: Record<string, unknown>;
  serverAction?: string;
  [key: string]: unknown;
}

export interface RaviumSourceFileDefinition {
  path: string;
  content: string;
}

export interface RaviumComponentSlotDefinition {
  name?: string;
  label?: string;
  description?: string;
  accepts?: string[];
  required?: boolean;
  multiple?: boolean;
  source?: 'props' | 'children' | 'runtime';
  prop?: string;
  path?: string;
  [key: string]: unknown;
}

export interface RaviumFunctionDefinition {
  id: string;
  label?: string;
  icon?: string;
  inputs?: Array<Record<string, unknown>>;
  outputs?: Array<Record<string, unknown>>;
  runtimeHandler: string;
  editorCard?: string | Record<string, unknown>;
  playgroundAdapter?: string | Record<string, unknown>;
  [key: string]: unknown;
}

export interface RaviumVariableDefinition {
  key: string;
  mode?: 'public' | 'server' | 'encrypted';
  type?: string;
  scope?: 'page' | 'app' | 'global';
  visibility?: 'public' | 'server';
  storage?: 'client' | 'persistent';
  encryption?: 'none' | 'encrypted';
  default?: unknown;
  [key: string]: unknown;
}

export interface RaviumServerRouteDefinition {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: `/${string}`;
  entrypoint: string;
  includeWhen?: 'referenced' | 'installed';
  requestSchema?: RaviumJSONSchema;
  responseSchema?: RaviumJSONSchema;
  [key: string]: unknown;
}

export interface RaviumPageRouteDefinition {
  path: `/${string}`;
  entrypoint: string;
  includeWhen?: 'referenced' | 'installed';
  [key: string]: unknown;
}

export interface RaviumModuleBuilder {
  readonly fields: RaviumFieldFactory;
  readonly declarations: { readonly field: RaviumFieldFactory };
  readonly entrypoints: {
    editor(entrypoint: string): void;
    runtimeClient(entrypoint: string): void;
    runtimeServer(entrypoint: string): void;
    styles(entrypoint: string | false): void;
    generated: {
      editor(entrypoint?: string): void;
      runtimeClient(entrypoint?: string): void;
      runtimeServer(entrypoint?: string): void;
    };
  };
  readonly artifacts: {
    sourceFile(file: RaviumSourceFileDefinition): void;
    sourceFiles(files: RaviumSourceFileDefinition[]): void;
  };
  readonly meta: {
    tag(tag: string): void;
    compatibility(value: Record<string, unknown>): void;
  };
  readonly permissions: {
    request(permission: RaviumModulePermission, context?: Record<string, unknown>): void;
    network: {
      allow(pattern: string, methods?: string[]): void;
    };
  };
  readonly layout: {
    leftMenu: {
      addGroup(group: Record<string, unknown>): void;
      addAction(action: Record<string, unknown>): void;
    };
    rightPanel: {
      addSection(section: Record<string, unknown>): void;
    };
    rightMenu: {
      addSection(section: Record<string, unknown>): void;
    };
    editorTabs: {
      add(tab: Record<string, unknown>): void;
    };
    projectSettings: {
      addPage(page: Record<string, unknown>): void;
    };
    toolbar: {
      addAction(action: Record<string, unknown>): void;
    };
  };
  readonly editor: {
    panel(panel: Record<string, unknown>): void;
    command(command: Record<string, unknown>): void;
    sandbox(entrypoint: string, options?: Record<string, unknown>): void;
    diagnostic(definition: Record<string, unknown>): void;
  };
  readonly canvas: {
    palette: { add(item: Record<string, unknown>): void };
    contextMenu: { addAction(action: Record<string, unknown>): void };
    selection: { addInspector(inspector: Record<string, unknown>): void };
    dropTargets: { define(target: Record<string, unknown>): void };
  };
  readonly blocks: {
    defineType(definition: Record<string, unknown>): void;
    template(template: Record<string, unknown>): void;
  };
  readonly components: {
    define(definition: RaviumComponentDefinition): void;
    create(definition: RaviumComponentDefinition): void;
    createComponent(definition: RaviumComponentDefinition): void;
    props(properties: Record<string, RaviumJSONSchema>, options?: RaviumObjectFieldOptions): RaviumJSONSchema;
    variant(variant: Record<string, unknown>): Record<string, unknown>;
    slot(slot: Record<string, unknown>): Record<string, unknown>;
    slots: {
      define(slot: RaviumComponentSlotDefinition): RaviumComponentSlotDefinition;
      named(name: string, options?: Omit<RaviumComponentSlotDefinition, 'name'>): RaviumComponentSlotDefinition;
      collection(prop: string, options?: Omit<RaviumComponentSlotDefinition, 'prop' | 'source'>): RaviumComponentSlotDefinition;
    };
    editorPreview(preview: Record<string, unknown>): Record<string, unknown>;
    editorRenderer(entrypoint: string): string;
    runtimeRenderer(entrypoint: string): string;
  };
  readonly properties: {
    section(section: Record<string, unknown>): void;
  };
  readonly styles: {
    group(group: Record<string, unknown>): void;
  };
  readonly interactions: {
    define(interaction: Record<string, unknown>): void;
    preset(preset: Record<string, unknown>): void;
  };
  readonly functions: {
    define(definition: RaviumFunctionDefinition): void;
    defineNode(definition: RaviumFunctionDefinition): void;
    input(input: Record<string, unknown>): Record<string, unknown>;
    output(output: Record<string, unknown>): Record<string, unknown>;
    handler(entrypoint: string): string;
    editorCard(card: Record<string, unknown>): Record<string, unknown>;
    playgroundAdapter(adapter: Record<string, unknown>): Record<string, unknown>;
  };
  readonly variables: {
    add(definition: RaviumVariableDefinition): void;
    define(definition: RaviumVariableDefinition): void;
    public(definition: Omit<RaviumVariableDefinition, 'mode'>): void;
    server(definition: Omit<RaviumVariableDefinition, 'mode'>): void;
    encrypted(definition: Omit<RaviumVariableDefinition, 'mode'>): void;
    model(model: Record<string, unknown>): void;
  };
  readonly references: {
    source(source: Record<string, unknown>): void;
    picker(picker: Record<string, unknown>): void;
  };
  readonly project: {
    settings: { schema(name: string, schema: RaviumJSONSchema): void };
    transforms: { add(transform: Record<string, unknown>): void };
    install: { onInstall(hook: Record<string, unknown>): void };
    update: { migrationAssistant(assistant: Record<string, unknown>): void };
    uninstall: { dataExport(exporter: Record<string, unknown>): void };
    assets: {
      images: {
        enable(options?: Record<string, unknown>): void;
        field(options?: RaviumFieldOptions): RaviumJSONSchema;
      };
    };
  };
  readonly assets: {
    module: { add(asset: Record<string, unknown>): void };
  };
  readonly user: {
    files: {
      bucket(bucket: Record<string, unknown>): void;
      uploadRoute(route: RaviumServerRouteDefinition): void;
      imageField(options?: RaviumFieldOptions): RaviumJSONSchema;
      imageListField(options?: RaviumArrayFieldOptions): RaviumJSONSchema;
      enableProjectImages(options?: Record<string, unknown>): void;
    };
  };
  readonly storage: {
    table(table: Record<string, unknown>): void;
    collection(collection: Record<string, unknown>): void;
    kv(store: Record<string, unknown>): void;
  };
  readonly secrets: {
    define(secret: Record<string, unknown>): void;
    read(key: string): Record<string, unknown>;
  };
  readonly runtime: {
    client: {
      onMounted(entrypoint: string | Record<string, unknown>): void;
      localStorage(options?: Record<string, unknown>): void;
      sessionStorage(options?: Record<string, unknown>): void;
      cookie(options: Record<string, unknown>): void;
      fetch(options: { allow: string[]; methods?: string[] }): void;
      timer(options: Record<string, unknown>): void;
      composable(composable: Record<string, unknown>): void;
    };
    server: {
      route(route: RaviumServerRouteDefinition): void;
      middleware(middleware: Record<string, unknown>): void;
      uploadRoute(route: RaviumServerRouteDefinition): void;
      requestSchema(id: string, schema: RaviumJSONSchema): void;
      responseSchema(id: string, schema: RaviumJSONSchema): void;
      handler(handler: Record<string, unknown>): void;
    };
    files: {
      bucket(bucket: Record<string, unknown>): void;
      uploadRoute(route: RaviumServerRouteDefinition): void;
    };
  };
  readonly generated: {
    nuxt: {
      page(route: RaviumPageRouteDefinition): void;
      plugin(plugin: Record<string, unknown>): void;
      composable(composable: Record<string, unknown>): void;
      middleware(middleware: Record<string, unknown>): void;
    };
    env: { require(variable: Record<string, unknown>): void };
    package: { dependency(name: string, version: string, target?: 'runtime' | 'editor' | 'server'): void };
  };
  readonly migrations: {
    postgres(migration: Record<string, unknown>): void;
  };
  readonly dependencies: {
    npm(name: string, version: string, target?: 'runtime' | 'editor' | 'server'): void;
    module(dependency: Record<string, unknown>): void;
  };
  readonly commands: {
    define(command: Record<string, unknown>): void;
  };
  readonly diagnostics: {
    define(diagnostic: Record<string, unknown>): void;
    record(diagnostic: Record<string, unknown>): void;
  };
  readonly moderation: {
    note(note: Record<string, unknown>): void;
    risk(risk: Record<string, unknown>): void;
  };
  readonly testing: {
    scenario(scenario: Record<string, unknown>): void;
  };
  readonly raw: {
    manifest(patch: Record<string, unknown>): void;
    set(path: string, value: unknown): void;
    merge(path: string, value: Record<string, unknown>): void;
    push(path: string, value: unknown): void;
    permission(permission: RaviumModulePermission, context?: Record<string, unknown>): void;
    capability(name: string, payload: Record<string, unknown>): void;
    extensionPoint(name: string, value: unknown): void;
    file(path: string, options?: Record<string, unknown>): void;
    files(paths: string[], options?: Record<string, unknown>): void;
    artifact(artifact: Record<string, unknown>): void;
    compilerFile(file: Record<string, unknown>): void;
  };
  readonly experimental: {
    capability(name: string, payload: Record<string, unknown>): void;
    hostAction(action: Record<string, unknown>): void;
  };
}

export type MutableManifest = RaviumModuleManifestLike & { capabilities: Record<string, unknown> };
