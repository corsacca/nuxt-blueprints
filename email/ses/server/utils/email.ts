import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { renderEmailTemplate, type EmailTemplateData } from './email-templates'

const isDevelopment = (process.env.NODE_ENV || 'development') === 'development'

let transporter: Transporter | null = null
let sesClient: SESClient | null = null

function getEmailConfig() {
  try {
    const config = useRuntimeConfig()
    return {
      awsRegion: config.awsRegion || process.env.AWS_REGION || process.env.AWS_SES_REGION,
      awsAccessKeyId: config.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: config.awsSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      smtpFrom: config.smtpFrom || process.env.SMTP_FROM,
      smtpFromName: config.smtpFromName || process.env.SMTP_FROM_NAME,
      appName: config.appName || process.env.APP_NAME
    }
  } catch {
    return {
      awsRegion: process.env.AWS_REGION || process.env.AWS_SES_REGION,
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      smtpFrom: process.env.SMTP_FROM,
      smtpFromName: process.env.SMTP_FROM_NAME,
      appName: process.env.APP_NAME
    }
  }
}

function getTransporter(): Transporter {
  if (transporter) return transporter

  const config = getEmailConfig()

  if (isDevelopment) {
    console.log('[Email] Using MailHog (development mode)')
    transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      tls: { rejectUnauthorized: false }
    })
    return transporter
  }

  if (!config.awsRegion || !config.awsAccessKeyId || !config.awsSecretAccessKey) {
    throw new Error('AWS SES configuration incomplete. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.')
  }

  console.log('[Email] Using AWS SES')
  sesClient = new SESClient({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey
    }
  })

  transporter = nodemailer.createTransport({
    SES: { ses: sesClient, aws: { SendRawEmailCommand } }
  } as any)

  return transporter
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
}

export interface TemplateEmailOptions {
  to: string | string[]
  template: keyof typeof import('./email-templates').emailTemplates
  data: EmailTemplateData
  from?: string
  subject?: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const config = getEmailConfig()

    let fromEmail = options.from
    if (!fromEmail) {
      const fromName = config.smtpFromName || config.appName
      const fromAddress = isDevelopment
        ? 'noreply@localhost.local'
        : (config.smtpFrom || 'noreply@yourdomain.com')
      fromEmail = fromName ? `${fromName} <${fromAddress}>` : fromAddress
    }

    const mailOptions = {
      from: fromEmail,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '')
    }

    const info = await getTransporter().sendMail(mailOptions)
    console.log('[Email] Sent successfully:', info.messageId)
    return true
  } catch (error) {
    if (!process.env.VITEST) {
      console.error('[Email] Error sending:', error)
    }
    return false
  }
}

export async function sendTemplateEmail(options: TemplateEmailOptions): Promise<boolean> {
  try {
    const config = getEmailConfig()
    const appName = config.appName || 'App'

    const templateData = { ...options.data, appName }
    const { subject, html, text } = renderEmailTemplate(options.template, templateData)

    return await sendEmail({
      to: options.to,
      subject: options.subject || subject,
      html,
      text,
      from: options.from
    })
  } catch (error) {
    if (!process.env.VITEST) {
      console.error('[Email] Error sending template email:', error)
    }
    return false
  }
}

export async function sendBulkTemplateEmails(emails: TemplateEmailOptions[]): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const email of emails) {
    const result = await sendTemplateEmail(email)
    if (result) success++
    else failed++
  }

  return { success, failed }
}
