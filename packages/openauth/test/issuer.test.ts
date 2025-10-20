import {
  expect,
  test,
  setSystemTime,
  describe,
  beforeEach,
  afterEach,
} from "bun:test"
import { object, string } from "valibot"
import { issuer } from "../src/issuer.js"
import { createClient } from "../src/client.js"
import { createSubjects } from "../src/subject.js"
import { MemoryStorage } from "../src/storage/memory.js"
import { StorageAdapter, joinKey, splitKey } from "../src/storage/storage.js"
import { Provider } from "../src/provider/provider.js"

const subjects = createSubjects({
  user: object({
    userID: string(),
  }),
})

let storage = MemoryStorage()
const issuerConfig = {
  storage,
  subjects,
  allow: async () => true,
  ttl: {
    access: 60,
    refresh: 6000,
    refreshReuse: 60,
    refreshRetention: 6000,
  },
  providers: {
    dummy: {
      type: "dummy",
      init(route, ctx) {
        route.get("/authorize", async (c) => {
          return ctx.success(c, {
            email: "foo@bar.com",
          })
        })
      },
      client: async ({ clientID, clientSecret }) => {
        if (clientID !== "myuser" && clientSecret !== "mypass") {
          throw new Error("Wrong credentials")
        }
        return {
          email: "foo@bar.com",
        }
      },
    } satisfies Provider<{ email: string }>,
  },
  success: async (ctx, value) => {
    if (value.provider === "dummy") {
      return ctx.subject("user", {
        userID: "123",
      })
    }
    throw new Error("Invalid provider: " + value.provider)
  },
}
const auth = issuer(issuerConfig)

const expectNonEmptyString = expect.stringMatching(/.+/)

beforeEach(async () => {
  setSystemTime(new Date("1/1/2024"))
})

afterEach(() => {
  setSystemTime()
})

describe("code flow", () => {
  test("success", async () => {
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const { challenge, url } = await client.authorize(
      "https://client.example.com/callback",
      "code",
      {
        pkce: true,
      },
    )
    let response = await auth.request(url)
    expect(response.status).toBe(302)
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")
    expect(code).not.toBeNull()
    const exchanged = await client.exchange(
      code!,
      "https://client.example.com/callback",
      challenge.verifier,
    )
    if (exchanged.err) throw exchanged.err
    const tokens = exchanged.tokens
    expect(tokens).toStrictEqual({
      access: expectNonEmptyString,
      refresh: expectNonEmptyString,
      expiresIn: 60,
    })
    const verified = await client.verify(subjects, tokens.access)
    if (verified.err) throw verified.err
    expect(verified.subject).toStrictEqual({
      type: "user",
      properties: {
        userID: "123",
      },
    })
  })

  test("resource introduced at token step sets aud", async () => {
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const { challenge, url } = await client.authorize(
      "https://client.example.com/callback",
      "code",
      { pkce: true },
    )
    let response = await auth.request(url)
    response = await auth.request(response.headers.get("location")!, {
      headers: { cookie: response.headers.get("set-cookie")! },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")!

    const exchanged = await client.exchange(
      code,
      "https://client.example.com/callback",
      challenge.verifier,
      { resource: "https://api.example.com/" },
    )
    if (exchanged.err) throw exchanged.err
    const verified = await client.verify(subjects, exchanged.tokens.access)
    expect(verified).toStrictEqual({
      aud: "https://api.example.com/",
      subject: {
        type: "user",
        properties: { userID: "123" },
      },
    })
  })

  test("multiple resources authorized require selection at token", async () => {
    const { challenge, url } = await createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    }).authorize("https://client.example.com/callback", "code", {
      pkce: true,
      resources: ["https://a.example.com/", "https://b.example.com/"],
    })
    let response = await auth.request(url)
    response = await auth.request(response.headers.get("location")!, {
      headers: { cookie: response.headers.get("set-cookie")! },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")!
    const p = new URLSearchParams()
    p.set("grant_type", "authorization_code")
    p.set("code", code)
    p.set("client_id", "123")
    p.set("redirect_uri", "https://client.example.com/callback")
    p.set("code_verifier", challenge.verifier || "")
    const tokenResp = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p.toString(),
    })
    expect(tokenResp.status).toBe(400)
    const body = await tokenResp.json()
    expect(body.error).toBe("invalid_target")
  })

  test("resource mismatch at token is invalid_target", async () => {
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const { challenge, url } = await client.authorize(
      "https://client.example.com/callback",
      "code",
      { pkce: true, resources: ["https://a.example.com/"] },
    )
    let response = await auth.request(url)
    response = await auth.request(response.headers.get("location")!, {
      headers: { cookie: response.headers.get("set-cookie")! },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")!
    const p2 = new URLSearchParams()
    p2.set("grant_type", "authorization_code")
    p2.set("code", code)
    p2.set("client_id", "123")
    p2.set("redirect_uri", "https://client.example.com/callback")
    p2.set("code_verifier", challenge.verifier || "")
    p2.set("resource", "https://b.example.com/")
    const tokenResp = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p2.toString(),
    })
    expect(tokenResp.status).toBe(400)
    const body = await tokenResp.json()
    expect(body.error).toBe("invalid_target")
  })

  test("invalid resource syntax at token is invalid_target", async () => {
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const { challenge, url } = await client.authorize(
      "https://client.example.com/callback",
      "code",
      { pkce: true },
    )
    let response = await auth.request(url)
    response = await auth.request(response.headers.get("location")!, {
      headers: { cookie: response.headers.get("set-cookie")! },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")!
    const bad = new URLSearchParams()
    bad.set("grant_type", "authorization_code")
    bad.set("code", code)
    bad.set("client_id", "123")
    bad.set("redirect_uri", "https://client.example.com/callback")
    bad.set("code_verifier", challenge.verifier || "")
    bad.set("resource", "https://api.example.com/#bad")
    const tokenResp = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bad.toString(),
    })
    expect(tokenResp.status).toBe(400)
    const body = await tokenResp.json()
    expect(body.error).toBe("invalid_target")
  })
})

