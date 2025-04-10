import crypto from "node:crypto"
import type { Context } from "hono"
import { Provider } from "./provider.js"
import { getRelativeUrl } from "../util.js"
import { timingSafeCompare } from "../random.js"

/**
 * Configures a provider that supports Magic Link authentication. This is usually paired with the
 * `MagicLinkUI`.
 *
 * ```ts
 * import { MagicLinkUI } from "@openauthjs/openauth/ui/magic-link"
 * import { MagicLinkProvider } from "@openauthjs/openauth/provider/magic-link"
 *
 * export default issuer({
 *   providers: {
 *     magicLink: MagicLinkProvider(
 *       MagicLinkUI({
 *         copy: {
 *           link_info: "We'll send a link to your email"
 *         },
 *         sendLink: (claims, link) => console.log(claims.email, link)
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
 * const ui = MagicLinkUI({
 *   // ...
 * })
 *
 * export default issuer({
 *   providers: {
 *     magicLink: MagicLinkProvider(
 *       { ...ui, expiry: 3600 * 24 } // 1 day expiry time
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * Behind the scenes, the `MagicLinkProvider` expects callbacks that implements request handlers
 * that generate the UI for the following.
 *
 * ```ts
 * MagicLinkProvider({
 *   // ...
 *   request: (req, state, form, error) => Promise<Response>
 * })
 * ```
 *
 * This allows you to create your own UI.
 *
 * @packageDocumentation
 */

export interface MagicLinkProviderConfig<
  Claims extends Record<string, string> = Record<string, string>,
> {
  /**
   * The time for which the magic link is valid in seconds
   *
   * @default 3600
   */
  expiry?: number
  /**
   * The request handler to generate the UI for the magic link flow.
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
    state: MagicLinkProviderState,
    form?: FormData,
    error?: MagicLinkProviderError,
  ) => Promise<Response>
  /**
   * Callback to send the magic link to the user.
   *
   * @example
   * ```ts
   * {
   *   sendLink: async (claims, link) => {
   *     // Send the magic link through the email or another route based on the claims
   *   }
   * }
   * ```
   */
  sendLink: (
    claims: Claims,
    link: string,
  ) => Promise<void | MagicLinkProviderError>
}

/**
 * The state of the magic link flow.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to enter their email address or phone number to start the flow. |
 * | `code` | The user needs to enter the pin code to verify their _claim_. |
 */
export type MagicLinkProviderState =
  | {
      type: "start"
    }
  | {
      type: "link"
      code: string
      state: string
      claims: Record<string, string>
    }

/**
 * The errors that can happen on the magic link flow.
 *
 * | Error | Description |
 * | ----- | ----------- |
 * | `invalid_code` | The code is invalid. |
 * | `invalid_claim` | The _claim_, email or phone number, is invalid. |
 */
export type MagicLinkProviderError =
  | {
      type: "invalid_code"
    }
  | {
      type: "invalid_claim"
      key: string
      value: string
    }

export function MagicLinkProvider<
  Claims extends Record<string, string> = Record<string, string>,
>(config: MagicLinkProviderConfig<Claims>): Provider<{ claims: Claims }> {
  const expiry = config.expiry ?? 3600

  return {
    type: "magic-link",
    init(routes, ctx) {
      async function transition(
        c: Context,
        next: MagicLinkProviderState,
        fd?: FormData,
        err?: MagicLinkProviderError,
      ) {
        await ctx.set<MagicLinkProviderState>(c, "provider", expiry, next)
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
        const code = crypto.randomBytes(32).toString("base64url")
        const state = crypto.randomUUID()
        const fd = await c.req.formData()
        const claims = Object.fromEntries(fd) as Claims

        const link = getRelativeUrl(c, `./callback?code=${code}&state=${state}`)

        const err = await config.sendLink(claims, link)
        if (err) return transition(c, { type: "start" }, fd, err)
        return transition(
          c,
          {
            type: "link",
            claims,
            state,
            code,
          },
          fd,
        )
      })

      routes.get("/callback", async (c) => {
        const provider = (await ctx.get(
          c,
          "provider",
        )) as MagicLinkProviderState

        if (provider.type !== "link")
          return c.redirect(getRelativeUrl(c, "./authorize"))

        const code = c.req.query("code")
        const state = c.req.query("state")

        if (!provider || !code || (provider.state && state !== provider.state))
          return c.redirect(getRelativeUrl(c, "./authorize"))

        if (!timingSafeCompare(code, provider.code)) {
          return transition(c, provider, undefined, { type: "invalid_code" })
        }

        // Success
        await ctx.unset(c, "provider")
        return ctx.forward(
          c,
          await ctx.success(c, { claims: provider.claims as Claims }),
        )
      })
    },
  }
}

/**
 * @internal
 */
export type MagicLinkProviderOptions = Parameters<typeof MagicLinkProvider>[0]
