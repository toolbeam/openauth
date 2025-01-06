/**
 * Configures a provider that supports username and password authentication. This is usually
 * paired with the `PasswordUI`.
 *
 * ```ts
 * import { PasswordUI } from "@openauthjs/openauth/ui/password"
 * import { PasswordProvider } from "@openauthjs/openauth/provider/password"
 *
 * export default issuer({
 *   providers: {
 *     password: PasswordProvider(
 *       PasswordUI({
 *         copy: {
 *           error_email_taken: "This email is already taken."
 *         },
 *         sendCode: (email, code) => console.log(email, code)
 *       })
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * You can customize the adapter using.
 *
 * ```ts {7-9}
 * const ui = PasswordUI({
 *   // ...
 * })
 *
 * export default issuer({
 *   providers: {
 *     password: PasswordAdapter(
 *       { ...ui, hasher: PBKDF2Hasher() }
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * Behind the scenes, the `PasswordProvider` expects callbacks that implements request handlers
 * that generate the UI for the following.
 *
 * ```ts
 * PasswordProvider({
 *   // ...
 *   login: (req, form, error) => Promise<Response>
 *   register: (req, state, form, error) => Promise<Response>
 *   change: (req, state, form, error) => Promise<Response>
 * })
 * ```
 *
 * This allows you to create your own UI for each of these screens.
 *
 * @packageDocumentation
 */
import { UnknownStateError } from "../error.js"
import { Storage } from "../storage/storage.js"
import { Provider } from "./provider.js"
import { generateUnbiasedDigits, timingSafeCompare } from "../random.js"

export interface PasswordHasher<T> {
  hash(password: string): Promise<T>
  verify(password: string, compare: T): Promise<boolean>
}

export interface PasswordConfig {
  length?: number
  hasher?: PasswordHasher<any>
  login: (
    req: Request,
    form?: FormData,
    error?: PasswordLoginError,
  ) => Promise<Response>
  register: (
    req: Request,
    state: PasswordRegisterState,
    form?: FormData,
    error?: PasswordRegisterError,
  ) => Promise<Response>
  change: (
    req: Request,
    state: PasswordChangeState,
    form?: FormData,
    error?: PasswordChangeError,
  ) => Promise<Response>
  sendCode: (email: string, code: string) => Promise<void>
}

export type PasswordRegisterState =
  | {
      type: "start"
    }
  | {
      type: "code"
      code: string
      email: string
      password: string
    }

export type PasswordRegisterError =
  | {
      type: "invalid_code"
    }
  | {
      type: "email_taken"
    }
  | {
      type: "invalid_email"
    }
  | {
      type: "invalid_password"
    }
  | {
      type: "password_mismatch"
    }

export type PasswordChangeState =
  | {
      type: "start"
      redirect: string
    }
  | {
      type: "code"
      code: string
      email: string
      redirect: string
    }
  | {
      type: "update"
      redirect: string
      email: string
    }

export type PasswordChangeError =
  | {
      type: "invalid_email"
    }
  | {
      type: "invalid_code"
    }
  | {
      type: "invalid_password"
    }
  | {
      type: "password_mismatch"
    }

export type PasswordLoginError =
  | {
      type: "invalid_password"
    }
  | {
      type: "invalid_email"
    }

