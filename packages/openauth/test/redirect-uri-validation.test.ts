import { expect, test, describe } from "bun:test"
import { object, string } from "valibot"
import { issuer } from "../src/issuer.js"
import { createSubjects } from "../src/subject.js"
import { MemoryStorage } from "../src/storage/memory.js"
import { Provider } from "../src/provider/provider.js"

const subjects = createSubjects({
  user: object({
    userID: string(),
  }),
})

const storage = MemoryStorage()

const auth = issuer({
  storage,
  subjects,
  // Uses default allow function
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
})

describe("redirect_uri validation", () => {
  test("does not redirect when response_type is missing", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("redirect_uri", "https:example.com")

    const response = await auth.request(url.toString())
    expect(response.status).toBe(400)
  })

  test("does not redirect when client_id is missing (code flow)", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("redirect_uri", "https:example.com")
    url.searchParams.set("response_type", "code")

    const response = await auth.request(url.toString())
    expect(response.status).toBe(400)
  })

  test("does not redirect when response_type is missing but client_id present", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("redirect_uri", "https:example.com")
    url.searchParams.set("client_id", "web")

    const response = await auth.request(url.toString())
    expect(response.status).toBe(400)
  })

  test("allows same-level subdomain within same apex domain", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://sub.example.com/callback")
    url.searchParams.set("response_type", "token")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)
    const redirectTo = response.headers.get("location")!
    response = await auth.request(redirectTo, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin).toBe("https://sub.example.com")
    expect(location.pathname).toBe("/callback")
    expect(location.hash).toContain("access_token=")
  })

  test("rejects malformed scheme-like redirect https:evil.com", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https:evil.com")
    url.searchParams.set("response_type", "token")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    const response = await auth.request(url.toString())
    // Must not redirect; malformed redirect URIs are invalid
    expect(response.status).toBe(400)
  })

  test("allows same-level subdomain in code flow", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://sub.example.com/callback")
    url.searchParams.set("response_type", "code")
    url.searchParams.set("state", "test123")
    url.searchParams.set("provider", "dummy")

    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin).toBe("https://sub.example.com")
    expect(location.searchParams.has("code")).toBe(true)
  })

  test("rejects malformed scheme-like redirect https:evil.com (code flow)", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https:evil.com")
    url.searchParams.set("response_type", "code")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    const response = await auth.request(url.toString())
    expect(response.status).toBe(400)
  })

  test("rejects external domain redirect (code flow)", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://evil.com/steal")
    url.searchParams.set("response_type", "code")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    const response = await auth.request(url.toString())
    expect(response.status).toBe(400)
  })

  test("rejects external domain redirect", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://evil.com/steal")
    url.searchParams.set("response_type", "token")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    const response = await auth.request(url.toString())
    expect(response.status).toBe(400)
  })

  test("allows different subdomain level within same apex domain", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set(
      "redirect_uri",
      "https://deep.sub.example.com/callback",
    )
    url.searchParams.set("response_type", "token")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)
    const redirectTo = response.headers.get("location")!
    response = await auth.request(redirectTo, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin).toBe("https://deep.sub.example.com")
    expect(location.pathname).toBe("/callback")
    expect(location.hash).toContain("access_token=")
  })

  test("allows apex within same apex domain", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://example.com/callback")
    url.searchParams.set("response_type", "token")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)

    const redirectTo = response.headers.get("location")!
    response = await auth.request(redirectTo, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin).toBe("https://example.com")
    expect(location.pathname).toBe("/callback")
    expect(location.hash).toContain("access_token=")
  })

  test("allows apex within same apex domain (code flow)", async () => {
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://example.com/callback")
    url.searchParams.set("response_type", "code")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin).toBe("https://example.com")
    expect(location.pathname).toBe("/callback")
    expect(location.searchParams.has("code")).toBe(true)
  })

  test("respects x-forwarded-host when deciding allow", async () => {
    // Request URL host differs from forwarded host; allow should use x-forwarded-host
    const url = new URL("https://internal.local/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://app.example.com/callback")
    url.searchParams.set("response_type", "token")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    let response = await auth.request(url.toString(), {
      headers: {
        "x-forwarded-host": "auth.example.com",
      },
    })
    expect(response.status).toBe(302)
    const redirectTo = response.headers.get("location")!
    response = await auth.request(redirectTo, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin).toBe("https://app.example.com")
    expect(location.pathname).toBe("/callback")
    expect(location.hash).toContain("access_token=")
  })

  test("respects x-forwarded-host (code flow)", async () => {
    const url = new URL("https://internal.local/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://app.example.com/callback")
    url.searchParams.set("response_type", "code")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    let response = await auth.request(url.toString(), {
      headers: {
        "x-forwarded-host": "auth.example.com",
      },
    })
    expect(response.status).toBe(302)
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("location")!)
    expect(location.origin).toBe("https://app.example.com")
    expect(location.pathname).toBe("/callback")
    expect(location.searchParams.has("code")).toBe(true)
  })

  test("code flow requires same redirect_uri on token exchange", async () => {
    // Authorize with one redirect_uri
    const url = new URL("https://auth.example.com/authorize")
    url.searchParams.set("client_id", "web")
    url.searchParams.set("redirect_uri", "https://app.example.com/callback")
    url.searchParams.set("response_type", "code")
    url.searchParams.set("provider", "dummy")
    url.searchParams.set("state", "test123")

    let response = await auth.request(url.toString())
    expect(response.status).toBe(302)
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    expect(response.status).toBe(302)
    const final = new URL(response.headers.get("location")!)
    const code = final.searchParams.get("code")!

    // Exchange with a different redirect_uri (same host, different path)
    const tokenRes = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: "web",
        redirect_uri: "https://app.example.com/other",
      }).toString(),
    })
    expect(tokenRes.status).toBe(400)
    const body = await tokenRes.json()
    expect(body).toStrictEqual({
      error: "invalid_redirect_uri",
      error_description: "Redirect URI mismatch",
    })
  })
})
