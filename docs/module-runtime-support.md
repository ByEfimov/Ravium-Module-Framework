# Module Runtime Support Contract

## Goal

Runtime modules must be small at the renderer boundary and explicit in their adapters.
Generated applications must import the same support files that editor preview and module
source use. No renderer should duplicate defaults, npm adapter maps, CSS loaders, or
library option builders that already live in module support files.

## Rules

- `settingsSchema` is the source of truth for editor-visible defaults.
- Runtime renderer files keep UI orchestration only: template, component imports, attrs/slots wiring.
- Library-specific option mapping lives in support files next to the renderer.
- Reusable framework-owned helper files are registered with `ravium.artifacts.sourceFile(...)`
  or integration `runtimeSupportFiles`.
- Generated apps copy relative imports from runtime renderers into the generated runtime module
  folder, so runtime, view, and deployed app use the same module code.
- `ravium module build` also emits `artifactRefs.runtimeComponentBundles` for Vue runtime
  renderers. Platform `/application` and `/view` must prefer this browser bundle over legacy
  editor iframe renderers; iframe is only a backward-compatible fallback for old artifacts.
- Module props stored by Ravium contain only user overrides; runtime support merges defaults.

## Forbidden

- Duplicating a full default props object inside a Vue renderer when it already exists in schema
  or support files.
- Inlining large npm library import/config maps into the renderer when a support helper can own them.
- Making generated apps depend on unpublished SDK runtime imports.
- Adding module-specific logic to the compiler when a generic support-file contract is enough.
- Using editor iframe HTML as the primary preview for a component that ships a Vue runtime
  renderer.

## Preferred Shape

```ts
createVueNpmComponentIntegration(ravium, {
  component,
  settings,
  npm,
  runtimeSupportFiles: [
    { path: 'src/runtime/library-options.js', content: optionsSource },
  ],
})
```

```vue
<script setup lang="ts">
import { useAttrs, useSlots, computed } from 'vue'
import { useLibraryComponent } from './library-options.js'

const attrs = useAttrs()
const slots = useSlots()
const model = useLibraryComponent(attrs, slots)
</script>
```
