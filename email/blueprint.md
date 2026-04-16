# Email Block

Email sending with templated messages. Choose one provider below. All providers use MailHog in development mode.

## Shared Files

These files are the same regardless of provider — copy from `email/shared/`:

```
server/utils/email-templates.ts
```

## Options

- `smtp` — SMTP transport (default)
- `mailgun` — Mailgun HTTP API
- `ses` — AWS SES SDK

Each option provides its own `server/utils/email.ts` with the same exported functions (`sendEmail`, `sendTemplateEmail`, `sendBulkTemplateEmails`).

## Dependencies

- `core`
