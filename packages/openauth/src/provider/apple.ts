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

export interface AppleConfig extends Oauth2WrappedConfig {}
export interface AppleOidcConfig extends OidcWrappedConfig {}

/**
 * Create an Apple OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * AppleProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function AppleProvider(config: AppleConfig) {
  return Oauth2Provider({
    ...config,
    type: "apple" as const,
    endpoint: {
      authorization: "https://appleid.apple.com/auth/authorize",
      token: "https://appleid.apple.com/auth/token",
    },
  })
}

/**
 * Create an Apple OIDC provider.
 *
 * This is useful if you just want to verify the user's email address.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * AppleOidcProvider({
 *   clientID: "1234567890"
 * })
 * ```
 */
export function AppleOidcProvider(config: AppleOidcConfig) {
  return OidcProvider({
    ...config,
    type: "apple" as const,
    issuer: "https://appleid.apple.com",
  })
}
