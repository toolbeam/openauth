import { issuer } from "@openauthjs/openauth"
import { ClientCredentialsProvider } from "@openauthjs/openauth/provider/client-credentials"
import { MemoryStorage } from "@openauthjs/openauth/storage/memory"
import { createSubjects } from "@openauthjs/openauth/subject"
import { object, string, optional, array } from "valibot"

// Define subjects for machine-to-machine authentication
const subjects = createSubjects({
  service: object({
    serviceID: string(),
    scopes: optional(array(string())),
    tier: optional(string()),
  }),
})

// Mock database for this example
const serviceDatabase = {
  "api-service-1": {
    hashedSecret: "hashed-secret-1", // In production, use bcrypt or similar
    plainSecret: "secret-1", // Only for demo
    allowedScopes: ["read:users", "read:posts"],
    tier: "basic",
    name: "API Service 1",
  },
  "api-service-2": {
    hashedSecret: "hashed-secret-2",
    plainSecret: "secret-2",
    allowedScopes: ["read:users", "write:users", "read:posts", "write:posts"],
    tier: "premium",
    name: "API Service 2",
  },
}

// Create the issuer with client credentials provider
const app = issuer({
  subjects,
  storage: MemoryStorage(),
  providers: {
    clientCredentials: ClientCredentialsProvider({
      async verify(clientID, clientSecret, requestedScopes) {
        // Look up the service in database
        const service =
          serviceDatabase[clientID as keyof typeof serviceDatabase]

        if (!service) {
          throw new Error("Invalid client_id")
        }

        // In production, use proper password hashing comparison
        // For example: await bcrypt.compare(clientSecret, service.hashedSecret)
        if (clientSecret !== service.plainSecret) {
          throw new Error("Invalid client_secret")
        }

        // Validate requested scopes if any
        if (requestedScopes && requestedScopes.length > 0) {
          const invalidScopes = requestedScopes.filter(
            (scope) => !service.allowedScopes.includes(scope),
          )

          if (invalidScopes.length > 0) {
            throw new Error(
              `Invalid scopes requested: ${invalidScopes.join(", ")}`,
            )
          }

          // Return only the requested scopes
          return {
            scopes: requestedScopes,
            properties: {
              tier: service.tier,
              name: service.name,
            },
          }
        }

        // Return all allowed scopes if none specifically requested
        return {
          scopes: service.allowedScopes,
          properties: {
            tier: service.tier,
            name: service.name,
          },
        }
      },
    }),
  },
  async success(ctx, value) {
    if (value.provider === "clientCredentials") {
      // For machine-to-machine auth, use the clientID as the serviceID
      return ctx.subject("service", {
        serviceID: value.clientID,
        scopes: value.scopes,
        tier: value.properties?.tier,
      })
    }
    throw new Error("Unknown provider")
  },
})

// Example usage:
// To authenticate, make a POST request to /token with:
// - grant_type: "client_credentials"
// - provider: "clientCredentials"
// - client_id: "api-service-1"
// - client_secret: "secret-1"
// - scope: "read:users read:posts" (optional)
//
// Response will include:
// - access_token: JWT access token
// - token_type: "Bearer"
// - expires_in: Token lifetime in seconds
// Note: No refresh token is provided for client credentials flow

export default app
