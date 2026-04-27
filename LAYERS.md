# Adding Remote Layers to a Blueprint Project

Blueprints copy code into your project — you own it. **Remote layers** (Nuxt's `extends` mechanism) work alongside that: they let you pull additional functionality from a GitHub repo or npm package without copying it.

By default, c12 (Nuxt's config loader) downloads remote layers into `node_modules/.c12/<hashed-name>/`. That works, but the layer is invisible (hidden in node_modules), hard to inspect, and gets blown away by `rm -rf node_modules`. This doc shows how to relocate layers to `.layers/<name>/` so they're easier to read, easier to debug, and not tied to your dependency cache.

## When to use this

Use the `.layers/` pattern when:
- You want to read or grep through the layer's source easily.
- You're debugging an issue and need to see what files the layer is actually shipping.
- You want the layer dir to survive `rm -rf node_modules`.

Skip it (let layers stay in `node_modules/.c12/`) when:
- The layer is a stable npm package and you never need to inspect it.
- You don't care where it lives.

## The setup

### 1. `nuxt.config.ts`

For each remote layer, use the tuple form of `extends` and pass `giget` options to override the destination:

```ts
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const LAYERS_DIR = '.layers'

// Strip layer-level tsconfig.json files. Layers extracted from full Nuxt
// projects often ship a tsconfig.json that references ./.nuxt/tsconfig.*.json
// (only generated when the layer is opened as its own project). When the layer
// lives under node_modules, Vite's tsconfig walker skips it. When it lives at
// .layers/<name>, Vite picks it up and crashes on the missing references.
function stripLayerTsconfigs() {
  if (!existsSync(LAYERS_DIR)) return
  for (const name of readdirSync(LAYERS_DIR)) {
    const tsconfig = join(LAYERS_DIR, name, 'tsconfig.json')
    if (existsSync(tsconfig)) rmSync(tsconfig)
  }
}

stripLayerTsconfigs()

export default defineNuxtConfig({
  extends: [
    ['github:owner/repo#branch', {
      giget: { dir: `${LAYERS_DIR}/repo`, forceClean: true }
    }],
    // Add more layers here using the same pattern.
  ],

  hooks: {
    'modules:before': stripLayerTsconfigs
  }
})
```

### 2. `.gitignore`

Add `.layers` so the cloned layers aren't committed:

```
# Extended layers (downloaded by c12/giget)
.layers
```

### 3. Done

Run `npm install` (or `bun install`). The `nuxt prepare` postinstall triggers c12, which extracts each layer into `.layers/<name>/`. Subsequent `nuxt dev` and `nuxt build` runs re-extract on every boot (because `forceClean: true` is set), keeping the layer in sync with the remote.

## Why each piece exists

### `giget: { dir, forceClean }`

c12 computes a default path under `node_modules/.c12/` and passes it as `dir` to giget. The spread of `sourceOptions.giget` happens *after*, so `dir` here overrides it. ([c12/dist/index.mjs:294-301](../../nuxt/starter/node_modules/c12/dist/index.mjs))

`forceClean: true` tells giget to remove the destination before extracting. Without it, the second `nuxt prepare` (or `nuxt dev`) fails with `Destination ... already exists` — c12's own stale-cleanup at line 293 only targets the default `node_modules/.c12/` path, so it's a no-op when you've overridden `dir`.

### `stripLayerTsconfigs()` and the `modules:before` hook

The standalone call at the top of the file handles the case where the layer was extracted in a previous run and Vite reads it before any Nuxt hook fires (e.g. when modules call into Vite plugins early). The `modules:before` hook handles freshly-extracted layers — it runs after c12 has resolved `extends` but before module loading and Vite startup.

If you only ever consume layers that don't ship a `tsconfig.json` (e.g. layers published as proper npm packages), you can omit the hook and the call.

### `.gitignore`

The layer is a build-time artifact, like `node_modules`. Committing it would defeat the purpose of `extends` (you'd just have a vendored copy).

## Caveats

- **Re-download cost:** every `nuxt prepare`/`nuxt dev`/`nuxt build` re-extracts the layer (a few seconds per layer). For very large layers or slow connections, consider pinning to a specific tag and switching `forceClean: true` → `force: true` (overwrites without removing first, slightly faster).
- **The layer's own `package.json` is not installed.** If the layer needs runtime dependencies, add them to your project's `package.json`. (This is true regardless of where the layer lives — c12 doesn't run `npm install` inside the layer.)
- **Migrations from layers:** if a layer ships migrations (like `nuxt-base`), and your migrate script globs `node_modules/.c12/...`, update the script to point at `.layers/<name>/migrations/...` instead. Blueprint-owned migrations are unaffected because they're already copied directly into your project.

## Adding more layers later

For each new remote layer:

1. Append a new tuple to `extends`:
   ```ts
   ['github:owner/another-layer', { giget: { dir: '.layers/another-layer', forceClean: true } }]
   ```
2. No other changes needed — the `stripLayerTsconfigs()` helper iterates everything under `.layers/`, so it picks up new layers automatically.
3. Run `nuxt prepare` once to verify the layer extracts and types regenerate cleanly.
