import type { Service } from "@cloudflare/workers-types";
import { createClient } from "@openauthjs/core";
import { subjects } from "../../subjects";

interface Env {
  OPENAUTH_ISSUER: string;
  Auth: Service;
  CloudflareAuth: Service;
}

export default {
  async fetch(request: Request, env: Env) {
    const client = createClient({
      clientID: "cloudflare-api",
      // enables worker to worker communication if authorizer is also a worker
      fetch: (input, init) => env.CloudflareAuth.fetch(input, init),
      issuer: env.OPENAUTH_ISSUER,
    });
    const url = new URL(request.url);
    const redirectURI = url.origin + "/callback";

    switch (url.pathname) {
      case "/callback":
        try {
          const code = url.searchParams.get("code")!;
          const tokens = await client.exchange(code, redirectURI);
          const response = new Response(null, { status: 302, headers: {} });
          response.headers.set("Location", url.origin);
          setSession(response, tokens.access, tokens.refresh);
          return response;
        } catch (e: any) {
          return new Response(e.toString());
        }
      case "/authorize":
        return Response.redirect(client.authorize(redirectURI, "code"), 302);
      case "/":
        const cookies = new URLSearchParams(
          request.headers.get("cookie")?.replaceAll("; ", "&"),
        );
        try {
          const verified = await client.verify(
            subjects,
            cookies.get("access_token")!,
            {
              refresh: cookies.get("refresh_token") || undefined,
            },
          );
          const resp = Response.json(verified.subject);
          setSession(resp, verified.access, verified.refresh);
          return resp;
        } catch (e) {
          console.error(e);
          return Response.redirect(url.origin + "/authorize", 302);
        }
      default:
        return new Response("Not found", { status: 404 });
    }
  },
};

function setSession(
  response: Response,
  accessToken?: string,
  refreshToken?: string,
) {
  if (accessToken) {
    response.headers.append(
      "Set-Cookie",
      `access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2147483647`,
    );
  }
  if (refreshToken) {
    response.headers.append(
      "Set-Cookie",
      `refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2147483647`,
    );
  }
}
