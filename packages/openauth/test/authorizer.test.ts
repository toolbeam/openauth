import {
  expect,
  test,
  setSystemTime,
  describe,
  beforeEach,
  afterEach,
} from "bun:test"
import { object, string } from "valibot"
import { authorizer } from "../src/authorizer.js"
import { createClient } from "../src/client.js"
import { createSubjects } from "../src/index.js"
import { MemoryStorage } from "../src/storage/memory.js"

const subjects = createSubjects({
  user: object({
    userID: string(),
  }),
})

let storage = MemoryStorage()
const auth = authorizer({
  storage,
  subjects,
  allow: async () => true,
  success: async (ctx) => {
    return ctx.subject("user", {
      userID: "123",
    })
  },
  ttl: {
    access: 60,
    refresh: 6000,
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
      client: async ({ clientID, clientSecret, params }) => {
        if (clientID !== "myuser" && clientSecret !== "mypass") {
          throw new Error("Wrong credentials")
        }
        return {
          clientID,
        }
      },
    },
  },
})

const expectNonEmptyString = expect.stringMatching(/.+/)

beforeEach(async () => {
  storage = MemoryStorage()
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
    const [verifier, authorization] = await client.pkce(
      "https://client.example.com/callback",
    )
    let response = await auth.request(authorization)
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
    const tokens = await client.exchange(
      code!,
      "https://client.example.com/callback",
      verifier,
    )
    expect(tokens).toStrictEqual({
      access: expectNonEmptyString,
      refresh: expectNonEmptyString,
    })
    const verified = await client.verify(subjects, tokens.access)
    expect(verified).toStrictEqual({
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
  })
})

describe("client credentials flow", () => {
  test("success", async () => {
    const client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const response = await auth.request("https://auth.example.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        provider: "dummy",
        client_id: "myuser",
        client_secret: "mypass",
      }).toString(),
    })
    expect(response.status).toBe(200)
    const tokens = await response.json()
    expect(tokens).toStrictEqual({
      access_token: expectNonEmptyString,
      refresh_token: expectNonEmptyString,
    })
    const verified = await client.verify(subjects, tokens.access_token)
    expect(verified).toStrictEqual({
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
  })
})

describe("refresh token", () => {
  let tokens: { access: string; refresh: string }
  let client: ReturnType<typeof createClient>

  const requestRefreshToken = async (refresh_token) =>
    auth.request("https://auth.example.com/token", {
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
    client = createClient({
      issuer: "https://auth.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const [verifier, authorization] = await client.pkce(
      "https://client.example.com/callback",
    )
    let response = await auth.request(authorization)
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")
    tokens = await client.exchange(
      code!,
      "https://client.example.com/callback",
      verifier,
    )
  })

  test("success", async () => {
    setSystemTime(Date.now() + 1000 * 60 + 1000)
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)
    const refreshed = await response.json()
    expect(refreshed).toStrictEqual({
      access_token: expectNonEmptyString,
      refresh_token: expectNonEmptyString,
    })
    expect(refreshed.access_token).not.toEqual(tokens.access)
    expect(refreshed.refresh_token).not.toEqual(tokens.refresh)

    const verified = await client.verify(subjects, refreshed.access_token)
    expect(verified).toStrictEqual({
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
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
      refresh_token: expectNonEmptyString,
    })

    expect(refreshed.access_token).not.toEqual(tokens.access)
    expect(refreshed.refresh_token).not.toEqual(tokens.refresh)

    const verified = await client.verify(subjects, refreshed.access_token)
    expect(verified).toStrictEqual({
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
  })

  test("expired failure", async () => {
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(400)
    const reused = await response.json()
    expect(reused.error).toBe("invalid_grant")
  })

  test("reuse failure", async () => {
    let response = await requestRefreshToken(tokens.refresh)
    expect(response.status).toBe(200)

    response = await requestRefreshToken(tokens.refresh)
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
