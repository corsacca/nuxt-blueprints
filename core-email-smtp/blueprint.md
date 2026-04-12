# SMTP Email Block

Email transport via SMTP. Uses MailHog in development mode.

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
  "nodemailer": "^7.0.6"
}
```

devDependencies:
```json
{
  "@types/nodemailer": "^7.0.1"
}
```

## Config

Add to `nuxt.config.ts` runtimeConfig:

```typescript
smtpHost: process.env.SMTP_HOST || '',
smtpPort: process.env.SMTP_PORT || '',
smtpUser: process.env.SMTP_USER || '',
smtpPass: process.env.SMTP_PASS || '',
smtpSecure: process.env.SMTP_SECURE || '',
smtpRejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED || '',
smtpFrom: process.env.SMTP_FROM || '',
smtpFromName: process.env.SMTP_FROM_NAME || '',
```

## Environment Variables

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=My App
SMTP_REJECT_UNAUTHORIZED=true
```

## Development

In development, emails are sent to MailHog on localhost:1025. View them at http://localhost:8025.
