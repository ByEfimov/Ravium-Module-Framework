# Ravium Module Framework

Public developer toolkit for Ravium modules.

## Packages

- `@ravium/module-sdk` - typed SDK for module manifests, editor/runtime entrypoints, permissions and escape hatches.
- `@ravium/cli` - CLI for scaffold, validation, build, packaging, dependency audit and publish.

## Install

```bash
pnpm add @ravium/module-sdk
pnpm add -D @ravium/cli
```

## Create Module

```bash
pnpm dlx @ravium/cli module init my-module \
  --namespace acme \
  --slug my-module \
  --name "My Module"
```

Module source of truth:

```js
import { defineRaviumModule } from '@ravium/module-sdk'

export default defineRaviumModule({
  meta: {
    namespace: 'acme',
    slug: 'my-module',
    name: 'My Module',
    description: 'Adds custom Ravium behavior',
    version: '1.0.0',
  },
  setup(ravium) {
    ravium.components.createComponent({
      type: 'acme.card',
      label: 'Acme Card',
      runtimeRenderer: 'src/components/AcmeCard.vue',
    })

    ravium.variables.add({
      key: 'acmeCardCount',
      label: 'Acme card count',
      type: 'number',
      scope: 'project',
      defaultValue: 0,
    })

    ravium.raw.set('future.anything', {
      enabled: true,
    })
  },
})
```

## Local Development

```bash
pnpm install
pnpm run check
```

## Manual Public Publish

1. Create npm organization `ravium` or get publish access to `@ravium`.
2. Login:

```bash
npm login
```

3. Build and publish:

```bash
pnpm run publish:public
```

## GitHub Actions Publish

Add repository secret:

- `NPM_TOKEN` - npm automation token with publish access to `@ravium`.

Then create a GitHub release or run the `Publish npm packages` workflow manually.
