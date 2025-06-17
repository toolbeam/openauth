import { expect, test, describe } from "bun:test"
import { object, string } from "valibot"
import { issuer } from "../src/issuer.js"
import { createSubjects } from "../src/subject.js"
import { MemoryStorage } from "../src/storage/memory.js"
import { ClientCredentialsProvider } from "../src/provider/client-credentials.js"
import { PasswordProvider } from "../src/provider/password.js"

const subjects = createSubjects({
  user: object({
    userID: string(),
  }),
})

describe("Well-known endpoints", () => {
  test("includes client_credentials in grant_types_supported when provider supports it", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify() {
            return { scopes: ["read"] }
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("user", { userID: "123" })
      },
    })

    const response = await app.request(
      "/.well-known/oauth-authorization-server",
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.grant_types_supported).toContain("client_credentials")
    expect(body.grant_types_supported).toContain("authorization_code")
    expect(body.grant_types_supported).toContain("refresh_token")
  })

  test("excludes client_credentials when no provider supports it", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        password: PasswordProvider({
          async sendCode() {},
          login: {
            async get() {
              return `<form></form>`
            },
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("user", { userID: "123" })
      },
    })

    const response = await app.request(
      "/.well-known/oauth-authorization-server",
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.grant_types_supported).not.toContain("client_credentials")
    expect(body.grant_types_supported).toContain("authorization_code")
    expect(body.grant_types_supported).toContain("refresh_token")
  })

  test("well-known response includes all required fields", async () => {
    const app = issuer({
      storage: MemoryStorage(),
      subjects,
      providers: {
        clientCredentials: ClientCredentialsProvider({
          async verify() {
            return { scopes: ["read"] }
          },
        }),
      },
      async success(ctx, value) {
        return ctx.subject("user", { userID: "123" })
      },
    })

    const response = await app.request(
      "/.well-known/oauth-authorization-server",
    )
    const body = await response.json()

    expect(body).toHaveProperty("issuer")
    expect(body).toHaveProperty("authorization_endpoint")
    expect(body).toHaveProperty("token_endpoint")
    expect(body).toHaveProperty("jwks_uri")
    expect(body).toHaveProperty("response_types_supported")
    expect(body).toHaveProperty("grant_types_supported")

    // Verify endpoints are properly formed
    expect(body.authorization_endpoint).toMatch(/\/authorize$/)
    expect(body.token_endpoint).toMatch(/\/token$/)
    expect(body.jwks_uri).toMatch(/\/.well-known\/jwks\.json$/)
  })
})
