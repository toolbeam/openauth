/**
 * Use this provider to authenticate with JumpCloud.
 *
 * ```ts {5-8}
 * import { JumpCloudProvider } from "@openauthjs/openauth/provider/jumpcloud"
 *
 * export default issuer({
 *   providers: {
 *     jumpcloud: JumpCloudProvider({
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

export interface JumpCloudConfig extends Oauth2WrappedConfig {}

/**
 * Create a JumpCloud OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * JumpCloudProvider({
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function JumpCloudProvider(config: JumpCloudConfig) {
  return Oauth2Provider({
    type: "jumpcloud",
    ...config,
    endpoint: {
      authorization: "https://oauth.id.jumpcloud.com/oauth2/auth",
      token: "https://oauth.id.jumpcloud.com/oauth2/token",
    },
  })
}
