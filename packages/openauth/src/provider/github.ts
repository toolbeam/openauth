/**
 * Use this provider to authenticate with Github.
 *
 * ```ts {5-8}
 * import { GithubProvider } from "@openauthjs/openauth/provider/github"
 *
 * export default issuer({
 *   providers: {
 *     github: GithubProvider({
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

export interface GithubConfig extends Oauth2WrappedConfig {}

/**
 * Create a Github OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * GithubProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function GithubProvider(config: GithubConfig) {
  return Oauth2Provider({
    ...config,
    type: "github",
    endpoint: {
      authorization: "https://github.com/login/oauth/authorize",
      token: "https://github.com/login/oauth/access_token",
    },
  })
}
