import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { renderEmailTemplate, type EmailTemplateData } from './email-templates'

const isDevelopment = (process.env.NODE_ENV || 'development') === 'development'

let transporter: Transporter | null = null

function getEmailConfig() {
  try {
    const config = useRuntimeConfig()
    return {
      smtpHost: config.smtpHost || process.env.SMTP_HOST,
      smtpPort: config.smtpPort || process.env.SMTP_PORT || '587',
      smtpUser: config.smtpUser || process.env.SMTP_USER,
      smtpPass: config.smtpPass || process.env.SMTP_PASS,
      smtpSecure: config.smtpSecure || process.env.SMTP_SECURE || 'false',
      smtpRejectUnauthorized: config.smtpRejectUnauthorized || process.env.SMTP_REJECT_UNAUTHORIZED || 'true',
      smtpFrom: config.smtpFrom || process.env.SMTP_FROM,
      smtpFromName: config.smtpFromName || process.env.SMTP_FROM_NAME,
      appName: config.appName || process.env.APP_NAME
    }
  } catch {
    return {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT || '587',
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      smtpSecure: process.env.SMTP_SECURE || 'false',
      smtpRejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED || 'true',
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

  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    throw new Error('SMTP configuration incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.')
  }

  console.log('[Email] Using SMTP')
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: parseInt(config.smtpPort),
    secure: config.smtpSecure === 'true',
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    },
    tls: {
      rejectUnauthorized: config.smtpRejectUnauthorized !== 'false'
    }
  })

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
