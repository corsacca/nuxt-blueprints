# Core Block

The foundation for every project. Adds database connectivity, theming customizations, layouts, and the base user model on top of the Nuxt UI template.

## Prerequisites

Project scaffolded with `nuxi init` using the **ui** template. This provides `app.vue`, `nuxt.config.ts`, `package.json`, `app/assets/css/main.css`, Nuxt UI, Tailwind, and icons.

## Dependencies

None (this is the base block).

## New Files to Copy

These files don't exist in the ui template — copy them directly into the project:

```
app/components/ThemeToggle.vue
app/composables/useTheme.ts
app/layouts/default.vue
app/layouts/auth.vue
app/pages/index.vue
app/pages/dashboard.vue
server/utils/database.ts
server/plugins/migrations.ts
migrations/001_create_users_table.js
```

## Existing Files to Modify

These files already exist from the ui template. Modify them — don't replace them.

### `app/assets/css/main.css`

Add the `@source inline(...)` directives after the existing imports. These ensure Nuxt UI CSS variable utilities are generated correctly:

```css
@source inline("{hover:,}text-(--ui-text)");
@source inline("{hover:,}text-(--ui-text-muted)");
@source inline("{hover:,}text-(--ui-text-dimmed)");
@source inline("{hover:,}text-(--ui-text-toned)");
@source inline("{hover:,}text-(--ui-text-highlighted)");
@source inline("{hover:,}text-(--ui-text-inverted)");
@source inline("bg-(--ui-bg)");
@source inline("border-(--ui-border)");
```

### `nuxt.config.ts`

Add to the existing config (don't remove what the ui template provides):

```typescript
// Add these properties alongside existing ones:
ssr: false,

ui: {
  theme: {
    colors: ['primary', 'secondary', 'info', 'success', 'warning', 'error', 'neutral']
  }
},

app: {
  head: {
    title: process.env.APP_TITLE || 'My App',
  }
},

runtimeConfig: {
  appName: process.env.APP_TITLE || 'My App',
  databaseUrl: process.env.DATABASE_URL || '',
  public: {
    appName: process.env.APP_TITLE || 'My App',
    nodeEnv: process.env.NODE_ENV || '',
    siteUrl: process.env.NUXT_PUBLIC_SITE_URL || ''
  }
}
```

### `package.json`

Add dependency:
```json
{
  "postgres": "^3.4.7"
}
```

No script changes needed. Migrations run automatically on server startup via the Nitro plugin (`server/plugins/migrations.ts`).

### `app/app.vue`

Replace the ui template's demo content with a clean app shell:

```vue
<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

### `app/app.config.ts`

Keep or adjust the existing config. The ui template provides a good default.

## Environment Variables

Create `.env.example` (and `.env` for local dev):

```env
APP_TITLE=My App
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
NODE_ENV=development
NUXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Migrations

- `001_create_users_table.js` — Creates the `users` table with core fields (id, email, display_name, avatar, timestamps)

## Wiring Notes

- The `default.vue` layout is a basic app shell. Auth blocks should modify it to add user info and profile links in the header.
- The `index.vue` page is a minimal landing page. Auth blocks should modify it to add login/register CTAs and auth-aware redirects.
- The `dashboard.vue` page is a placeholder. Auth blocks should add the auth middleware to protect it.
- Migrations run automatically on server startup via the Nitro plugin (`server/plugins/migrations.ts`). It loads all `.js` files in `migrations/` sorted by filename number prefix.
- Delete the ui template's demo components (`AppLogo.vue`, `TemplateMenu.vue`) as they are not needed.
