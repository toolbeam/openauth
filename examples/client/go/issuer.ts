import { handle } from "hono/aws-lambda"
import { issuer } from "@openauthjs/openauth/issuer"
import { CodeProvider } from "@openauthjs/openauth/provider/code"
import { CodeUI } from "@openauthjs/openauth/ui/code"
import { subjects } from "./subjects"

async function getUser(email: string) {
  // Get user from database
  // Return user ID
  return "123"
}

const app = issuer({
  subjects,
  providers: {
    code: CodeProvider(
      CodeUI({
        async sendCode(claims, code) {
          console.log("sendCode", claims, code)
        },
      }),
    ),
  },
  success: async (ctx, value) => {
    if (value.provider === "code") {
      const id = await getUser(value.claims.email)
      return ctx.subject("user", id, { id })
    }
    throw new Error("Invalid provider")
  },
})

// @ts-ignore
export const handler = handle(app)
