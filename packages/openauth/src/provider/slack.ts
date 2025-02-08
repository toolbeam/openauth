/**
 * Use this provider to authenticate with Slack.
 *
 * ```ts {5-10}
 * import { SlackProvider } from "@openauthjs/openauth/provider/slack"
 *
 * export default issuer({
 *   providers: {
 *     slack: SlackProvider({
 *       team: "T1234567890",
 *       clientID: "1234567890",
 *       clientSecret: "0987654321",
 *       scopes: ["openid", "email", "profile"]
 *     })
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, Oauth2WrappedConfig } from "./oauth2.js"

export interface SlackConfig extends Oauth2WrappedConfig {
  /**
   * The workspace the user is intending to authenticate.
   *
   * If that workspace has been previously authenticated, the user will be signed in directly,
   * bypassing the consent screen.
   */
  team: string
  /**
   * The scopes to request from the user.
   *
   * | Scope | Description |
   * |-|-|
   * | `email` | Grants permission to access the user's email address. |
   * | `profile` | Grants permission to access the user's profile information. |
   * | `openid` | Grants permission to use OpenID Connect to verify the user's identity. |
   */
  scopes: ("email" | "profile" | "openid")[]
}

/**
 * Creates a [Slack OAuth2 provider](https://api.slack.com/authentication/sign-in-with-slack).
 *
 * @param {SlackConfig} config - The config for the provider.
 * @example
 * ```ts
 * SlackProvider({
 *   team: "T1234567890",
 *   clientID: "1234567890",
 *   clientSecret: "0987654321",
 *   scopes: ["openid", "email", "profile"]
 * })
 * ```
 */
export function SlackProvider(config: SlackConfig) {
  return Oauth2Provider({
    ...config,
    type: "slack",
    endpoint: {
      authorization: "https://slack.com/openid/connect/authorize",
      token: "https://slack.com/api/openid.connect.token",
    },
  })
}
