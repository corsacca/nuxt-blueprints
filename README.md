# Nuxt Blueprints

A composable block-based system for scaffolding Nuxt applications. Instead of sharing code as a runtime layer, blueprints are copied into your project at creation time. You own the code and can edit anything directly.

## Getting Started

Blueprints are assembled by Claude Code — it reads this repo, maps your request to blocks, and scaffolds a new Nuxt project with everything wired together.

### 1. Create an empty directory for your project

```bash
mkdir my-app && cd my-app
```

You don't need to run `nuxi init` yourself — Claude will scaffold the Nuxt project for you from the `ui` template.

### 2. Open Claude Code in that directory

```bash
claude
```

### 3. Tell Claude to build from the blueprints

Point it at this repo and describe what you want:

```
Build a Nuxt app from the blueprints at
https://github.com/corsacca/nuxt-blueprints

I want JWT auth, Mailgun email, and S3 storage.
```

Claude will clone the blueprints repo (or read it directly), resolve dependencies from [manifest.json](manifest.json), confirm the block list with you, then scaffold the project following the assembly instructions in [CLAUDE.md](CLAUDE.md).

### 4. Install and run

```bash
cp .env.example .env   # then fill in real values
npm install
npm run dev
```

See [BLUEPRINTS.md](BLUEPRINTS.md) for the full philosophy and [CLAUDE.md](CLAUDE.md) for the step-by-step assembly process Claude follows.

## Available Blocks

| Block | Type | Description | Docs |
|-------|------|-------------|------|
| [core](core/) | Always | Database, theming, layouts, users table | [core/README.md](core/README.md) |
| [auth-jwt](auth-jwt/) | Default | JWT auth with login, register, profile, password reset | [auth-jwt/README.md](auth-jwt/README.md) |
| [email/smtp](email/smtp/) | Choice (default) | SMTP email transport | [email/README.md](email/README.md) |
| [email/mailgun](email/mailgun/) | Choice | Mailgun HTTP API email transport | [email/README.md](email/README.md) |
| [email/ses](email/ses/) | Choice | AWS SES email transport | [email/README.md](email/README.md) |
| [activity-log](activity-log/) | Default | Audit trail for user actions | [activity-log/README.md](activity-log/README.md) |
| [rate-limiting/db](rate-limiting/db/) | Choice (default) | Database-backed rate limiting | [rate-limiting/README.md](rate-limiting/README.md) |
| [rate-limiting/memory](rate-limiting/memory/) | Choice | In-memory rate limiting | [rate-limiting/README.md](rate-limiting/README.md) |
| [auth-google](auth-google/) | Optional | Google OAuth sign-in | [auth-google/README.md](auth-google/README.md) |
| [auth-firebase](auth-firebase/) | Optional | Firebase multi-provider OAuth | [auth-firebase/README.md](auth-firebase/README.md) |
| [s3-storage](s3-storage/) | Optional | S3-compatible file uploads | [s3-storage/README.md](s3-storage/README.md) |
| [kitchen-sink](kitchen-sink/) | Optional | UI component showcase page | [kitchen-sink/README.md](kitchen-sink/README.md) |

### Block Types

- **Always** -- included in every project
- **Default** -- included unless you specifically exclude it
- **Choice** -- pick one from a group (email provider, rate limiting strategy)
- **Optional** -- only included when you ask for it

## Environment Variables at a Glance

Every block documents its own env vars. Here's a combined reference:

### Core (required for all projects)

```env
APP_TITLE=My App
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
NODE_ENV=development
NUXT_PUBLIC_SITE_URL=http://localhost:3000
```

Where to get `DATABASE_URL`: any PostgreSQL provider -- [Neon](https://neon.tech), [Supabase](https://supabase.com/database), [Railway](https://railway.com), or a local Postgres install.

### Auth (JWT)

```env
JWT_SECRET=your-super-secret-jwt-key-change-this
```

Generate one: `openssl rand -base64 32`

### Email

See [email/README.md](email/README.md) for provider-specific variables.

### S3 Storage

See [s3-storage/README.md](s3-storage/README.md).

### Google OAuth

See [auth-google/README.md](auth-google/README.md).

### Firebase Auth

See [auth-firebase/README.md](auth-firebase/README.md).

## Where Do Keys Go?

All environment variables go in a `.env` file at your project root. When scaffolding, a `.env.example` is generated with all required variables for the blocks you selected. Copy it:

```bash
cp .env.example .env
```

Then fill in your actual values. Never commit `.env` to git.
