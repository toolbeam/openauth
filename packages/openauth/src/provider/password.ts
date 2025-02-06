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
import { v1 } from "@standard-schema/spec"

/**
 * @internal
 */
export interface PasswordHasher<T> {
  hash(password: string): Promise<T>
  verify(password: string, compare: T): Promise<boolean>
}

export interface PasswordConfig {
  /**
   * @internal
   */
  length?: number
  /**
   * @internal
   */
  hasher?: PasswordHasher<any>
  /**
   * The request handler to generate the UI for the login screen.
   *
   * Takes the standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
   * and optionally [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
   * ojects.
   *
   * In case of an error, this is called again with the `error`.
   *
   * Expects the [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object
   * in return.
   */
  login: (
    req: Request,
    form?: FormData,
    error?: PasswordLoginError,
  ) => Promise<Response>
  /**
   * The request handler to generate the UI for the register screen.
   *
   * Takes the standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
   * and optionally [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
   * ojects.
   *
   * Also passes in the current `state` of the flow and any `error` that occurred.
   *
   * Expects the [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object
   * in return.
   */
  register: (
    req: Request,
    state: PasswordRegisterState,
    form?: FormData,
    error?: PasswordRegisterError,
  ) => Promise<Response>
  /**
   * The request handler to generate the UI for the change password screen.
   *
   * Takes the standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
   * and optionally [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
   * ojects.
   *
   * Also passes in the current `state` of the flow and any `error` that occurred.
   *
   * Expects the [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object
   * in return.
   */
  change: (
    req: Request,
    state: PasswordChangeState,
    form?: FormData,
    error?: PasswordChangeError,
  ) => Promise<Response>
  /**
   * Callback to send the confirmation pin code to the user.
   *
   * @example
   * ```ts
   * {
   *   sendCode: async (email, code) => {
   *     // Send an email with the code
   *   }
   * }
   * ```
   */
  sendCode: (email: string, code: string) => Promise<void>
  /**
   * Callback to validate the password on sign up and password reset.
   *
   * @example
   * ```ts
   * {
   *   validatePassword: (password) => {
   *      return password.length < 8 ? "Password must be at least 8 characters" : undefined
   *   }
   * }
   * ```
   */
  validatePassword?:
    | v1.StandardSchema
    | ((password: string) => Promise<string | undefined> | string | undefined)
}

/**
 * The states that can happen on the register screen.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to enter their email address and password to start the flow. |
 * | `code` | The user needs to enter the pin code to verify their email. |
 */
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

/**
 * The errors that can happen on the register screen.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `email_taken` | The email is already taken. |
 * | `invalid_email` | The email is invalid. |
 * | `invalid_code` | The code is invalid. |
 * | `invalid_password` | The password is invalid. |
 * | `password_mismatch` | The passwords do not match. |
 */
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
  | {
      type: "validation_error"
      message?: string
    }

/**
 * The state of the password change flow.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to enter their email address to start the flow. |
 * | `code` | The user needs to enter the pin code to verify their email. |
 * | `update` | The user is asked to enter their new password and confirm it. |
 */
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

/**
 * The errors that can happen on the change password screen.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `invalid_email` | The email is invalid. |
 * | `invalid_code` | The code is invalid. |
 * | `invalid_password` | The password is invalid. |
 * | `password_mismatch` | The passwords do not match. |
 */
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
  | {
      type: "validation_error"
      message: string
    }

/**
 * The errors that can happen on the login screen.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `invalid_email` | The email is invalid. |
 * | `invalid_password` | The password is invalid. |
 */
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
          if (config.validatePassword) {
            let validationError: string | undefined
            try {
              if (typeof config.validatePassword === "function") {
                validationError = await config.validatePassword(password)
              } else {
                const res =
                  await config.validatePassword["~standard"].validate(password)

                if (res.issues?.length) {
                  throw new Error(
                    res.issues.map((issue) => issue.message).join(", "),
                  )
                }
              }
            } catch (error) {
              validationError =
                error instanceof Error ? error.message : undefined
            }
            if (validationError)
              return transition(provider, {
                type: "validation_error",
                message: validationError,
              })
          }
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

        if (action === "register" && provider.type === "code") {
          const code = generate()
          await config.sendCode(provider.email, code)
          return transition({
            type: "code",
            code,
            password: provider.password,
            email: provider.email,
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

          if (config.validatePassword) {
            let validationError: string | undefined
            try {
              if (typeof config.validatePassword === "function") {
                validationError = await config.validatePassword(password)
              } else {
                const res =
                  await config.validatePassword["~standard"].validate(password)

                if (res.issues?.length) {
                  throw new Error(
                    res.issues.map((issue) => issue.message).join(", "),
                  )
                }
              }
            } catch (error) {
              validationError =
                error instanceof Error ? error.message : undefined
            }
            if (validationError)
              return transition(provider, {
                type: "validation_error",
                message: validationError,
              })
          }

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

/**
 * @internal
 */
export function PBKDF2Hasher(opts?: { iterations?: number }): PasswordHasher<{
  hash: string
  salt: string
  iterations: number
}> {
  const iterations = opts?.iterations ?? 600000
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

/**
 * @internal
 */
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
