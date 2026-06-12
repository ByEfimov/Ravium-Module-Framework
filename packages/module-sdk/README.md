# @ravium/module-sdk

Typed SDK for Ravium module authors.

```js
import { defineRaviumModule } from '@ravium/module-sdk'

export default defineRaviumModule({
  meta: {
    namespace: 'acme',
    slug: 'gallery',
    name: 'Gallery',
    description: 'Gallery module',
    version: '1.0.0',
  },
  setup(ravium) {
    ravium.components.createComponent({
      type: 'acme.gallery',
      label: 'Gallery',
      runtimeRenderer: 'src/components/Gallery.vue',
    })
  },
})
```

## Npm integrations

Use integration helpers when a module wraps an existing npm library:

```js
import { createVueNpmComponentIntegration } from '@ravium/module-sdk/integrations/vue'

createVueNpmComponentIntegration(ravium, {
  component: {
    type: 'chart',
    label: 'Chart',
    runtimeRenderer: 'src/components/ChartBlock.vue',
  },
  npm: [{ name: 'chart.js', version: '^4.5.0', target: 'runtime' }],
})
```

For lower-level control, register packages directly:

```js
import { registerNpmPackage } from '@ravium/module-sdk/integrations/npm'

registerNpmPackage(ravium, { name: 'your-runtime-package', version: '^1.0.0', target: 'runtime' })
```

Library-specific adapters, settings schemas, renderers, and editor previews
belong in the module source or in a separate shared package owned by those
modules. Core `@ravium/module-sdk` stays generic.