describe("implicit flow", () => {
  test("success without refresh token", async () => {
    // Build an implicit authorize URL (response_type=token)
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "123")
    url.searchParams.set("redirect_uri", "https://client.example.com/callback")
    url.searchParams.set("response_type", "token")
    url.searchParams.set("provider", "dummy")

    // First hop sets auth state and redirects to provider
    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)

    // Provider completes and triggers implicit success
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })

    // Should redirect back to client with tokens in fragment (OAuth 2.0 implicit flow spec)
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin + location.pathname).toBe(
      "https://client.example.com/callback",
    )

    // Tokens should be in the fragment (hash), not query params
    const fragmentParams = new URLSearchParams(location.hash.substring(1))

    // MUST have access_token
    expect(fragmentParams.has("access_token")).toBe(true)
    expect(fragmentParams.get("access_token")).toMatch(/.+/)

    // MUST have token_type (RFC 6749 Section 4.2.2)
    expect(fragmentParams.get("token_type")).toBe("Bearer")

    // MUST NOT have refresh_token (OAuth 2.0 Security Best Current Practice)
    expect(fragmentParams.has("refresh_token")).toBe(false)

    // SHOULD have state for CSRF protection
    expect(fragmentParams.has("state")).toBe(true)
  })

  test("multiple resources are rejected", async () => {
    // Build an implicit authorize URL with two resource parameters
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "123")
    url.searchParams.set("redirect_uri", "https://client.example.com/callback")
    url.searchParams.set("response_type", "token")
    url.searchParams.append("resource", "https://a.example.com/")
    url.searchParams.append("resource", "https://b.example.com/")

    // First hop sets auth state and redirects to provider
    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)
    // Provider completes and triggers implicit success; expect invalid_target error in redirect
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })

    // Should redirect back to client with error in fragment (OAuth 2.0 implicit flow spec)
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin + location.pathname).toBe(
      "https://client.example.com/callback",
    )

    // Error should be in the fragment (hash), not query params
    const fragmentParams = new URLSearchParams(location.hash.substring(1))
    expect(fragmentParams.get("error")).toBe("invalid_target")
    expect(fragmentParams.get("error_description")).toBe(
      "Multiple resource values are not supported with implicit flow; request a single resource.",
    )
    expect(fragmentParams.has("state")).toBe(true)
  })
})

