/**
 * Use this provider to authenticate with Yahoo.
 *
 * ```ts {5-8}
 * import { YahooProvider } from "@openauthjs/openauth/provider/yahoo"
 *
 * export default issuer({
 *   providers: {
 *     yahoo: YahooProvider({
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

export interface YahooConfig extends Oauth2WrappedConfig {}

/**
 * Create a Yahoo OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * YahooProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function YahooProvider(config: YahooConfig) {
  return Oauth2Provider({
    ...config,
    type: "yahoo",
    endpoint: {
      authorization: "https://api.login.yahoo.com/oauth2/request_auth",
      token: "https://api.login.yahoo.com/oauth2/get_token",
    },
  })
}
