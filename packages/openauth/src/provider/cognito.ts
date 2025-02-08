/**
 * Use this provider to authenticate with a Cognito OAuth endpoint.
 *
 * ```ts {5-10}
 * import { CognitoProvider } from "@openauthjs/openauth/provider/cognito"
 *
 * export default issuer({
 *   providers: {
 *     cognito: CognitoProvider({
 *       domain: "your-domain.auth.us-east-1.amazoncognito.com",
 *       region: "us-east-1",
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

export interface CognitoConfig extends Oauth2WrappedConfig {
  /**
   * The domain of the Cognito User Pool.
   *
   * @example
   * ```ts
   * {
   *   domain: "your-domain.auth.us-east-1.amazoncognito.com"
   * }
   * ```
   */
  domain: string
  /**
   * The region the Cognito User Pool is in.
   *
   * @example
   * ```ts
   * {
   *   region: "us-east-1"
   * }
   * ```
   */
  region: string
}

/**
 * Create a Cognito OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * CognitoProvider({
 *   domain: "your-domain.auth.us-east-1.amazoncognito.com",
 *   region: "us-east-1",
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function CognitoProvider(config: CognitoConfig) {
  const domain = `${config.domain}.auth.${config.region}.amazoncognito.com`

  return Oauth2Provider({
    type: "cognito",
    ...config,
    endpoint: {
      authorization: `https://${domain}/oauth2/authorize`,
      token: `https://${domain}/oauth2/token`,
    },
  })
}
