import { authorizer } from "@openauthjs/openauth"
import { MemoryStorage } from "@openauthjs/openauth/storage/memory"
import { CodeAdapter } from "@openauthjs/openauth/adapter/code"
import { subjects } from "../../../subjects.js"

export default authorizer({
  subjects,
  storage: MemoryStorage({
    persist: "./persist.json",
  }),
  providers: {
    code: CodeAdapter({
      sendCode: async (claims, code) => {
        console.log(claims.email, code)
      },
      async request(req, state, _form, error) {
        const url = new URL(`http://localhost:3001`)
        url.pathname = `/auth/${state.type}`
        if (error) url.searchParams.set("error", error.type)
        return new Response(null, {
          status: 302,
          headers: {
            Location: url.toString(),
          },
        })
      },
    }),
  },
  success: async (ctx, value) => {
    if (value.provider === "code") {
      return ctx.subject("user", {
        email: value.claims.email,
      })
    }
    throw new Error("Invalid provider")
  },
})
