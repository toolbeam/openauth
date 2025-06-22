/**
 * Use this to connect authentication providers that support OIDC.
 *
 * ```ts {5-8}
 * import { OidcProvider } from "@openauthjs/openauth/provider/oidc"
 *
 * export default issuer({
 *   providers: {
 *     oauth2: OidcProvider({
 *       clientId: "1234567890",
 *       issuer: "https://auth.myserver.com"
 *     })
 *   }
 * })
 * ```
 *
 *
 * @packageDocumentation
 */

import { createLocalJWKSet, JSONWebKeySet, jwtVerify } from "jose"
import { WellKnown } from "../client.js"
import { OauthError } from "../error.js"
import { Provider } from "./provider.js"
import { JWTPayload } from "hono/utils/jwt/types"
import { getRelativeUrl, lazy } from "../util.js"

export interface OidcConfig {
  /**
   * @internal
   */
  type?: string
  /**
   * The client ID.
   *
   * This is just a string to identify your app.
   *
   * @example
   * ```ts
   * {
   *   clientID: "my-client"
   * }
   * ```
   */
  clientID: string
  /**
   * The URL of your authorization server.
   *
   * @example
   * ```ts
   * {
   *   issuer: "https://auth.myserver.com"
   * }
   * ```
   */
  issuer: string
  /**
   * A list of OIDC scopes that you want to request.
   *
   * @example
   * ```ts
   * {
   *   scopes: ["openid", "profile", "email"]
   * }
   * ```
   */
  scopes?: string[]
  /**
   * Any additional parameters that you want to pass to the authorization endpoint.
   * @example
   * ```ts
   * {
   *   query: {
   *     prompt: "consent"
   *   }
   * }
   * ```
   */
  query?: Record<string, string>
  /**
   * The response type to use for the OIDC flow.
   * Use "id_token" for implicit flow or "code" for authorization code flow.
   * Defaults to "id_token".
   * 
   * @example
   * ```ts
   * {
   *   responseType: "code"
   * }
   * ```
   */
  responseType?: "id_token" | "code"
  /**
   * The client secret, required for authorization code flow.
   * 
   * @example
   * ```ts
   * {
   *   clientSecret: "your-client-secret"
   * }
   * ```
   */
  clientSecret?: string
  /**
   * The token endpoint authentication method.
   * Defaults to "client_secret_post".
   * 
   * @example
   * ```ts
   * {
   *   tokenEndpointAuthMethod: "client_secret_basic"
   * }
   * ```
   */
  tokenEndpointAuthMethod?: "client_secret_post" | "client_secret_basic"
}

/**
 * @internal
 */
export type OidcWrappedConfig = Omit<OidcConfig, "issuer" | "name">

interface ProviderState {
  state: string
  nonce: string
  redirect: string
}

/**
 * @internal
 */
export interface IdTokenResponse {
  idToken: string
  claims: Record<string, any>
  raw: Record<string, any>
}

interface TokenResponse {
  id_token: string
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  [key: string]: unknown
}

interface ErrorResponse {
  error?: string
  error_description?: string
  [key: string]: unknown
}

export function OidcProvider(
  config: OidcConfig,
): Provider<{ id: JWTPayload; clientID: string }> {
  const query = config.query || {}
  const scopes = config.scopes || []
  const responseType = config.responseType || "id_token"
  const tokenEndpointAuthMethod = config.tokenEndpointAuthMethod || "client_secret_post"

  const wk = lazy(() =>
    fetch(config.issuer + "/.well-known/openid-configuration").then(
      async (r) => {
        if (!r.ok) throw new Error(await r.text())
        return r.json() as Promise<WellKnown>
      },
    ),
  )

  const jwks = lazy(() =>
    wk()
      .then((r) => r.jwks_uri)
      .then(async (uri) => {
        const r = await fetch(uri)
        if (!r.ok) throw new Error(await r.text())
        return createLocalJWKSet((await r.json()) as JSONWebKeySet)
      }),
  )

  return {
    type: config.type || "oidc",
    init(routes, ctx) {
      routes.get("/authorize", async (c) => {
        const provider: ProviderState = {
          state: crypto.randomUUID(),
          nonce: crypto.randomUUID(),
          redirect: getRelativeUrl(c, "./callback"),
        }
        await ctx.set(c, "provider", 60 * 10, provider)
        const authorization = new URL(
          await wk().then((r) => r.authorization_endpoint),
        )
        authorization.searchParams.set("client_id", config.clientID)
        authorization.searchParams.set("response_type", responseType)
        authorization.searchParams.set("response_mode", "form_post")
        authorization.searchParams.set("state", provider.state)
        authorization.searchParams.set("nonce", provider.nonce)
        authorization.searchParams.set("redirect_uri", provider.redirect)
        authorization.searchParams.set("scope", ["openid", ...scopes].join(" "))
        for (const [key, value] of Object.entries(query)) {
          authorization.searchParams.set(key, value)
        }
        return c.redirect(authorization.toString())
      })

      routes.post("/callback", async (c) => {
        const provider = await ctx.get<ProviderState>(c, "provider")
        if (!provider) return c.redirect(getRelativeUrl(c, "./authorize"))
        const body = await c.req.formData()
        const error = body.get("error")
        if (error)
          throw new OauthError(
            error.toString() as any,
            body.get("error_description")?.toString() || "",
          )
        
        // handle authorization code flow
        const code = body.get("code")
        if (code) {
          if (!config.clientSecret) {
            throw new OauthError(
              "invalid_request" as const,
              "Client secret is required for code flow"
            )
          }
          
          const tokenEndpoint = await wk().then((r) => r.token_endpoint)
          const formData = new URLSearchParams()
          formData.append("grant_type", "authorization_code")
          formData.append("code", code.toString())
          formData.append("redirect_uri", provider.redirect)

          const headers: Record<string, string> = {
            "Content-Type": "application/x-www-form-urlencoded",
          }

          if (tokenEndpointAuthMethod === "client_secret_post") {
            formData.append("client_id", config.clientID)
            formData.append("client_secret", config.clientSecret)
          } else if (tokenEndpointAuthMethod === "client_secret_basic") {
            const credentials = btoa(`${config.clientID}:${config.clientSecret}`)
            headers["Authorization"] = `Basic ${credentials}`
          }

          const response = await fetch(tokenEndpoint, {
            method: "POST",
            headers,
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json() as ErrorResponse
            throw new OauthError(
              (errorData.error as any) || "server_error",
              errorData.error_description || "Failed to exchange code for token"
            )
          }

          const tokenResponse = await response.json() as TokenResponse
          const idToken = tokenResponse.id_token

          if (!idToken) {
            throw new OauthError(
              "invalid_request" as const,
              "Missing id_token in token response"
            )
          }

          const result = await jwtVerify(idToken, await jwks(), {
            audience: config.clientID,
          })
          
          if (result.payload.nonce !== provider.nonce) {
            throw new OauthError(
              "invalid_request" as const,
              "Invalid nonce"
            )
          }
          
          return ctx.success(c, {
            id: result.payload,
            clientID: config.clientID,
          })
        }

        // handle implicit flow
        const idToken = body.get("id_token")
        if (!idToken) {
          throw new OauthError(
            "invalid_request" as const,
            "Missing id_token or code"
          )
        }
        const result = await jwtVerify(idToken.toString(), await jwks(), {
          audience: config.clientID,
        })
        if (result.payload.nonce !== provider.nonce) {
          throw new OauthError(
            "invalid_request" as const,
            "Invalid nonce"
          )
        }
        return ctx.success(c, {
          id: result.payload,
          clientID: config.clientID,
        })
      })
    },
  }
}
