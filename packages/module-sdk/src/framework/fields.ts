import type { RaviumFieldFactory, RaviumFieldOptions, RaviumJSONSchema, RaviumObjectFieldOptions } from './types.js';

export const toSchemaObject = (
  properties: Record<string, RaviumJSONSchema>,
  options?: RaviumObjectFieldOptions,
): RaviumJSONSchema => ({
  type: 'object',
  properties,
  ...(options?.title ? { title: options.title } : {}),
  ...(options?.description ? { description: options.description } : {}),
  ...(options?.default !== undefined ? { default: options.default } : {}),
  ...(Array.isArray(options?.required) ? { required: options.required } : {}),
});

const fieldBase = (type: RaviumJSONSchema['type'], options?: RaviumFieldOptions): RaviumJSONSchema => ({
  type,
  ...(options?.title ? { title: options.title } : {}),
  ...(options?.description ? { description: options.description } : {}),
  ...(options?.default !== undefined ? { default: options.default } : {}),
});

export const createFields = (): RaviumFieldFactory => ({
  text: (options) => fieldBase('string', options),
  textarea: (options) => ({ ...fieldBase('string', options), format: 'textarea' }),
  number: (options) => ({
    ...fieldBase('number', options),
    ...(typeof options?.min === 'number' ? { minimum: options.min } : {}),
    ...(typeof options?.max === 'number' ? { maximum: options.max } : {}),
    ...(typeof options?.step === 'number' ? { multipleOf: options.step } : {}),
  }),
  integer: (options) => ({
    ...fieldBase('integer', options),
    ...(typeof options?.min === 'number' ? { minimum: options.min } : {}),
    ...(typeof options?.max === 'number' ? { maximum: options.max } : {}),
    ...(typeof options?.step === 'number' ? { multipleOf: options.step } : {}),
  }),
  boolean: (options) => fieldBase('boolean', options),
  color: (options) => ({ ...fieldBase('string', options), format: 'color' }),
  select: (options) => ({
    ...fieldBase('string', options),
    enum: options.options.map((option) => (typeof option === 'string' ? option : option.value)),
    'x-raviumOptions': options.options,
  }),
  image: (options) => ({ ...fieldBase('string', options), 'x-raviumInput': 'image-upload' }),
  imageList: (options) => ({
    ...fieldBase('array', options),
    'x-raviumInput': 'image-list',
    items: { type: 'string', 'x-raviumInput': 'image-upload' },
    ...(typeof options?.minItems === 'number' ? { minItems: options.minItems } : {}),
    ...(typeof options?.maxItems === 'number' ? { maxItems: options.maxItems } : {}),
  }),
  componentSelect: (options) => ({ ...fieldBase('string', options), 'x-raviumInput': 'component-select' }),
  variable: (options) => ({ ...fieldBase('string', options), 'x-raviumInput': 'variable-select' }),
  function: (options) => ({ ...fieldBase('string', options), 'x-raviumInput': 'function-select' }),
  json: (options) => ({ ...fieldBase('object', options), 'x-raviumInput': 'json' }),
  array: (item, options) => ({
    ...fieldBase('array', options),
    items: item,
    ...(typeof options?.minItems === 'number' ? { minItems: options.minItems } : {}),
    ...(typeof options?.maxItems === 'number' ? { maxItems: options.maxItems } : {}),
  }),
  object: toSchemaObject,
  ref: (ref) => ({ $ref: ref }),
  custom: (schema) => schema,
});
