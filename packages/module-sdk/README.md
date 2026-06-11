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
