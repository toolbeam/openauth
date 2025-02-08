/**
 * Use this provider to authenticate with Google. Supports both OAuth2 and OIDC.
 *
 * #### Using OAuth
 *
 * ```ts {5-8}
 * import { GoogleProvider } from "@openauthjs/openauth/provider/google"
 *
 * export default issuer({
 *   providers: {
 *     google: GoogleProvider({
 *       clientID: "1234567890",
 *       clientSecret: "0987654321"
 *     })
 *   }
 * })
 * ```
 *
 * #### Using OIDC
 *
 * ```ts {5-7}
 * import { GoogleOidcProvider } from "@openauthjs/openauth/provider/google"
 *
 * export default issuer({
 *   providers: {
 *     google: GoogleOidcProvider({
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

export interface GoogleConfig extends Oauth2WrappedConfig {}
export interface GoogleOidcConfig extends OidcWrappedConfig {}

/**
 * Create a Google OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * GoogleProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function GoogleProvider(config: GoogleConfig) {
  return Oauth2Provider({
    ...config,
    type: "google",
    endpoint: {
      authorization: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
    },
  })
}

/**
 * Create a Google OIDC provider.
 *
 * This is useful if you just want to verify the user's email address.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * GoogleOidcProvider({
 *   clientID: "1234567890"
 * })
 * ```
 */
export function GoogleOidcProvider(config: GoogleOidcConfig) {
  return OidcProvider({
    ...config,
    type: "google",
    issuer: "https://accounts.google.com",
  })
}
