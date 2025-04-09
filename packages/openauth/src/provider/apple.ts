/**
 * Use this provider to authenticate with Apple. Supports both OAuth2 and OIDC.
 *
 * #### Using OAuth
 *
 * ```ts {5-8}
 * import { AppleProvider } from "@openauthjs/openauth/provider/apple"
 *
 * export default issuer({
 *   providers: {
 *     apple: AppleProvider({
 *       clientID: "1234567890",
 *       clientSecret: "0987654321"
 *     })
 *   }
 * })
 * ```
 *
 * #### Using OAuth with form_post response mode
 *
 * When requesting name or email scopes from Apple, you must use form_post response mode:
 *
 * ```ts {5-9}
 * import { AppleProvider } from "@openauthjs/openauth/provider/apple"
 *
 * export default issuer({
 *   providers: {
 *     apple: AppleProvider({
 *       clientID: "1234567890",
 *       clientSecret: "0987654321",
 *       responseMode: "form_post"
 *     })
 *   }
 * })
 * ```
 *
 * #### Using OIDC
 *
 * ```ts {5-7}
 * import { AppleOidcProvider } from "@openauthjs/openauth/provider/apple"
 *
 * export default issuer({
 *   providers: {
 *     apple: AppleOidcProvider({
 *       clientID: "1234567890"
 *     })
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, Oauth2WrappedConfig } from "./oauth2.js"
import { OidcProvider, OidcWrappedConfig } from "./oidc.js"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { OauthError } from "../error.js"

export interface AppleConfig extends Oauth2WrappedConfig {
  /**
   * The response mode to use for the authorization request.
   * Apple requires 'form_post' response mode when requesting name or email scopes.
   * @default "query"
   */
  responseMode?: "query" | "form_post"
}
export interface AppleOidcConfig extends OidcWrappedConfig {}

/**
 * Create an Apple OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * // Using default query response mode (GET callback)
 * AppleProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 *
 * // Using form_post response mode (POST callback)
 * // Required when requesting name or email scope
 * AppleProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321",
 *   responseMode: "form_post",
 *   scopes: ["name", "email"]
 * })
 * ```
 */
export function AppleProvider(config: AppleConfig) {
  const { responseMode, ...restConfig } = config
  const additionalQuery =
    responseMode === "form_post"
      ? { response_mode: "form_post", ...config.query }
      : config.query || {}

  return Oauth2Provider({
    ...restConfig,
    type: "apple" as const,
    endpoint: {
      authorization: "https://appleid.apple.com/auth/authorize",
      token: "https://appleid.apple.com/auth/token",
      jwks: "https://appleid.apple.com/auth/keys",
    },
    query: additionalQuery,
  })
}

/**
 * Create an Apple OIDC provider.
 *
 * This is useful if you just want to verify the user's email address.
 * Includes support for client_credentials flow using Apple ID Token.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * AppleOidcProvider({
 *   clientID: "1234567890",
 *   clientSecret: "your-client-secret" // Required for Apple OIDC
 * })
 * ```
 */
export function AppleOidcProvider(config: AppleOidcConfig) {
  const baseProvider = OidcProvider({
    ...config,
    type: "apple" as const,
    issuer: "https://appleid.apple.com",
    responseType: "code",
    tokenEndpointAuthMethod: "client_secret_post",
  })

  baseProvider.client = async ({ clientID, params }) => {
    if (clientID !== config.clientID) {
      throw new OauthError("unauthorized_client", "Client ID mismatch.")
    }
    if (!config.clientSecret) {
      throw new OauthError("server_error", "Provider configuration missing clientSecret.")
    }

    const idToken = params.id_token
    const appId = params.app_id

    if (!idToken) {
      throw new OauthError("invalid_request", "Missing required parameter: id_token")
    }
    if (!appId) {
      throw new OauthError("invalid_request", "Missing required parameter: app_id")
    }

    try {
      const jwksUrl = new URL(`https://appleid.apple.com/auth/keys`) as any
      const jwks = createRemoteJWKSet(jwksUrl)

      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: "https://appleid.apple.com",
        audience: appId,
      })

      const email = payload.email as string
      const isEmailVerified = payload.email_verified === true || String(payload.email_verified) === 'true'

      if (!email) {
        throw new OauthError("invalid_grant", "Email not found in Apple ID token. User might have used private relay without granting email access.")
      }
      if (!isEmailVerified) {
        console.warn(`Apple email (${email}) is not verified. Proceeding, but verification recommended.`)
      }

      return {
        id: {
          email: email,
          email_verified: isEmailVerified,
          sub: payload.sub,
        },
        clientID: clientID
      }

    } catch (error: any) {
      throw new OauthError("server_error", "Apple ID token verification failed.")
    }
  }

  return baseProvider
}
