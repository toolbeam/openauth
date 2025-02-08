/**
 * Use this provider to authenticate with Spotify.
 *
 * ```ts {5-8}
 * import { SpotifyProvider } from "@openauthjs/openauth/provider/spotify"
 *
 * export default issuer({
 *   providers: {
 *     spotify: SpotifyProvider({
 *       clientID: "1234567890",
 *       clientSecret: "0987654321"
 *     })
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2.js"

export interface SpotifyConfig extends Oauth2WrappedConfig {}

/**
 * Create a Spotify OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * SpotifyProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function SpotifyProvider(config: SpotifyConfig) {
  return Oauth2Provider({
    ...config,
    type: "spotify",
    endpoint: {
      authorization: "https://accounts.spotify.com/authorize",
      token: "https://accounts.spotify.com/api/token",
    },
  })
}