export function PasswordProvider(
  config: PasswordConfig,
): Provider<{ email: string }> {
  const hasher = config.hasher ?? ScryptHasher()
  function generate() {
    return generateUnbiasedDigits(6)
  }
  return {
    type: "password",
    init(routes, ctx) {
      routes.get("/authorize", async (c) =>
        ctx.forward(c, await config.login(c.req.raw)),
      )

      routes.post("/authorize", async (c) => {
        const fd = await c.req.formData()
        async function error(err: PasswordLoginError) {
          return ctx.forward(c, await config.login(c.req.raw, fd, err))
        }
        const email = fd.get("email")?.toString()?.toLowerCase()
        if (!email) return error({ type: "invalid_email" })
        const hash = await Storage.get<HashedPassword>(ctx.storage, [
          "email",
          email,
          "password",
        ])
        const password = fd.get("password")?.toString()
        if (!password || !hash || !(await hasher.verify(password, hash)))
          return error({ type: "invalid_password" })
        return ctx.success(
          c,
          {
            email: email,
          },
          {
            invalidate: async (subject) => {
              await Storage.set(
                ctx.storage,
                ["email", email, "subject"],
                subject,
              )
            },
          },
        )
      })

      routes.get("/register", async (c) => {
        const state: PasswordRegisterState = {
          type: "start",
        }
        await ctx.set(c, "provider", 60 * 60 * 24, state)
        return ctx.forward(c, await config.register(c.req.raw, state))
      })

      routes.post("/register", async (c) => {
        const fd = await c.req.formData()
        const email = fd.get("email")?.toString()?.toLowerCase()
        const action = fd.get("action")?.toString()
        const provider = await ctx.get<PasswordRegisterState>(c, "provider")

        async function transition(
          next: PasswordRegisterState,
          err?: PasswordRegisterError,
        ) {
          await ctx.set<PasswordRegisterState>(
            c,
            "provider",
            60 * 60 * 24,
            next,
          )
          return ctx.forward(c, await config.register(c.req.raw, next, fd, err))
        }

        if (action === "register" && provider.type === "start") {
          const password = fd.get("password")?.toString()
          const repeat = fd.get("repeat")?.toString()
          if (!email) return transition(provider, { type: "invalid_email" })
          if (!password)
            return transition(provider, { type: "invalid_password" })
          if (password !== repeat)
            return transition(provider, { type: "password_mismatch" })
          const existing = await Storage.get(ctx.storage, [
            "email",
            email,
            "password",
          ])
          if (existing) return transition(provider, { type: "email_taken" })
          const code = generate()
          await config.sendCode(email, code)
          return transition({
            type: "code",
            code,
            password: await hasher.hash(password),
            email,
          })
        }

        if (action === "verify" && provider.type === "code") {
          const code = fd.get("code")?.toString()
          if (!code || !timingSafeCompare(code, provider.code))
            return transition(provider, { type: "invalid_code" })
          const existing = await Storage.get(ctx.storage, [
            "email",
            provider.email,
            "password",
          ])
          if (existing)
            return transition({ type: "start" }, { type: "email_taken" })
          await Storage.set(
            ctx.storage,
            ["email", provider.email, "password"],
            provider.password,
          )
          return ctx.success(c, {
            email: provider.email,
          })
        }

        return transition({ type: "start" })
      })

      routes.get("/change", async (c) => {
        let redirect =
          c.req.query("redirect_uri") || getRelativeUrl(c, "./authorize")
        const state: PasswordChangeState = {
          type: "start",
          redirect,
        }
        await ctx.set(c, "provider", 60 * 60 * 24, state)
        return ctx.forward(c, await config.change(c.req.raw, state))
      })

      routes.post("/change", async (c) => {
        const fd = await c.req.formData()
        const action = fd.get("action")?.toString()
        const provider = await ctx.get<PasswordChangeState>(c, "provider")
        if (!provider) throw new UnknownStateError()

        async function transition(
          next: PasswordChangeState,
          err?: PasswordChangeError,
        ) {
          await ctx.set<PasswordChangeState>(c, "provider", 60 * 60 * 24, next)
          return ctx.forward(c, await config.change(c.req.raw, next, fd, err))
        }

        if (action === "code") {
          const email = fd.get("email")?.toString()?.toLowerCase()
          if (!email)
            return transition(
              { type: "start", redirect: provider.redirect },
              { type: "invalid_email" },
            )
          const code = generate()
          await config.sendCode(email, code)

          return transition({
            type: "code",
            code,
            email,
            redirect: provider.redirect,
          })
        }

        if (action === "verify" && provider.type === "code") {
          const code = fd.get("code")?.toString()
          if (!code || !timingSafeCompare(code, provider.code))
            return transition(provider, { type: "invalid_code" })
          return transition({
            type: "update",
            email: provider.email,
            redirect: provider.redirect,
          })
        }

        if (action === "update" && provider.type === "update") {
          const existing = await Storage.get(ctx.storage, [
            "email",
            provider.email,
            "password",
          ])
          if (!existing) return c.redirect(provider.redirect, 302)

          const password = fd.get("password")?.toString()
          const repeat = fd.get("repeat")?.toString()
          if (!password)
            return transition(provider, { type: "invalid_password" })
          if (password !== repeat)
            return transition(provider, { type: "password_mismatch" })

          await Storage.set(
            ctx.storage,
            ["email", provider.email, "password"],
            await hasher.hash(password),
          )
          const subject = await Storage.get<string>(ctx.storage, [
            "email",
            provider.email,
            "subject",
          ])
          if (subject) await ctx.invalidate(subject)

          return c.redirect(provider.redirect, 302)
        }

        return transition({ type: "start", redirect: provider.redirect })
      })
    },
  }
}

