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

Dedicated presets can hide shared adapter code:

```js
import { createSwiperCarouselIntegration } from '@ravium/module-sdk/integrations/swiper'

createSwiperCarouselIntegration(ravium, {
  runtimeRenderer: 'src/components/SwiperCarousel.vue',
  editorRenderer: 'src/editor-renderer.html',
})
```
