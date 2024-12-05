import { createClient } from "@openauthjs/core";
import type { APIContext } from "astro";
export { subjects } from "../../../subjects";

export const client = createClient({
  clientID: "astro",
  issuer: "http://localhost:3000",
});

export function setTokens(ctx: APIContext, access: string, refresh: string) {
  ctx.cookies.set("refresh_token", refresh, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 34560000,
  });
  ctx.cookies.set("access_token", access, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 34560000,
  });
}
