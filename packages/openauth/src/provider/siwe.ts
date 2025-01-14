import { generateSiweNonce, parseSiweMessage } from "viem/siwe"
import { Provider } from "./provider.js"
import { PublicClient } from "viem"
import { isDomainMatch } from "../util.js"

export interface SiweConfig {
  signin(request: Request, nonce: string): Promise<Response>
  client: PublicClient
}

interface SiweBody {
  signature?: `0x${string}`
  message?: string
  nonce?: number
}

export function SiweProvider(
  config: SiweConfig,
): Provider<{ address: `0x${string}` }> {
  return {
    type: "siwe",
    init(routes, ctx) {
      routes.get("/authorize", async (c) => {
        const nonce = generateSiweNonce()
        await ctx.set(c, "nonce", 60 * 10, nonce)
        return ctx.forward(c, await config.signin(c.req.raw, nonce))
      })

      routes.post("/authorize", async (c) => {
        const body = (await c.req.json()) as SiweBody | undefined
        if (!body || !body.signature || !body.message) {
          throw new Error("Invalid body")
        }
        let nonce = (await ctx.get(c, "nonce")) as string | undefined
        if (!nonce) {
          if (!body.nonce) {
            throw new Error("Missing nonce")
          }
          if (body.nonce < Date.now() - 60 * 10 * 1000) {
            throw new Error("Expired nonce")
          }
          nonce = body.nonce.toString()
        }
        const {
          domain,
          nonce: messageNonce,
          address,
          uri,
        } = parseSiweMessage(body.message)
        if (messageNonce !== nonce) {
          throw new Error("Invalid nonce")
        }
        if (!domain || !uri || !address) {
          throw new Error("Invalid message")
        }
        const url = new URL(c.req.url)
        const host = c.req.header("x-forwarded-host") || url.host
        if (!isDomainMatch(domain, host)) {
          throw new Error("Invalid domain")
        }
        if (!url.href.startsWith(uri)) {
          throw new Error("Invalid uri")
        }
        const valid = await config.client.verifySiweMessage({
          message: body.message,
          signature: body.signature,
        })
        if (!valid) {
          throw new Error("Invalid signature")
        }
        return await ctx.success(c, { address })
      })
    },
  }
}
