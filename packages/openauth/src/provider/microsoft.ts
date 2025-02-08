/**
 * Use this provider to authenticate with Microsoft. Supports both OAuth2 and OIDC.
 *
 * #### Using OAuth
 *
 * ```ts {5-9}
 * import { MicrosoftProvider } from "@openauthjs/openauth/provider/microsoft"
 *
 * export default issuer({
 *   providers: {
 *     microsoft: MicrosoftProvider({
 *       tenant: "1234567890",
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
 * import { MicrosoftOidcProvider } from "@openauthjs/openauth/provider/microsoft"
 *
 * export default issuer({
 *   providers: {
 *     microsoft: MicrosoftOidcProvider({
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

export interface MicrosoftConfig extends Oauth2WrappedConfig {
  /**
   * The tenant ID of the Microsoft account.
   *
   * This is usually the same as the client ID.
   *
   * @example
   * ```ts
   * {
   *   tenant: "1234567890"
   * }
   * ```
   */
  tenant: string
}
export interface MicrosoftOidcConfig extends OidcWrappedConfig {}

/**
 * Create a Microsoft OAuth2 provider.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * MicrosoftProvider({
 *   tenant: "1234567890",
 *   clientID: "1234567890",
 *   clientSecret: "0987654321"
 * })
 * ```
 */
export function MicrosoftProvider(config: MicrosoftConfig) {
  return Oauth2Provider({
    ...config,
    type: "microsoft",
    endpoint: {
      authorization: `https://login.microsoftonline.com/${config?.tenant}/oauth2/v2.0/authorize`,
      token: `https://login.microsoftonline.com/${config?.tenant}/oauth2/v2.0/token`,
    },
  })
}

/**
 * Create a Microsoft OIDC provider.
 *
 * This is useful if you just want to verify the user's email address.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * MicrosoftOidcProvider({
 *   clientID: "1234567890"
 * })
 * ```
 */
export function MicrosoftOidcProvider(config: MicrosoftOidcConfig) {
  return OidcProvider({
    ...config,
    type: "microsoft",
    issuer: "https://graph.microsoft.com/oidc/userinfo",
  })
}
