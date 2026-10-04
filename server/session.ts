import { createHmac, timingSafeEqual } from "node:crypto"

export const SESSION_COOKIE = "pergola_session"
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export function appPassword(): string {
  return (process.env.APP_PASSWORD ?? "").trim()
}

/** Password is enforced only in production. Dev on localhost stays open. */
export function passwordRequired(): boolean {
  return process.env.NODE_ENV === "production" && appPassword().length > 0
}

function mac(value: string): Buffer {
  return createHmac("sha256", "pergola-password").update(value).digest()
}

export function passwordMatches(input: string): boolean {
  const a = mac(input)
  const b = mac(appPassword())
  return timingSafeEqual(a, b)
}

export function createSessionToken(): string {
  const exp = String(Date.now() + MAX_AGE_MS)
  const sig = createHmac("sha256", appPassword()).update(exp).digest("base64url")
  return `${exp}.${sig}`
}

export function sessionTokenValid(token: string | undefined): boolean {
  if (!passwordRequired() || !token) return false
  const dot = token.indexOf(".")
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac("sha256", appPassword()).update(payload).digest("base64url")
  const left = Buffer.from(sig)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false
  const exp = Number(payload)
  return Number.isFinite(exp) && exp > Date.now()
}
