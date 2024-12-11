import { authorizer } from "@openauthjs/openauth";
import { SQLiteStorage } from "@openauthjs/openauth/storage/sqlite";
import { PasswordAdapter } from "@openauthjs/openauth/adapter/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { subjects } from "../../subjects.js";

const storage = SQLiteStorage({ persist: "storage.db" });

export default authorizer({
  subjects,
  storage,
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
