import { createHmac, timingSafeEqual } from "crypto"

export interface CrmSsoPayload {
  email: string
  name: string
  organizationId: string
  userId: string
  iat: number
  exp: number
}

function base64UrlDecodeToString(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4)
  return Buffer.from(padded, "base64").toString("utf8")
}

// Verifica o token de SSO assinado pelo CRM: <payload_base64url>.<hmac_sha256_hex>
export function verifyCrmSsoToken(token: string): CrmSsoPayload | null {
  const secret = process.env.SIMULADOR_SSO_SECRET
  if (!secret) return null

  const separatorIndex = token.indexOf(".")
  if (separatorIndex === -1) return null

  const payloadB64 = token.slice(0, separatorIndex)
  const signatureHex = token.slice(separatorIndex + 1)
  if (!payloadB64 || !signatureHex) return null

  const expectedHex = createHmac("sha256", secret).update(payloadB64).digest("hex")

  try {
    const received = Buffer.from(signatureHex, "hex")
    const expected = Buffer.from(expectedHex, "hex")
    if (received.length !== expected.length) return null
    if (!timingSafeEqual(received, expected)) return null
  } catch {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecodeToString(payloadB64)) as CrmSsoPayload
    if (!payload?.email || typeof payload.exp !== "number") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
