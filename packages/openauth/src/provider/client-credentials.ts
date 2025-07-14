/**
 * Use this provider to authenticate machine-to-machine applications using client credentials.
 *
 * ```ts {5-18}
 * import { ClientCredentialsProvider } from "@openauthjs/openauth/provider/client-credentials"
 *
 * export default issuer({
 *   providers: {
 *     clientCredentials: ClientCredentialsProvider({
 *       async verify(clientID, clientSecret, scopes) {
 *         // Look up client in database
 *         const client = await db.getClient(clientID)
 *         if (!client || client.secret !== clientSecret) {
 *           throw new Error("Invalid client credentials")
 *         }
 *         // Verify scopes if requested
 *         // Return any properties to include in the token
 *         return {
 *           scopes: client.allowedScopes,
 *           properties: { tier: client.tier }
 *         }
 *       }
 *     })
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 */

import { Provider } from "./provider.js"

export interface ClientCredentialsConfig {
  /**
   * An async function to verify client credentials and return allowed scopes and properties.
   *
   * @param clientID - The client ID to verify
   * @param clientSecret - The client secret to verify
   * @param requestedScopes - The scopes requested by the client (if any)
   * @returns The allowed scopes and any additional properties to include in the token
   * @throws Error if the credentials are invalid
   *
   * @example
   * ```ts
   * {
   *   async verify(clientID, clientSecret, requestedScopes) {
   *     const client = await db.getClient(clientID)
   *     if (!client || !await bcrypt.compare(clientSecret, client.hashedSecret)) {
   *       throw new Error("Invalid client credentials")
   *     }
   *
   *     // Optionally validate requested scopes against allowed scopes
   *     if (requestedScopes?.length > 0) {
   *       const invalidScopes = requestedScopes.filter(s => !client.allowedScopes.includes(s))
   *       if (invalidScopes.length > 0) {
   *         throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`)
   *       }
   *       return { scopes: requestedScopes }
   *     }
   *
   *     return {
   *       scopes: client.allowedScopes,
   *       properties: { tier: client.tier, name: client.name }
   *     }
   *   }
   * }
   * ```
   */
  verify: (
    clientID: string,
    clientSecret: string,
    requestedScopes?: string[],
  ) => Promise<{
    scopes?: string[]
    properties?: Record<string, any>
  }>
}

/**
 * Create a Client Credentials provider for machine-to-machine authentication.
 *
 * @param config - The config for the provider.
 * @example
 * ```ts
 * ClientCredentialsProvider({
 *   async verify(clientID, clientSecret, scopes) {
 *     const client = await db.getClient(clientID)
 *     if (!client || client.secret !== clientSecret) {
 *       throw new Error("Invalid client credentials")
 *     }
 *     return { scopes: client.allowedScopes }
 *   }
 * })
 * ```
 */
export function ClientCredentialsProvider(
  config: ClientCredentialsConfig,
): Provider<{
  clientID: string
  scopes?: string[]
  properties?: Record<string, any>
}> {
  return {
    type: "client_credentials",
    init() {
      // Client credentials flow doesn't need any routes since it only uses the /token endpoint
    },
    async client(input) {
      try {
        // Parse requested scopes from the request
        const requestedScopes =
          input.params.scope?.split(" ").filter(Boolean) || []

        // Call the verify function
        const result = await config.verify(
          input.clientID,
          input.clientSecret,
          requestedScopes.length > 0 ? requestedScopes : undefined,
        )

        return {
          clientID: input.clientID,
          scopes: result.scopes,
          properties: result.properties || {},
        }
      } catch (error) {
        // Re-throw the error from verify function
        throw error
      }
    },
  }
}
