/**
 * Use this provider to authenticate with X.com.
 *
 * ```ts {5-8}
 * import { XProvider } from "@openauthjs/openauth/provider/x"
 *
 * export default issuer({
 *   providers: {
 *     x: XProvider({
 *       clientID: "1234567890",
 *       clientSecret: "0987654321"
 *     })
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, Oauth2WrappedConfig } from "./oauth2.js"

export interface XProviderConfig extends Oauth2WrappedConfig {}

/**
 * Create a X.com OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * XProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function XProvider(config: XProviderConfig) {
  return Oauth2Provider({
    ...config,
    type: "x",
    endpoint: {
      authorization: "https://twitter.com/i/oauth2/authorize",
      token: "https://api.x.com/2/oauth2/token",
    },
    pkce: true,
  })
}
