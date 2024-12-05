import { authorizer } from "@openauthjs/core";
import { CloudflareStorage } from "@openauthjs/core/storage/cloudflare";
import {
  type ExecutionContext,
  type KVNamespace,
} from "@cloudflare/workers-types";
import { subjects } from "../../subjects.js";
import { PasswordAdapter } from "@openauthjs/core/adapter/password";
import { PasswordUI } from "@openauthjs/core/ui/password";

interface Env {
  CloudflareAuthKV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return authorizer({
      storage: CloudflareStorage({
        namespace: env.CloudflareAuthKV,
      }),
      subjects,
      providers: {
        password: PasswordAdapter(
          PasswordUI({
            sendCode: async (email, code) => {
              console.log(email, code);
            },
          }),
        ),
      },
      success: async (ctx, value) => {
        if (value.provider === "password") {
          return ctx.subject("user", {
            email: value.email,
          });
        }
        throw new Error("Invalid provider");
      },
    }).fetch(request, env, ctx);
  },
};
