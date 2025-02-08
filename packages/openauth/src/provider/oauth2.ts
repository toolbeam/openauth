/**
 * Use this to connect authentication providers that support OAuth 2.0.
 *
 * ```ts {5-12}
 * import { Oauth2Provider } from "@openauthjs/openauth/provider/oauth2"
 *
 * export default issuer({
 *   providers: {
 *     oauth2: Oauth2Provider({
 *       clientID: "1234567890",
 *       clientSecret: "0987654321",
 *       endpoint: {
 *         authorization: "https://auth.myserver.com/authorize",
 *         token: "https://auth.myserver.com/token"
 *       }
 *     })
 *   }
 * })
 * ```
 *
 *
 * @packageDocumentation
 */

import { OauthError } from "../error.js"
import { generatePKCE } from "../pkce.js"
import { getRelativeUrl } from "../util.js"
import { Provider } from "./provider.js"

export interface Oauth2Config {
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
   * The client secret.
   *
   * This is a private key that's used to authenticate your app. It should be kept secret.
   *
   * @example
   * ```ts
   * {
   *   clientSecret: "0987654321"
   * }
   * ```
   */
  clientSecret: string
  /**
   * The URLs of the authorization and token endpoints.
   *
   * @example
   * ```ts
   * {
   *   endpoint: {
   *     authorization: "https://auth.myserver.com/authorize",
   *     token: "https://auth.myserver.com/token"
   *   }
   * }
   * ```
   */
  endpoint: {
    /**
     * The URL of the authorization endpoint.
     */
    authorization: string
    /**
     * The URL of the token endpoint.
     */
    token: string
  }
  /**
   * A list of OAuth scopes that you want to request.
   *
   * @example
   * ```ts
   * {
   *   scopes: ["email", "profile"]
   * }
   * ```
   */
  scopes: string[]
  /**
   * Whether to use PKCE (Proof Key for Code Exchange) for the authorization code flow.
   * Some providers like x.com require this.
   * @default false
   */
  pkce?: boolean
  /**
   * Any additional parameters that you want to pass to the authorization endpoint.
   * @example
   * ```ts
   * {
   *   query: {
   *     access_type: "offline",
   *     prompt: "consent"
   *   }
   * }
   * ```
   */
  query?: Record<string, string>
}

/**
 * @internal
 */
export type Oauth2WrappedConfig = Omit<Oauth2Config, "endpoint" | "name">

/**
 * @internal
 */
export interface Oauth2Token {
  access: string
  refresh: string
  expiry: number
  raw: Record<string, any>
}

interface ProviderState {
  state: string
  redirect: string
  codeVerifier?: string
}

export function Oauth2Provider(
  config: Oauth2Config,
): Provider<{ tokenset: Oauth2Token; clientID: string }> {
  const query = config.query || {}
  return {
    type: config.type || "oauth2",
    init(routes, ctx) {
      routes.get("/authorize", async (c) => {
        const state = crypto.randomUUID()
        const pkce = config.pkce ? await generatePKCE() : undefined
        await ctx.set<ProviderState>(c, "provider", 60 * 10, {
          state,
          redirect: getRelativeUrl(c, "./callback"),
          codeVerifier: pkce?.verifier,
        })
        const authorization = new URL(config.endpoint.authorization)
        authorization.searchParams.set("client_id", config.clientID)
        authorization.searchParams.set(
          "redirect_uri",
          getRelativeUrl(c, "./callback"),
        )
        authorization.searchParams.set("response_type", "code")
        authorization.searchParams.set("state", state)
        authorization.searchParams.set("scope", config.scopes.join(" "))
        if (pkce) {
          authorization.searchParams.set("code_challenge", pkce.challenge)
          authorization.searchParams.set("code_challenge_method", pkce.method)
        }
        for (const [key, value] of Object.entries(query)) {
          authorization.searchParams.set(key, value)
        }
        return c.redirect(authorization.toString())
      })

      routes.get("/callback", async (c) => {
        const provider = (await ctx.get(c, "provider")) as ProviderState
        const code = c.req.query("code")
        const state = c.req.query("state")
        const error = c.req.query("error")
        if (error)
          throw new OauthError(
            error.toString() as any,
            c.req.query("error_description")?.toString() || "",
          )
        if (!provider || !code || (provider.state && state !== provider.state))
          return c.redirect(getRelativeUrl(c, "./authorize"))
        const body = new URLSearchParams({
          client_id: config.clientID,
          client_secret: config.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: provider.redirect,
          ...(provider.codeVerifier
            ? { code_verifier: provider.codeVerifier }
            : {}),
        })
        const json: any = await fetch(config.endpoint.token, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: body.toString(),
        }).then((r) => r.json())
        if ("error" in json)
          throw new OauthError(json.error, json.error_description)
        return ctx.success(c, {
          clientID: config.clientID,
          tokenset: {
            get access() {
              return json.access_token
            },
            get refresh() {
              return json.refresh_token
            },
            get expiry() {
              return json.expires_in
            },
            get raw() {
              return json
            },
          },
        })
      })
    },
  }
}
