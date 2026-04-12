# Mailgun Email Block

Email transport via Mailgun HTTP API. Bypasses SMTP port restrictions on platforms like Railway. Uses MailHog in development mode.

## Dependencies

- `core`

## Files Provided

```
server/utils/email.ts
server/utils/email-templates.ts
```

## Package Dependencies

```json
{
  "nodemailer": "^7.0.6",
  "nodemailer-mailgun-transport": "^2.1.5"
}
```

devDependencies:
```json
{
  "@types/nodemailer": "^7.0.1",
  "@types/nodemailer-mailgun-transport": "^1.4.6"
}
```

## Config

Add to `nuxt.config.ts` runtimeConfig:

```typescript
mailgunApiKey: process.env.MAILGUN_API_KEY || '',
mailgunDomain: process.env.MAILGUN_DOMAIN || '',
mailgunHost: process.env.MAILGUN_HOST || '',
smtpFrom: process.env.SMTP_FROM || '',
smtpFromName: process.env.SMTP_FROM_NAME || '',
```

## Environment Variables

```env
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com
# Optional: Use 'api.eu.mailgun.net' for EU region
MAILGUN_HOST=
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=My App
```

## Development

In development, emails are sent to MailHog on localhost:1025. View them at http://localhost:8025.