describe("client credentials flow", () => {
  test("success", async () => {
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const cc1 = new URLSearchParams()
    cc1.set("grant_type", "client_credentials")
    cc1.set("provider", "dummy")
    cc1.set("client_id", "myuser")
    cc1.set("client_secret", "mypass")
    const response = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: cc1.toString(),
    })
    expect(response.status).toBe(200)
    const tokens = await response.json()
    expect(tokens).toStrictEqual({
      access_token: expectNonEmptyString,
      token_type: "Bearer",
      expires_in: expect.any(Number),
      refresh_token: expectNonEmptyString,
    })
    const verified = await client.verify(subjects, tokens.access_token)
    expect(verified).toStrictEqual({
      aud: "myuser",
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
  })

  test("multiple resources not supported in client_credentials", async () => {
    const cc2 = new URLSearchParams()
    cc2.set("grant_type", "client_credentials")
    cc2.set("provider", "dummy")
    cc2.set("client_id", "myuser")
    cc2.set("client_secret", "mypass")
    cc2.set("resource", "https://a.example.com/")
    const response = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        cc2.toString() +
        "&resource=" +
        encodeURIComponent("https://b.example.com/"),
    })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("invalid_target")
  })
})

describe("refresh token", () => {
  let tokens: { access: string; refresh: string }
  let client: ReturnType<typeof createClient>

  const generateTokens = async (issuer: typeof auth) => {
    const { challenge, url } = await client.authorize(
      "https://client.example.com/callback",
      "code",
      {
        pkce: true,
      },
    )
    let response = await issuer.request(url)
    response = await issuer.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")
    const exchanged = await client.exchange(
      code!,
      "https://client.example.com/callback",
      challenge.verifier,
    )
    if (exchanged.err) throw exchanged.err
    return exchanged.tokens
  }

  const createClientAndTokens = async (issuer: typeof auth) => {
    client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(issuer.request(a, b)),
    })
    tokens = await generateTokens(issuer)
  }

  const requestRefreshToken = async (
    refresh_token: string,
    issuer?: typeof auth,
  ) =>
    (issuer ?? auth).request("https://auth.example.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        ...(refresh_token ? { refresh_token } : {}),
      }).toString(),
    })

  beforeEach(async () => {
    await createClientAndTokens(auth)
  })

  test("success", async () => {
    setSystemTime(Date.now() + 1000 * 60 + 1000)
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)
    const refreshed = await response.json()
    expect(refreshed).toStrictEqual({
      access_token: expectNonEmptyString,
      token_type: "Bearer",
      expires_in: expect.any(Number),
      refresh_token: expectNonEmptyString,
    })
    expect(refreshed.access_token).not.toEqual(tokens.access)
    expect(refreshed.refresh_token).not.toEqual(tokens.refresh)

    const verified = await client.verify(subjects, refreshed.access_token)
    expect(verified).toStrictEqual({
      aud: "123",
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
  })

  test("introduce resource on refresh when none set", async () => {
    const rpar = new URLSearchParams()
    rpar.set("grant_type", "refresh_token")
    rpar.set("refresh_token", tokens.refresh)
    rpar.set("resource", "https://api.example.com/")
    const response = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rpar.toString(),
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const verified = await client.verify(subjects, body.access_token)
    expect(verified).toStrictEqual({
      aud: "https://api.example.com/",
      subject: {
        type: "user",
        properties: { userID: "123" },
      },
    })
  })

  test("refresh enforces authorized resource set", async () => {
    // First acquire tokens with two authorized resources by doing auth with two resource params
    const authz = issuer({
      ...issuerConfig,
    })
    const cl = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(authz.request(a, b)),
    })
    const { challenge, url } = await cl.authorize(
      "https://client.example.com/callback",
      "code",
      {
        pkce: true,
        resources: ["https://a.example.com/", "https://b.example.com/"],
      },
    )
    let response = await authz.request(url)
    response = await authz.request(response.headers.get("location")!, {
      headers: { cookie: response.headers.get("set-cookie")! },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")!
    // Exchange for tokens bound to https://a.example.com/
    const exchanged = await cl.exchange(
      code,
      "https://client.example.com/callback",
      challenge.verifier,
      { resource: "https://a.example.com/" },
    )
    if (exchanged.err) throw exchanged.err
    const firstTokens = {
      access_token: exchanged.tokens.access,
      refresh_token: exchanged.tokens.refresh,
    }
    // Now try to refresh into an unauthorized resource
    const p3 = new URLSearchParams()
    p3.set("grant_type", "refresh_token")
    p3.set("refresh_token", firstTokens.refresh_token)
    p3.set("resource", "https://c.example.com/")
    const refresh = await authz.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p3.toString(),
    })
    expect(refresh.status).toBe(400)
    const body = await refresh.json()
    expect(body.error).toBe("invalid_target")
  })

  test("refresh can switch to another originally authorized resource", async () => {
    const authz = issuer({
      ...issuerConfig,
    })
    const cl = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(authz.request(a, b)),
    })
    const { challenge, url } = await cl.authorize(
      "https://client.example.com/callback",
      "code",
      {
        pkce: true,
        resources: ["https://a.example.com/", "https://b.example.com/"],
      },
    )
    let response = await authz.request(url)
    response = await authz.request(response.headers.get("location")!, {
      headers: { cookie: response.headers.get("set-cookie")! },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")!
    // Exchange picking resource A
    const exchanged = await cl.exchange(
      code,
      "https://client.example.com/callback",
      challenge.verifier,
      { resource: "https://a.example.com/" },
    )
    if (exchanged.err) throw exchanged.err
    // Now refresh to pick resource B (also authorized originally)
    const p = new URLSearchParams()
    p.set("grant_type", "refresh_token")
    p.set("refresh_token", exchanged.tokens.refresh)
    p.set("resource", "https://b.example.com/")
    const r = await authz.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p.toString(),
    })
    expect(r.status).toBe(200)
    const tokens = await r.json()
    const verified = await cl.verify(subjects, tokens.access_token)
    expect(verified).toStrictEqual({
      aud: "https://b.example.com/",
      subject: {
        type: "user",
        properties: { userID: "123" },
      },
    })
  })

  test("success with valid access token", async () => {
    // have to increment the time so new access token claims are different (i.e. exp)
    setSystemTime(Date.now() + 1000)
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)
    const refreshed = await response.json()
    expect(refreshed).toStrictEqual({
      access_token: expectNonEmptyString,
      token_type: "Bearer",
      expires_in: expect.any(Number),
      refresh_token: expectNonEmptyString,
    })

    expect(refreshed.access_token).not.toEqual(tokens.access)
    expect(refreshed.refresh_token).not.toEqual(tokens.refresh)

    const verified = await client.verify(subjects, refreshed.access_token)
    expect(verified).toStrictEqual({
      aud: "123",
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
  })

  test("multiple active tokens", async () => {
    const tokens2 = await generateTokens(auth)

    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)

    response = await requestRefreshToken(tokens2.refresh)
    expect(response.status).toBe(200)
  })

  test("failure with reuse interval disabled", async () => {
    const issuerWithoutReuse = issuer({
      ...issuerConfig,
      ttl: {
        ...issuerConfig.ttl,
        reuse: 0,
        retention: 0,
      },
    })
    await createClientAndTokens(issuerWithoutReuse)
    let response = await requestRefreshToken(tokens.refresh, issuerWithoutReuse)
    expect(response.status).toBe(200)

    response = await requestRefreshToken(tokens.refresh, issuerWithoutReuse)
    expect(response.status).toBe(400)
    const reused = await response.json()
    expect(reused.error).toBe("invalid_grant")
  })

  test("success with reuse interval enabled", async () => {
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)
    const refreshed = await response.json()
    const [, refreshedAccessPayload] = refreshed.access_token.split(".")

    setSystemTime(Date.now() + 1000 * 30)

    response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)
    const reused = await response.json()
    const [, reusedAccessPayload] = reused.access_token.split(".")
    expect(refreshed.refresh_token).toEqual(reused.refresh_token)
    /**
     * Access token signature is different every time for ES256 alg,
     * but the payload should be the same.
     */
    expect(refreshedAccessPayload).toEqual(reusedAccessPayload)
  })

  test("invalidated with reuse detection", async () => {
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)

    setSystemTime(Date.now() + 1000 * 60 + 1000)

    response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(400)
  })

  test("reuse window persists resource before metadata (serialized store)", async () => {
    // Storage adapter that clones values to simulate serialization (no shared refs)
    const CloneStorage = (): StorageAdapter => {
      const map = new Map<
        string,
        { value: Record<string, unknown>; exp?: number }
      >()
      return {
        async get(key) {
          const k = joinKey(key)
          const e = map.get(k)
          if (!e) return undefined
          if (e.exp && Date.now() >= e.exp) return undefined
          return JSON.parse(JSON.stringify(e.value))
        },
        async set(key, value, expiry) {
          const k = joinKey(key)
          map.set(k, {
            value: JSON.parse(JSON.stringify(value)),
            exp: expiry?.getTime(),
          })
        },
        async remove(key) {
          map.delete(joinKey(key))
        },
        async *scan(prefix) {
          const p = joinKey(prefix)
          for (const [k, v] of map) {
            if (!k.startsWith(p)) continue
            if (v.exp && Date.now() >= v.exp) continue
            yield [splitKey(k), JSON.parse(JSON.stringify(v.value))]
          }
        },
      }
    }

    const custom = issuer({
      ...issuerConfig,
      storage: CloneStorage(),
    })
    // Authorize and exchange to get initial refresh
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(custom.request(a, b)),
    })
    const { challenge, url } = await client.authorize(
      "https://client.example.com/callback",
      "code",
      { pkce: true },
    )
    let response = await custom.request(url)
    response = await custom.request(response.headers.get("location")!, {
      headers: { cookie: response.headers.get("set-cookie")! },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")!
    const first = await client.exchange(
      code,
      "https://client.example.com/callback",
      challenge.verifier,
    )
    if (first.err) throw first.err

    // First refresh selects resource A
    const r1p = new URLSearchParams()
    r1p.set("grant_type", "refresh_token")
    r1p.set("refresh_token", first.tokens.refresh)
    r1p.set("resource", "https://a.example.com/")
    const r1 = await custom.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: r1p.toString(),
    })
    expect(r1.status).toBe(200)

    // Second refresh reuses same original token but attempts different resource B
    const p4 = new URLSearchParams()
    p4.set("grant_type", "refresh_token")
    p4.set("refresh_token", first.tokens.refresh)
    p4.set("resource", "https://b.example.com/")
    const r2 = await custom.request("https://auth.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: p4.toString(),
    })
    expect(r2.status).toBe(400)
    const body = await r2.json()
    expect(body.error).toBe("invalid_target")
  })

  test("expired failure", async () => {
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(400)
    const reused = await response.json()
    expect(reused.error).toBe("invalid_grant")
  })

  test("missing failure", async () => {
    let response = await requestRefreshToken("")
    expect(response.status).toBe(400)
    const reused = await response.json()
    expect(reused.error).toBe("invalid_request")
  })
})

describe("user info", () => {
  let tokens: { access: string; refresh: string }
  let client: ReturnType<typeof createClient>

  const generateTokens = async (issuer: typeof auth) => {
    const { challenge, url } = await client.authorize(
      "https://client.example.com/callback",
      "code",
      { pkce: true },
    )
    let response = await issuer.request(url)
    response = await issuer.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")
    const exchanged = await client.exchange(
      code!,
      "https://client.example.com/callback",
      challenge.verifier,
    )
    if (exchanged.err) throw exchanged.err
    return exchanged.tokens
  }

  const createClientAndTokens = async (issuer: typeof auth) => {
    client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(issuer.request(a, b)),
    })
    tokens = await generateTokens(issuer)
  }

  beforeEach(async () => {
    await createClientAndTokens(auth)
  })

  test("success", async () => {
    const response = await auth.request("https://auth.example.com/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access}` },
    })

    const userinfo = await response.json()

    expect(userinfo).toStrictEqual({ userID: "123" })
  })
})
