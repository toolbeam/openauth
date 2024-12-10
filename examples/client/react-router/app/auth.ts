import { createClient } from "@openauthjs/openauth";
import { createCookie } from "react-router";
import { subjects } from "../../../subjects";

export { subjects }

export const client = createClient({
  clientID: "react-router",
  issuer: "http://localhost:3000",
});

const refreshTokenCookie = createCookie("refresh_token", {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  maxAge: 34_560_000,
})

const accessTokenCookie = createCookie("access_token", {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  maxAge: 34_560_000,
})

export async function setTokens(access: string, refresh: string, headers?: Headers) {
  headers ??= new Headers()
  headers.append('Set-Cookie', await refreshTokenCookie.serialize(refresh))
  headers.append('Set-Cookie', await accessTokenCookie.serialize(access))
  return headers
}

export async function clearTokens(headers?: Headers) {
  headers ??= new Headers()
  headers.append('Set-Cookie', await refreshTokenCookie.serialize("", { maxAge: 0 }))
  headers.append('Set-Cookie', await accessTokenCookie.serialize("", { maxAge: 0 }))
  return headers
}

export async function login(request: Request) {
  const url = new URL(request.url);
  return Response.redirect(
    client.authorize(url.origin + "/callback", "code"),
    302
  );
}

export async function logout() {
  const headers = await clearTokens()
  headers.set('Location', '/')
  return new Response("/", {
    status: 302,
    headers
  })
}

/**
 * Checks if the user is authenticated.
 * If so, returns the subject along with updated tokens, otherwise `null`.
 */
export async function tryAuth(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  try {
    const accessToken = await accessTokenCookie.parse(cookieHeader);
    if (!accessToken) return null
    const refreshToken = await refreshTokenCookie.parse(cookieHeader);
    const verified = await client.verify(subjects, accessToken, {
      refresh: refreshToken,
    });
    const headers = new Headers();
    if (verified.tokens) {
      setTokens(verified.tokens.access, verified.tokens.refresh, headers);
    }
    return {
      headers,
      subject: verified.subject
    };
  } catch {
    return null
  };
}

/**
* Requires the user to be authenticated.
* If so, returns the subject along with updated tokens, otherwise throws a redirect to login.
 */
export async function requireAuth(request: Request) {
  const auth = await tryAuth(request)
  if (!auth) {
    throw login(request)
  }
  return auth
}

