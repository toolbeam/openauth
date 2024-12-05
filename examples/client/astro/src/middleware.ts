import { defineMiddleware } from "astro:middleware";
import { subjects } from "../../../subjects";
import { client, setTokens } from "./auth";

export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.routePattern === "/callback") {
    return next();
  }

  try {
    const accessToken = ctx.cookies.get("access_token");
    if (accessToken) {
      const refreshToken = ctx.cookies.get("refresh_token");
      const verified = await client.verify(subjects, accessToken.value, {
        refresh: refreshToken?.value,
      });
      if (verified.tokens)
        setTokens(ctx, verified.tokens.access, verified.tokens.refresh);
      ctx.locals.subject = verified.subject;
      return next();
    }
  } catch (e) {}
  const url = new URL(ctx.request.url);
  return Response.redirect(
    client.authorize(url.origin + "/callback", "code"),
    302
  );

  return next();
});
