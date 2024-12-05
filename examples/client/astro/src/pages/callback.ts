import type { APIRoute } from "astro";
import { client, setTokens } from "../auth";

export const GET: APIRoute = async (ctx) => {
  const code = ctx.url.searchParams.get("code");
  try {
    const tokens = await client.exchange(code!, ctx.url.origin + "/callback");
    setTokens(ctx, tokens.access, tokens.refresh);
    return ctx.redirect("/", 302);
  } catch (e) {
    return Response.json(e, {
      status: 400,
    });
  }
};
