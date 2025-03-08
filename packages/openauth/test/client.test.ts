import {
  expect,
  test,
  setSystemTime,
  describe,
  beforeEach,
  afterEach,
  spyOn,
  afterAll,
  mock,
} from "bun:test"
import { object } from "valibot"
import { issuer } from "../src/issuer.js"
import { createClient } from "../src/client.js"
import {
  InvalidAccessTokenError,
  InvalidRefreshTokenError,
} from "../src/error.js"
import { MemoryStorage } from "../src/storage/memory.js"
import { createSubjects } from "../src/subject.js"

const subjects = createSubjects({
  user: object({}),
})

let storage = MemoryStorage()
const auth = issuer({
  storage,
  subjects,
  allow: async () => true,
  success: async (ctx) => {
    return ctx.subject("user", "123", {})
  },
  ttl: {
    access: 60,
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
    },
  },
})

const expectNonEmptyString = expect.stringMatching(/.+/)

beforeEach(async () => {
  setSystemTime(new Date("1/1/2024"))
})

afterEach(() => {
  setSystemTime()
})

const consoleSpy = spyOn(console, "error").mockImplementation(mock())
afterAll(() => {
  consoleSpy.mockRestore()
})

describe("verify", () => {
  let tokens: { access: string; refresh: string }
  let client: ReturnType<typeof createClient>

  beforeEach(async () => {
    client = createClient({
      // use different issuer per test file to avoid JWKS cache issues
      issuer: "https://auth1.example.com",
      clientID: "123",
      fetch: (a, b) => Promise.resolve(auth.request(a, b)),
    })
    const authorization = await client.authorize(
      "https://client.example.com/callback",
      "code",
    )
    let response = await auth.request(authorization.url)
    response = await auth.request(response.headers.get("location")!, {
      headers: {
        cookie: response.headers.get("set-cookie")!,
      },
    })
    const location = new URL(response.headers.get("location")!)
    const code = location.searchParams.get("code")
    const exchanged = await client.exchange(
      code!,
      "https://client.example.com/callback",
      authorization.challenge.verifier,
    )
    if (exchanged.err) throw exchanged.err
    tokens = exchanged.tokens
  })

  test("success", async () => {
    const refreshSpy = spyOn(client, "refresh")
    const verified = await client.verify(tokens.access)
    expect(verified).toStrictEqual({
      aud: "123",
      subject: {
        id: "123",
        type: "user",
        properties: {},
      },
    })
    expect(refreshSpy).not.toBeCalled()
  })

  test("success after refresh", async () => {
    const refreshSpy = spyOn(client, "refresh")
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    const verified = await client.verify(tokens.access, {
      refresh: tokens.refresh,
    })
    expect(verified).toStrictEqual({
      aud: "123",
      tokens: {
        expiresIn: 60,
        access: expectNonEmptyString,
        refresh: expectNonEmptyString,
      },
      subject: {
        id: "123",
        type: "user",
        properties: {},
      },
    })
    expect(refreshSpy).toBeCalled()
  })

  test("failure with expired access token", async () => {
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    const verified = await client.verify(tokens.access)
    expect(verified).toStrictEqual({
      err: expect.any(InvalidAccessTokenError),
    })
  })

  test("failure with invalid refresh token", async () => {
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    const verified = await client.verify(tokens.access, {
      refresh: "foo",
    })
    expect(verified).toStrictEqual({
      err: expect.any(InvalidRefreshTokenError),
    })
  })
})
