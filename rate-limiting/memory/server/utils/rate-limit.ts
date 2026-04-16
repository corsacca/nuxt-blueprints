interface RateLimitEntry {
  count: number
  firstAttempt: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    // Remove entries older than 1 hour (covers any reasonable window)
    if (now - entry.firstAttempt > 60 * 60 * 1000) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export async function checkRateLimit(
  eventType: string,
  identifierField: string,
  identifierValue: string,
  windowMs: number,
  maxAttempts: number
): Promise<RateLimitResult> {
  const key = `${eventType}:${identifierField}:${identifierValue}`
  const now = Date.now()

  const entry = store.get(key)

  // No entry or window expired — allow and start fresh
  if (!entry || now - entry.firstAttempt > windowMs) {
    store.set(key, { count: 1, firstAttempt: now })
    return {
      allowed: true,
      remaining: maxAttempts - 1
    }
  }

  // Within window — check count
  if (entry.count >= maxAttempts) {
    const retryAfterMs = (entry.firstAttempt + windowMs) - now
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000))
    }
  }

  // Within window, under limit — increment
  entry.count++
  return {
    allowed: true,
    remaining: maxAttempts - entry.count
  }
}

export function logRateLimitExceeded(
  identifier: string,
  endpoint: string,
  userAgent?: string
): void {
  console.warn(`[Rate Limit] Exceeded for ${identifier} on ${endpoint}`)
}
