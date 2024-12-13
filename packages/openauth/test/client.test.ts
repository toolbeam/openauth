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
import { object, string } from "valibot"
import { authorizer } from "../src/authorizer.js"
import { createClient } from "../src/client.js"
import {
  InvalidAccessTokenError,
  InvalidRefreshTokenError,
} from "../src/error.js"
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
  storage = MemoryStorage()
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
    const refreshSpy = spyOn(client, "refresh")
    const verified = await client.verify(subjects, tokens.access)
    expect(verified).toStrictEqual({
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
    expect(refreshSpy).not.toBeCalled()
  })

  test("success after refresh", async () => {
    const refreshSpy = spyOn(client, "refresh")
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    const verified = await client.verify(subjects, tokens.access, {
      refresh: tokens.refresh,
    })
    expect(verified).toStrictEqual({
      tokens: {
        access: expectNonEmptyString,
        refresh: expectNonEmptyString,
      },
      subject: {
        type: "user",
        properties: {
          userID: "123",
        },
      },
    })
    expect(refreshSpy).toBeCalled()
  })

  test("failure with expired access token", async () => {
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    const verified = await client.verify(subjects, tokens.access)
    expect(verified).toStrictEqual({
      err: expect.any(InvalidAccessTokenError),
    })
  })

  test("failure with invalid refresh token", async () => {
    setSystemTime(Date.now() + 1000 * 6000 + 1000)
    const verified = await client.verify(subjects, tokens.access, {
      refresh: "foo",
    })
    expect(verified).toStrictEqual({
      err: expect.any(InvalidRefreshTokenError),
    })
  })
})
