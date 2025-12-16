import { issuer } from "@openauthjs/openauth"
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare"
import { subjects } from "../../../subjects.js"
import { PasswordProvider } from "@openauthjs/openauth/provider/password"
import { PasswordUI } from "@openauthjs/openauth/ui/password"

async function getUser(email: string) {
  // Get user from database
  // Return user ID
  return "123"
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return issuer({
      storage: CloudflareStorage<KVNamespace>({
        namespace: env.CloudflareAuthKV,
      }),
      subjects,
      providers: {
        password: PasswordProvider(
          PasswordUI({
            sendCode: async (email, code) => {
              console.log(email, code)
            },
          }),
        ),
      },
      success: async (ctx, value) => {
        if (value.provider === "password") {
          return ctx.subject("user", {
            id: await getUser(value.email),
          })
        }
        throw new Error("Invalid provider")
      },
    }).fetch(request, env, ctx)
  },
}
