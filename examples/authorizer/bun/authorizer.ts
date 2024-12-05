import { authorizer } from "@openauthjs/core";
import { MemoryStorage } from "@openauthjs/core/storage/memory";
import { PasswordAdapter } from "@openauthjs/core/adapter/password";
import { PasswordUI } from "@openauthjs/core/ui/password";
import { subjects } from "../../subjects.js";

export default authorizer({
  subjects,
  storage: MemoryStorage({
    persist: "./persist.json",
  }),
  providers: {
    password: PasswordAdapter(
      PasswordUI({
        sendCode: async (email, code) => {
          console.log(email, code);
        },
      })
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
});
