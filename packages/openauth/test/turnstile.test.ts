import { afterEach, expect, test } from "bun:test"
import { object, string } from "valibot"
import { issuer } from "../src/issuer.js"
import { createSubjects } from "../src/subject.js"
import { MemoryStorage } from "../src/storage/memory.js"
import { Storage } from "../src/storage/storage.js"
import { PasswordProvider } from "../src/provider/password.js"
import { CodeProvider } from "../src/provider/code.js"

const subjects = createSubjects({
  user: object({
    userID: string(),
  }),
})

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

test("password provider blocks without turnstile token", async () => {
  globalThis.fetch = async () => {
    throw new Error("unexpected turnstile verify call")
  }

  const storage = MemoryStorage()
  await Storage.set(storage, ["email", "user@example.com", "password"], "pass")

  const app = issuer({
    storage,
    subjects,
    allow: async () => true,
    providers: {
      password: PasswordProvider({
        hasher: {
          async hash(password) {
            return password
          },
          async verify(password, compare) {
            return password === compare
          },
        },
        turnstile: { secretKey: "secret" },
        sendCode: async () => {},
        login: async (_req, _form, error) =>
          new Response(error?.type ?? "ok", { status: error ? 401 : 200 }),
        register: async (_req, _state, _form, error) =>
          new Response(error?.type ?? "ok", { status: error ? 400 : 200 }),
        change: async (_req, _state, _form, error) =>
          new Response(error?.type ?? "ok", { status: error ? 400 : 200 }),
      }),
    },
    success: async (ctx, value) => {
      if (value.provider !== "password") throw new Error("unexpected provider")
      return ctx.subject("user", { userID: "123" })
    },
  })

  const authorize = new URL("https://auth.example.com/authorize")
  authorize.searchParams.set("provider", "password")
  authorize.searchParams.set("response_type", "token")
  authorize.searchParams.set("redirect_uri", "https://client.example.com/cb")
  authorize.searchParams.set("client_id", "client")

  let res = await app.request(authorize.toString())
  const cookie = res.headers.get("set-cookie")!

  res = await app.request("https://auth.example.com/password/authorize", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      email: "user@example.com",
      password: "pass",
    }).toString(),
  })

  expect(res.status).toBe(401)
  expect(await res.text()).toBe("turnstile")
})

test("password provider allows with valid turnstile token", async () => {
  globalThis.fetch = async (input, init) => {
    if (input !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
      throw new Error("unexpected fetch: " + input)
    }
    const body = init?.body?.toString?.() ?? ""
    if (!body.includes("response=token")) {
      return new Response(JSON.stringify({ success: false }), {
        headers: { "content-type": "application/json" },
      })
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { "content-type": "application/json" },
    })
  }

  const storage = MemoryStorage()
  await Storage.set(storage, ["email", "user@example.com", "password"], "pass")

  const app = issuer({
    storage,
    subjects,
    allow: async () => true,
    providers: {
      password: PasswordProvider({
        hasher: {
          async hash(password) {
            return password
          },
          async verify(password, compare) {
            return password === compare
          },
        },
        turnstile: { secretKey: "secret" },
        sendCode: async () => {},
        login: async () => new Response("ok"),
        register: async () => new Response("ok"),
        change: async () => new Response("ok"),
      }),
    },
    success: async (ctx, value) => {
      if (value.provider !== "password") throw new Error("unexpected provider")
      return ctx.subject("user", { userID: "123" })
    },
  })

  const authorize = new URL("https://auth.example.com/authorize")
  authorize.searchParams.set("provider", "password")
  authorize.searchParams.set("response_type", "token")
  authorize.searchParams.set("redirect_uri", "https://client.example.com/cb")
  authorize.searchParams.set("client_id", "client")

  let res = await app.request(authorize.toString())
  const cookie = res.headers.get("set-cookie")!

  res = await app.request("https://auth.example.com/password/authorize", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      email: "user@example.com",
      password: "pass",
      "cf-turnstile-response": "token",
    }).toString(),
  })

  expect(res.status).toBe(302)
  const location = res.headers.get("location")!
  expect(location.startsWith("https://client.example.com/cb#")).toBe(true)
})

test("code provider blocks request without turnstile token", async () => {
  globalThis.fetch = async () => {
    throw new Error("unexpected turnstile verify call")
  }

  const storage = MemoryStorage()
  const app = issuer({
    storage,
    subjects,
    allow: async () => true,
    providers: {
      code: CodeProvider({
        turnstile: { secretKey: "secret" },
        sendCode: async () => {},
        request: async (_req, state, _form, error) =>
          new Response(`${state.type}:${error?.type ?? ""}`),
      }),
    },
    success: async (ctx, value) => {
      if (value.provider !== "code") throw new Error("unexpected provider")
      return ctx.subject("user", { userID: "123" })
    },
  })

  const authorize = new URL("https://auth.example.com/authorize")
  authorize.searchParams.set("provider", "code")
  authorize.searchParams.set("response_type", "token")
  authorize.searchParams.set("redirect_uri", "https://client.example.com/cb")
  authorize.searchParams.set("client_id", "client")

  let res = await app.request(authorize.toString())
  const authCookie = res.headers.get("set-cookie")!
  const location = res.headers.get("location")!

  res = await app.request(location, {
    headers: {
      cookie: authCookie,
    },
  })
  const providerCookie = res.headers.get("set-cookie")!

  res = await app.request("https://auth.example.com/code/authorize", {
    method: "POST",
    headers: {
      cookie: `${authCookie}; ${providerCookie}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action: "request",
      email: "user@example.com",
    }).toString(),
  })

  expect(res.status).toBe(200)
  expect(await res.text()).toBe("start:turnstile")
})