import * as jose from "jose"
import { TextEncoder } from "node:util"

interface HashedPassword {}

export function PBKDF2Hasher(opts?: { interations?: number }): PasswordHasher<{
  hash: string
  salt: string
  iterations: number
}> {
  const iterations = opts?.interations ?? 600000
  return {
    async hash(password) {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(password)
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        bytes,
        "PBKDF2",
        false,
        ["deriveBits"],
      )
      const hash = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: salt,
          iterations,
        },
        keyMaterial,
        256,
      )
      const hashBase64 = jose.base64url.encode(new Uint8Array(hash))
      const saltBase64 = jose.base64url.encode(salt)
      return {
        hash: hashBase64,
        salt: saltBase64,
        iterations,
      }
    },
    async verify(password, compare) {
      const encoder = new TextEncoder()
      const passwordBytes = encoder.encode(password)
      const salt = jose.base64url.decode(compare.salt)
      const params = {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: compare.iterations,
      }
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBytes,
        "PBKDF2",
        false,
        ["deriveBits"],
      )
      const hash = await crypto.subtle.deriveBits(params, keyMaterial, 256)
      const hashBase64 = jose.base64url.encode(new Uint8Array(hash))
      return hashBase64 === compare.hash
    },
  }
}
import { timingSafeEqual, randomBytes, scrypt } from "node:crypto"
import { getRelativeUrl } from "../util.js"

export function ScryptHasher(opts?: {
  N?: number
  r?: number
  p?: number
}): PasswordHasher<{
  hash: string
  salt: string
  N: number
  r: number
  p: number
}> {
  const N = opts?.N ?? 16384
  const r = opts?.r ?? 8
  const p = opts?.p ?? 1

  return {
    async hash(password) {
      const salt = randomBytes(16)
      const keyLength = 32 // 256 bits

      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        scrypt(password, salt, keyLength, { N, r, p }, (err, derivedKey) => {
          if (err) reject(err)
          else resolve(derivedKey)
        })
      })

      const hashBase64 = derivedKey.toString("base64")
      const saltBase64 = salt.toString("base64")

      return {
        hash: hashBase64,
        salt: saltBase64,
        N,
        r,
        p,
      }
    },

    async verify(password, compare) {
      const salt = Buffer.from(compare.salt, "base64")
      const keyLength = 32 // 256 bits

      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        scrypt(
          password,
          salt,
          keyLength,
          { N: compare.N, r: compare.r, p: compare.p },
          (err, derivedKey) => {
            if (err) reject(err)
            else resolve(derivedKey)
          },
        )
      })

      return timingSafeEqual(derivedKey, Buffer.from(compare.hash, "base64"))
    },
  }
}
