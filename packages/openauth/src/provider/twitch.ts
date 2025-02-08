/**
 * Use this provider to authenticate with Twitch.
 *
 * ```ts {5-8}
 * import { TwitchProvider } from "@openauthjs/openauth/provider/twitch"
 *
 * export default issuer({
 *   providers: {
 *     twitch: TwitchProvider({
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

export interface TwitchConfig extends Oauth2WrappedConfig {}

/**
 * Create a Twitch OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * TwitchProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function TwitchProvider(config: TwitchConfig) {
  return Oauth2Provider({
    type: "twitch",
    ...config,
    endpoint: {
      authorization: "https://id.twitch.tv/oauth2/authorize",
      token: "https://id.twitch.tv/oauth2/token",
    },
  })
}
