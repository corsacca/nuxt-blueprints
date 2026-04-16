# Email Block

Email sending with templated messages. Choose one provider -- all three export the same functions (`sendEmail`, `sendTemplateEmail`, `sendBulkTemplateEmails`) so the rest of your code doesn't change.

All providers use [MailHog](https://github.com/mailhog/MailHog) in development mode (localhost:1025). View sent emails at http://localhost:8025.

## Providers

### SMTP (default)

Standard SMTP transport. Works with any email provider that supports SMTP.

#### Environment Variables

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

#### Where to get SMTP credentials

| Provider | How |
|----------|-----|
| **MailHog (dev)** | No credentials needed. Install MailHog, it runs on localhost:1025 |
| **Mailgun SMTP** | [Mailgun Dashboard](https://app.mailgun.com/sending/domains) > Select domain > SMTP Credentials |
| **SendGrid** | [SendGrid Dashboard](https://app.sendgrid.com/settings/api_keys) > Create API Key, use `apikey` as SMTP_USER |
| **AWS SES SMTP** | [AWS SES Console](https://console.aws.amazon.com/ses/) > SMTP Settings > Create SMTP Credentials |
| **Gmail** | Use an [App Password](https://myaccount.google.com/apppasswords) with `smtp.gmail.com:587` |

#### npm Packages

```
nodemailer ^7.0.6
```

---

### Mailgun

Mailgun HTTP API transport. Bypasses SMTP port restrictions on platforms like Railway.

#### Environment Variables

```env
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_HOST=
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=My App
```

#### Where to get Mailgun credentials

1. Sign up at [mailgun.com](https://www.mailgun.com)
2. **API Key**: Go to [Settings > API Security](https://app.mailgun.com/settings/api_security) and copy your Private API Key
3. **Domain**: Go to [Sending > Domains](https://app.mailgun.com/sending/domains). Use the sandbox domain for testing or add your own domain
4. **Host** (optional): Set to `api.eu.mailgun.net` if your Mailgun account is in the EU region. Leave empty for US

#### Where to put it

Add to `.env` in your project root:

```env
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.yourdomain.com
```

#### npm Packages

```
nodemailer ^7.0.6
nodemailer-mailgun-transport ^2.1.5
```

---

### AWS SES

AWS Simple Email Service transport. Bypasses SMTP port restrictions.

#### Environment Variables

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=My App
```

#### Where to get AWS SES credentials

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new IAM user (or use an existing one) with `AmazonSESFullAccess` policy
3. Go to the user's **Security Credentials** tab > **Create Access Key**
4. Copy the `Access Key ID` and `Secret Access Key`
5. Go to [AWS SES Console](https://console.aws.amazon.com/ses/) and verify your sending domain or email address
6. If your account is in the SES sandbox, you can only send to verified addresses. [Request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) to send to anyone

#### Where to put it

Add to `.env` in your project root:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

#### npm Packages

```
@aws-sdk/client-ses ^3.955.0
nodemailer ^7.0.6
```

## Shared Files

All providers include `server/utils/email-templates.ts` from `email/shared/`. This provides the HTML email template system used by auth flows (verification, password reset, etc.).

## Dependencies

- `core`
