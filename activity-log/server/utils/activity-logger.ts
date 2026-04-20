import { db } from './database'
import crypto from 'crypto'
import type { H3Event } from 'h3'
import type { Kysely } from 'kysely'
import type { Database } from '~/server/database/schema'
import { getAuthUser } from './auth'

interface LogEventOptions {
  eventType: string
  tableName?: string
  recordId?: string
  userId?: string
  userAgent?: string
  metadata?: Record<string, any>
}

/**
 * Core function to log an activity event.
 *
 * Accepts an optional `executor` so the insert can run inside a caller's
 * transaction — useful when the audit row must commit atomically with the
 * operation it describes (e.g. granting the first user the admin role).
 * Defaults to the global db for fire-and-forget use from helpers.
 */
export async function logEvent(
  options: LogEventOptions,
  executor: Kysely<Database> = db
): Promise<void> {
  try {
    await executor
      .insertInto('activity_logs')
      .values({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        event_type: options.eventType,
        table_name: options.tableName ?? null,
        record_id: options.recordId ?? null,
        user_id: options.userId ?? null,
        user_agent: options.userAgent ?? null,
        metadata: options.metadata ?? {},
      })
      .execute()
  } catch (error) {
    // Log error but don't throw - logging should never break the main flow
    console.error('Failed to log activity:', error)
  }
}

/**
 * Helper to extract user info from H3Event
 */
function getUserInfoFromEvent(event: H3Event | null): { userId?: string; userAgent?: string } {
  if (!event) return {}

  const user = getAuthUser(event)
  const userAgent = getHeader(event, 'user-agent') || undefined

  return {
    userId: user?.userId,
    userAgent
  }
}

/**
 * Log a CREATE event
 */
export function logCreate(
  tableName: string,
  recordId: string,
  userIdOrEvent?: string | H3Event,
  metadata?: any
): void {
  let userId: string | undefined
  let userAgent: string | undefined

  if (typeof userIdOrEvent === 'string') {
    userId = userIdOrEvent
  } else if (userIdOrEvent) {
    const info = getUserInfoFromEvent(userIdOrEvent)
    userId = info.userId
    userAgent = info.userAgent
  }

  logEvent({
    eventType: 'CREATE',
    tableName,
    recordId,
    userId,
    userAgent,
    metadata
  })
}

/**
 * Log an UPDATE event
 */
export function logUpdate(
  tableName: string,
  recordId: string,
  userIdOrEvent?: string | H3Event,
  metadata?: any
): void {
  let userId: string | undefined
  let userAgent: string | undefined

  if (typeof userIdOrEvent === 'string') {
    userId = userIdOrEvent
  } else if (userIdOrEvent) {
    const info = getUserInfoFromEvent(userIdOrEvent)
    userId = info.userId
    userAgent = info.userAgent
  }

  logEvent({
    eventType: 'UPDATE',
    tableName,
    recordId,
    userId,
    userAgent,
    metadata
  })
}

/**
 * Log a DELETE event
 */
export function logDelete(
  tableName: string,
  recordId: string,
  userIdOrEvent?: string | H3Event,
  metadata?: any
): void {
  let userId: string | undefined
  let userAgent: string | undefined

  if (typeof userIdOrEvent === 'string') {
    userId = userIdOrEvent
  } else if (userIdOrEvent) {
    const info = getUserInfoFromEvent(userIdOrEvent)
    userId = info.userId
    userAgent = info.userAgent
  }

  logEvent({
    eventType: 'DELETE',
    tableName,
    recordId,
    userId,
    userAgent,
    metadata
  })
}

/**
 * Log a successful LOGIN event
 */
export function logLogin(
  userId: string,
  userAgent?: string,
  metadata?: any
): void {
  logEvent({
    eventType: 'LOGIN',
    userId,
    userAgent,
    metadata
  })
}

/**
 * Log a failed LOGIN attempt
 * Note: email must be stored in metadata.email for privacy
 */
export function logLoginFailed(
  email: string,
  userAgent?: string,
  metadata?: any
): void {
  logEvent({
    eventType: 'LOGIN_FAILED',
    userAgent,
    metadata: {
      ...metadata,
      email
    }
  })
}

/**
 * Log a LOGOUT event
 */
export function logLogout(
  userId: string,
  userAgent?: string,
  metadata?: any
): void {
  logEvent({
    eventType: 'LOGOUT',
    userId,
    userAgent,
    metadata
  })
}

/**
 * Log a PASSWORD_RESET event
 */
export function logPasswordReset(
  userId: string,
  userAgent?: string,
  metadata?: any
): void {
  logEvent({
    eventType: 'PASSWORD_RESET',
    userId,
    userAgent,
    metadata
  })
}

/**
 * Log an EMAIL_CHANGE event
 */
export function logEmailChange(
  userId: string,
  userAgent?: string,
  metadata?: any
): void {
  logEvent({
    eventType: 'EMAIL_CHANGE',
    userId,
    userAgent,
    metadata
  })
}

/**
 * Log a registration attempt (for rate limiting by IP)
 */
export function logRegisterAttempt(
  ip: string,
  userAgent?: string,
  metadata?: any
): void {
  logEvent({
    eventType: 'REGISTER_ATTEMPT',
    userAgent,
    metadata: { ...metadata, ip }
  })
}

/**
 * Log a password reset request (for rate limiting by email)
 */
export function logPasswordResetRequest(
  email: string,
  userAgent?: string,
  metadata?: any
): void {
  logEvent({
    eventType: 'PASSWORD_RESET_REQUEST',
    userAgent,
    metadata: { ...metadata, email }
  })
}
