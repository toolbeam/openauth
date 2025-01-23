/**
 * Configures a provider that supports pin code authentication. This is usually paired with the
 * `CodeUI`.
 *
 * ```ts
 * import { CodeUI } from "@openauthjs/openauth/ui/code"
 * import { CodeProvider } from "@openauthjs/openauth/provider/code"
 *
 * export default issuer({
 *   providers: {
 *     code: CodeProvider(
 *       CodeUI({
 *         copy: {
 *           code_info: "We'll send a pin code to your email"
 *         },
 *         sendCode: (claims, code) => console.log(claims.email, code)
 *       })
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * You can customize the provider using.
 *
 * ```ts {7-9}
 * const ui = CodeUI({
 *   // ...
 * })
 *
 * export default issuer({
 *   providers: {
 *     code: CodeProvider(
 *       { ...ui, length: 4 }
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * Behind the scenes, the `CodeProvider` expects callbacks that implements request handlers
 * that generate the UI for the following.
 *
 * ```ts
 * CodeProvider({
 *   // ...
 *   request: (req, state, form, error) => Promise<Response>
 * })
 * ```
 *
 * This allows you to create your own UI.
 *
 * @packageDocumentation
 */
import { Context } from "hono"
import { Provider } from "./provider.js"
import { generateUnbiasedDigits, timingSafeCompare } from "../random.js"

export interface CodeProviderConfig<
  Claims extends Record<string, string> = Record<string, string>,
> {
  /**
   * The length of the pin code.
   *
   * @default 6
   */
  length?: number
  /**
   * The request handler to generate the UI for the code flow.
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
  request: (
    req: Request,
    state: CodeProviderState,
    form?: FormData,
    error?: CodeProviderError,
  ) => Promise<Response>
  /**
   * Callback to send the pin code to the user.
   *
   * @example
   * ```ts
   * {
   *   sendCode: async (claims, code) => {
   *     // Send the code through the email or phone number based on the claims
   *   }
   * }
   * ```
   */
  sendCode: (claims: Claims, code: string) => Promise<void | CodeProviderError>
}

/**
 * The state of the code flow.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to enter their email address or phone number to start the flow. |
 * | `code` | The user needs to enter the pin code to verify their _claim_. |
 */
export type CodeProviderState =
  | {
      type: "start"
    }
  | {
      type: "code"
      resend?: boolean
      code: string
      claims: Record<string, string>
    }

/**
 * The errors that can happen on the code flow.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `invalid_code` | The code is invalid. |
 * | `invalid_claim` | The _claim_, email or phone number, is invalid. |
 */
export type CodeProviderError =
  | {
      type: "invalid_code"
    }
  | {
      type: "invalid_claim"
      key: string
      value: string
    }

export function CodeProvider<
  Claims extends Record<string, string> = Record<string, string>,
>(config: CodeProviderConfig<Claims>): Provider<{ claims: Claims }> {
  const length = config.length || 6
  function generate() {
    return generateUnbiasedDigits(length)
  }

  return {
    type: "code",
    init(routes, ctx) {
      async function transition(
        c: Context,
        next: CodeProviderState,
        fd?: FormData,
        err?: CodeProviderError,
      ) {
        await ctx.set<CodeProviderState>(c, "provider", 60 * 60 * 24, next)
        const resp = ctx.forward(
          c,
          await config.request(c.req.raw, next, fd, err),
        )
        return resp
      }
      routes.get("/authorize", async (c) => {
        const resp = await transition(c, {
          type: "start",
        })
        return resp
      })

      routes.post("/authorize", async (c) => {
        const code = generate()
        const fd = await c.req.formData()
        const state = await ctx.get<CodeProviderState>(c, "provider")
        const action = fd.get("action")?.toString()

        if (action === "request" || action === "resend") {
          const claims = Object.fromEntries(fd) as Claims
          delete claims.action
          const err = await config.sendCode(claims, code)
          if (err) return transition(c, { type: "start" }, fd, err)
          return transition(
            c,
            {
              type: "code",
              resend: action === "resend",
              claims,
              code,
            },
            fd,
          )
        }

        if (
          fd.get("action")?.toString() === "verify" &&
          state.type === "code"
        ) {
          const fd = await c.req.formData()
          const compare = fd.get("code")?.toString()
          if (
            !state.code ||
            !compare ||
            !timingSafeCompare(state.code, compare)
          ) {
            return transition(
              c,
              {
                ...state,
                resend: false,
              },
              fd,
              { type: "invalid_code" },
            )
          }
          await ctx.unset(c, "provider")
          return ctx.forward(
            c,
            await ctx.success(c, { claims: state.claims as Claims }),
          )
        }
      })
    },
  }
}

/**
 * @internal
 */
export type CodeProviderOptions = Parameters<typeof CodeProvider>[0]
