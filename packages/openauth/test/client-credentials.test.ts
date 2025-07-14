import { expect, test, describe } from "bun:test"
import { object, string, array, optional } from "valibot"
import { issuer } from "../src/issuer.js"
import { createSubjects } from "../src/subject.js"
import { MemoryStorage } from "../src/storage/memory.js"
import { ClientCredentialsProvider } from "../src/provider/client-credentials.js"

const subjects = createSubjects({
  service: object({
    serviceID: string(),
    scopes: optional(array(string())),
    tier: optional(string()),
  }),
})

describe("ClientCredentialsProvider", () => {
  // Mock client database
  const mockClients = {
    "service-a": {
      secret: "secret-a",
      allowedScopes: ["read", "write"],
      tier: "premium",
    },
    "service-b": {
      secret: "secret-b",
      allowedScopes: ["read"],
      tier: "basic",
    },
  }

  test("successful authentication", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify(clientID, clientSecret) {
            const client = mockClients[clientID as keyof typeof mockClients]
            if (!client || client.secret !== clientSecret) {
              throw new Error("Invalid client credentials")
            }
            return {
              scopes: client.allowedScopes,
              properties: { tier: client.tier },
            }
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("service", {
          serviceID: value.clientID,
          scopes: value.scopes,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "service-a",
        client_secret: "secret-a",
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("access_token")
    expect(body).not.toHaveProperty("refresh_token")
  })

  test("authentication with specific scopes", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify(clientID, clientSecret, requestedScopes) {
            const client = mockClients[clientID as keyof typeof mockClients]
            if (!client || client.secret !== clientSecret) {
              throw new Error("Invalid client credentials")
            }

            // For this test, service-a can also have admin scope
            const extendedScopes =
              clientID === "service-a"
                ? [...client.allowedScopes, "admin"]
                : client.allowedScopes

            // Validate requested scopes
            if (requestedScopes && requestedScopes.length > 0) {
              const invalidScopes = requestedScopes.filter(
                (scope) => !extendedScopes.includes(scope),
              )
              if (invalidScopes.length > 0) {
                throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`)
              }
              return { scopes: requestedScopes }
            }

            return { scopes: extendedScopes }
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("service", {
          serviceID: value.clientID,
          scopes: value.scopes,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "service-a",
        client_secret: "secret-a",
        scope: "read write",
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("access_token")
  })

  test("invalid client_id", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify(clientID, clientSecret) {
            const client = mockClients[clientID as keyof typeof mockClients]
            if (!client || client.secret !== clientSecret) {
              throw new Error("Invalid client credentials")
            }
            return { scopes: client.allowedScopes }
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("service", {
          serviceID: value.clientID,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "invalid-service",
        client_secret: "secret-a",
      }),
    })

    expect(response.status).toBe(400)
  })

  test("invalid client_secret", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify(clientID, clientSecret) {
            const client = mockClients[clientID as keyof typeof mockClients]
            if (!client || client.secret !== clientSecret) {
              throw new Error("Invalid client credentials")
            }
            return { scopes: client.allowedScopes }
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("service", {
          serviceID: value.clientID,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "service-a",
        client_secret: "wrong-secret",
      }),
    })

    expect(response.status).toBe(400)
  })

  test("invalid scopes", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify(clientID, clientSecret, requestedScopes) {
            const client = mockClients[clientID as keyof typeof mockClients]
            if (!client || client.secret !== clientSecret) {
              throw new Error("Invalid client credentials")
            }

            // Validate requested scopes strictly
            if (requestedScopes && requestedScopes.length > 0) {
              const invalidScopes = requestedScopes.filter(
                (scope) => !client.allowedScopes.includes(scope),
              )
              if (invalidScopes.length > 0) {
                throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`)
              }
              return { scopes: requestedScopes }
            }

            return { scopes: client.allowedScopes }
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("service", {
          serviceID: value.clientID,
          scopes: value.scopes,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "service-a",
        client_secret: "secret-a",
        scope: "read write admin", // 'admin' is not allowed
      }),
    })

    expect(response.status).toBe(400)
  })

  test("async verify function error handling", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify() {
            // Simulate a database error
            throw new Error("Database connection failed")
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("service", {
          serviceID: value.clientID,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "service-a",
        client_secret: "secret-a",
      }),
    })

    expect(response.status).toBe(400)
  })

  test("verify function returns custom properties", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify(clientID) {
            return {
              scopes: ["read", "write"],
              properties: {
                tier: "premium",
                region: "us-east-1",
                customField: clientID,
              },
            }
          },
        }),
      },
      async success(ctx, value) {
        // Verify we receive the custom properties
        expect(value.properties).toHaveProperty("tier", "premium")
        expect(value.properties).toHaveProperty("region", "us-east-1")
        expect(value.properties).toHaveProperty("customField", value.clientID)

        return ctx.subject("service", {
          serviceID: value.clientID,
          scopes: value.scopes,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "service-a",
        client_secret: "secret-a",
      }),
    })

    expect(response.status).toBe(200)
  })

  test("response includes expires_in field", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify(clientID, clientSecret) {
            if (clientID === "service-test" && clientSecret === "secret-test") {
              return {
                scopes: ["read", "write"],
                properties: { tier: "premium" },
              }
            }
            throw new Error("Invalid credentials")
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("service", {
          serviceID: value.clientID,
          scopes: value.scopes,
          tier: value.properties?.tier,
        })
      },
    })

    const response = await app.request("/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "clientCredentials",
        client_id: "service-test",
        client_secret: "secret-test",
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()

    // Verify response structure
    expect(body).toHaveProperty("access_token")
    expect(body).not.toHaveProperty("refresh_token")
    expect(body).toHaveProperty("expires_in")
    expect(body).toHaveProperty("token_type", "Bearer")
    expect(typeof body.expires_in).toBe("number")
    expect(body.expires_in).toBeGreaterThan(0)
  })
})
