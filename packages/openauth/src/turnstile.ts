export const DEFAULT_TURNSTILE_FIELD_NAME = "cf-turnstile-response"

export interface TurnstileSiteVerifyResponse {
  success: boolean
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
  "error-codes"?: string[]
}

export interface TurnstileOptions {
  /**
   * Cloudflare Turnstile secret key.
   */
  secretKey: string
  /**
   * Cloudflare Turnstile site key (public key). Used by the built-in UI.
   */
  siteKey?: string
  /**
   * The form field name containing the Turnstile token.
   * @default "cf-turnstile-response"
   */
  fieldName?: string
  /**
   * When set, require the `action` returned by Turnstile to match.
   */
  action?: string
  /**
   * When set, require the `hostname` returned by Turnstile to match one of these.
   */
  hostnames?: string[]
  /**
   * Optional widget options used by the built-in UI.
   */
  widget?: {
    theme?: "auto" | "light" | "dark"
    size?: "normal" | "compact" | "invisible"
    appearance?: "always" | "execute" | "interaction-only"
    retry?: "auto" | "never"
    refreshExpired?: "auto" | "manual" | "never"
  }
}

export function getTurnstileToken(
  form: FormData,
  fieldName: string = DEFAULT_TURNSTILE_FIELD_NAME,
) {
  const token = form.get(fieldName)?.toString()
  return token ? token : undefined
}

function getClientIP(req: Request) {
  const from = (value: string | null) => value?.split(",")[0]?.trim()
  return (
    from(req.headers.get("cf-connecting-ip")) ||
    from(req.headers.get("x-forwarded-for")) ||
    from(req.headers.get("x-real-ip")) ||
    undefined
  )
}

function getRequestHostname(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host")
  if (forwardedHost) {
    const raw = forwardedHost.split(",")[0]?.trim()
    if (!raw) return undefined
    try {
      return new URL(`https://${raw}`).hostname
    } catch {
      return raw.split(":")[0]
    }
  }
  try {
    return new URL(req.url).hostname
  } catch {
    return undefined
  }
}

export type TurnstileVerifyResult = {
  success: boolean
  response?: TurnstileSiteVerifyResponse
  errorCodes?: string[]
}

/**
 * Verifies a Cloudflare Turnstile token server-side. Fails closed.
 */
export async function verifyTurnstileToken(opts: {
  secretKey: string
  token: string
  req?: Request
  action?: string
  hostnames?: string[]
}): Promise<TurnstileVerifyResult> {
  const body = new URLSearchParams({
    secret: opts.secretKey,
    response: opts.token,
  })

  const clientIP = opts.req ? getClientIP(opts.req) : undefined
  if (clientIP) body.set("remoteip", clientIP)

  let json: TurnstileSiteVerifyResponse
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    )
    json = (await res.json()) as TurnstileSiteVerifyResponse
  } catch (err) {
    return {
      success: false,
      errorCodes: ["siteverify_failed"],
    }
  }

  if (!json?.success) {
    return {
      success: false,
      response: json,
      errorCodes: json?.["error-codes"] ?? ["invalid_token"],
    }
  }

  if (opts.action && json.action !== opts.action) {
    return {
      success: false,
      response: json,
      errorCodes: ["action_mismatch"],
    }
  }

  if (opts.hostnames?.length) {
    const hostname = json.hostname
    if (!hostname || !opts.hostnames.includes(hostname)) {
      return {
        success: false,
        response: json,
        errorCodes: ["hostname_mismatch"],
      }
    }
  }

  return { success: true, response: json }
}
