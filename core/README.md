# Core Block

The foundation for every project. Adds PostgreSQL connectivity, theming, layouts, and the base user model on top of a vanilla Nuxt UI template.

Every project includes this block automatically.

## What You Get

- PostgreSQL database connection (`server/utils/database.ts`)
- Migration infrastructure (Nitro plugin runs pending migrations automatically on server startup)
- Users table (id, email, display_name, avatar, timestamps)
- Nuxt UI integration with custom theme color support
- `useTheme` composable and `ThemeToggle` component
- Two layouts: `default` (app shell) and `auth` (centered card)
- Landing page and dashboard page

## Files

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

## Environment Variables

```env
APP_TITLE=My App
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
NODE_ENV=development
NUXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Where to get `DATABASE_URL`

You need a PostgreSQL database. Options:

| Provider | How to Get the URL |
|----------|--------------------|
| **Local Postgres** | Install PostgreSQL, create a database, use `postgresql://localhost:5432/mydb` |
| **Neon** | Sign up at [neon.tech](https://neon.tech), create a project, copy the connection string from the dashboard |
| **Supabase** | Sign up at [supabase.com](https://supabase.com), create a project, go to Settings > Database > Connection String |
| **Railway** | Sign up at [railway.com](https://railway.com), add a Postgres service, copy the `DATABASE_URL` from Variables |

### Where to put it

Add to `.env` in your project root:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## Dependencies

None (this is the base block).

## npm Packages

```
postgres ^3.4.7
```
