# AWS SES Email Block

Email transport via AWS SES SDK. Bypasses SMTP port restrictions. Uses MailHog in development mode.

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
  "@aws-sdk/client-ses": "^3.955.0"
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
awsRegion: process.env.AWS_REGION || '',
awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
smtpFrom: process.env.SMTP_FROM || '',
smtpFromName: process.env.SMTP_FROM_NAME || '',
```

## Environment Variables

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=My App
```

## Development

In development, emails are sent to MailHog on localhost:1025. View them at http://localhost:8025.
