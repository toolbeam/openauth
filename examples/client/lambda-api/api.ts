import { Context, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createClient } from "@openauthjs/core";
import { handle } from "hono/aws-lambda";
import { subjects } from "../../subjects";

const client = createClient({
  clientID: "lambda-api",
});

const app = new Hono()
  .get("/authorize", async (c) => {
    const origin = new URL(c.req.url).origin;
    return c.redirect(client.authorize(origin + "/callback", "code"), 302);
  })
  .get("/callback", async (c) => {
    const origin = new URL(c.req.url).origin;
    try {
      const code = c.req.query("code");
      if (!code) throw new Error("Missing code");
      const tokens = await client.exchange(code, origin + "/callback");
      setSession(c, tokens.access, tokens.refresh);
      return c.redirect("/", 302);
    } catch (e: any) {
      return new Response(e.toString());
    }
  })
  .get("/", async (c) => {
    const access = getCookie(c, "access_token");
    const refresh = getCookie(c, "refresh_token");
    try {
      const verified = await client.verify(subjects, access!, {
        refresh,
      });
      setSession(c, verified.access, verified.refresh);
      return c.json(verified.subject);
    } catch (e) {
      console.error(e);
      return c.redirect("/authorize", 302);
    }
  });

export const handler = handle(app);

function setSession(c: Context, accessToken?: string, refreshToken?: string) {
  if (accessToken) {
    setCookie(c, "access_token", accessToken, {
      httpOnly: true,
      sameSite: "Strict",
      path: "/",
      maxAge: 34560000,
    });
  }
  if (refreshToken) {
    setCookie(c, "refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "Strict",
      path: "/",
      maxAge: 34560000,
    });
  }
}
