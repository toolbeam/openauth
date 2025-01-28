import type { OAuth2Tokens } from "arctic"
import { Context } from "hono"
import { Provider } from "./provider.js"
import { OauthError } from "../error.js"
import { getRelativeUrl } from "../util.js"

export interface ArcticProviderOptions {
  scopes: string[]
  clientID: string
  clientSecret: string
  query?: Record<string, string>
}

interface ProviderState {
  state: string
}

export function ArcticProvider(
  provider: new (
    clientID: string,
    clientSecret: string,
    callback: string,
  ) => {
    createAuthorizationURL(state: string, scopes: string[]): URL
    validateAuthorizationCode(code: string): Promise<OAuth2Tokens>
    refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens>
  },
  config: ArcticProviderOptions,
): Provider<{
  tokenset: OAuth2Tokens
}> {
  function getClient(c: Context) {
    const callback = new URL(c.req.url)
    const pathname = callback.pathname.replace(/authorize.*$/, "callback")
    const url = getRelativeUrl(c, pathname)
    return new provider(config.clientID, config.clientSecret, url)
  }
  return {
    type: "arctic",
    init(routes, ctx) {
      routes.get("/authorize", async (c) => {
        const client = getClient(c)
        const state = crypto.randomUUID()
        await ctx.set(c, "provider", 60 * 10, {
          state,
        })
        return c.redirect(client.createAuthorizationURL(state, config.scopes))
      })

      routes.get("/callback", async (c) => {
        const client = getClient(c)
        const provider = (await ctx.get(c, "provider")) as ProviderState
        if (!provider) return c.redirect("../authorize")
        const code = c.req.query("code")
        const state = c.req.query("state")
        if (!code) throw new Error("Missing code")
        if (state !== provider.state)
          throw new OauthError("invalid_request", "Invalid state")
        const tokens = await client.validateAuthorizationCode(code)
        return ctx.success(c, {
          tokenset: tokens,
        })
      })
    },
  }
}
