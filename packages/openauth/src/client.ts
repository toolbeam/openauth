/**
 * Use the OpenAuth client kick off your OAuth flows, exchange tokens, refresh tokens,
 * and verify tokens.
 *
 * First, create a client.
 *
 * ```ts title="client.ts"
 * import { createClient } from "@openauthjs/openauth/client"
 *
 * const client = createClient({
 *   clientID: "my-client",
 *   issuer: "https://auth.myserver.com"
 * })
 * ```
 *
 * Kick off the OAuth flow by calling `authorize`.
 *
 * ```ts
 * const redirect_uri = "https://myserver.com/callback"
 *
 * const { url } = await client.authorize(
 *   redirect_uri,
 *   "code"
 * )
 * ```
 *
 * When the user completes the flow, `exchange` the code for tokens.
 *
 * ```ts
 * const tokens = await client.exchange(query.get("code"), redirect_uri)
 * ```
 *
 * And `verify` the tokens.
 *
 * ```ts
 * const verified = await client.verify(subjects, tokens.access)
 * ```
 *
 * @packageDocumentation
 */
import {
  createLocalJWKSet,
  errors,
  JSONWebKeySet,
  jwtVerify,
  decodeJwt,
} from "jose"
import { SubjectSchema } from "./subject.js"
import type { v1 } from "@standard-schema/spec"
import {
  InvalidAccessTokenError,
  InvalidAuthorizationCodeError,
  InvalidRefreshTokenError,
  InvalidSubjectError,
} from "./error.js"
import { generatePKCE } from "./pkce.js"

/**
 * The well-known information for an OAuth 2.0 authorization server.
 * @internal
 */
export interface WellKnown {
  /**
   * The URI to the JWKS endpoint.
   */
  jwks_uri: string
  /**
   * The URI to the token endpoint.
   */
  token_endpoint: string
  /**
   * The URI to the authorization endpoint.
   */
  authorization_endpoint: string
}

/**
 * The tokens returned by the auth server.
 */
export interface Tokens {
  /**
   * The access token.
   */
  access: string
  /**
   * The refresh token.
   */
  refresh: string

  /**
   * The number of seconds until the access token expires.
   */
  expiresIn: number
}

interface ResponseLike {
  json(): Promise<unknown>
  ok: Response["ok"]
}
type FetchLike = (...args: any[]) => Promise<ResponseLike>

/**
 * The challenge that you can use to verify the code.
 */
export type Challenge = {
  /**
   * The state that was sent to the redirect URI.
   */
  state: string
  /**
   * The verifier that was sent to the redirect URI.
   */
  verifier?: string
}

/**
 * Configure the client.
 */
export interface ClientInput<S extends SubjectSchema = SubjectSchema> {
  /**
   * The client ID. This is just a string to identify your app.
   *
   * If you have a web app and a mobile app, you want to use different client IDs both.
   *
   * @example
   * ```ts
   * {
   *   clientID: "my-client"
   * }
   * ```
   */
  clientID: string
  /**
   * The URL of your OpenAuth server.
   *
   * @example
   * ```ts
   * {
   *   issuer: "https://auth.myserver.com"
   * }
   * ```
   */
  issuer?: string

  /**
   * Optionally specify the subjects that are used by the issuer.
   */
  subjects?: S

  /**
   * Optionally, override the internally used fetch function.
   *
   * This is useful if you are using a polyfilled fetch function in your application and you
   * want the client to use it too.
   */
  fetch?: FetchLike
}

export interface AuthorizeOptions {
  /**
   * Enable the PKCE flow. This is for SPA apps.
   *
   * ```ts
   * {
   *   pkce: true
   * }
   * ```
   *
   * @default false
   */
  pkce?: boolean
  /**
   * The provider you want to use for the OAuth flow.
   *
   * ```ts
   * {
   *   provider: "google"
   * }
   * ```
   *
   * If no provider is specified, the user is directed to a page where they can select from the
   * list of configured providers.
   *
   * If there's only one provider configured, the user will be redirected to that.
   */
  provider?: string
}

export interface AuthorizeResult {
  /**
   * The challenge that you can use to verify the code. This is for the PKCE flow for SPA apps.
   *
   * This is an object that you _stringify_ and store it in session storage.
   *
   * ```ts
   * sessionStorage.setItem("challenge", JSON.stringify(challenge))
   * ```
   */
  challenge: Challenge
  /**
   * The URL to redirect the user to. This starts the OAuth flow.
   *
   * For example, for SPA apps.
   *
   * ```ts
   * location.href = url
   * ```
   */
  url: string
}

/**
 * Returned when the exchange is successful.
 */
export interface ExchangeSuccess {
  /**
   * This is always `false` when the exchange is successful.
   */
  err: false
  /**
   * The access and refresh tokens.
   */
  tokens: Tokens
}

/**
 * Returned when the exchange fails.
 */
export interface ExchangeError {
  /**
   * The type of error that occurred. You can handle this by checking the type.
   *
   * @example
   * ```ts
   * import { InvalidAuthorizationCodeError } from "@openauthjs/openauth/error"
   *
   * console.log(err instanceof InvalidAuthorizationCodeError)
   *```
   */
  err: InvalidAuthorizationCodeError
}

export interface RefreshOptions {
  /**
   * Optionally, pass in the access token.
   */
  access?: string
}

/**
 * Returned when the refresh is successful.
 */
export interface RefreshSuccess {
  /**
   * This is always `false` when the refresh is successful.
   */
  err: false
  /**
   * Returns the refreshed tokens only if they've been refreshed.
   *
   * If they are still valid, this will be `undefined`.
   */
  tokens?: Tokens
}

/**
 * Returned when the refresh fails.
 */
export interface RefreshError {
  /**
   * The type of error that occurred. You can handle this by checking the type.
   *
   * @example
   * ```ts
   * import { InvalidRefreshTokenError } from "@openauthjs/openauth/error"
   *
   * console.log(err instanceof InvalidRefreshTokenError)
   *```
   */
  err: InvalidRefreshTokenError | InvalidAccessTokenError
}

export interface VerifyOptions {
  /**
   * Optionally, pass in the refresh token.
   *
   * If passed in, this will automatically refresh the access token if it has expired.
   */
  refresh?: string
  /**
   * @internal
   */
  issuer?: string
  /**
   * @internal
   */
  audience?: string
  /**
   * Optionally, override the internally used fetch function.
   *
   * This is useful if you are using a polyfilled fetch function in your application and you
   * want the client to use it too.
   */
  fetch?: FetchLike
}

export interface VerifyResult<T extends SubjectSchema> {
  /**
   * This is always `undefined` when the verify is successful.
   */
  err?: undefined
  /**
   * Returns the refreshed tokens only if they’ve been refreshed.
   *
   * If they are still valid, this will be undefined.
   */
  tokens?: Tokens
  /**
   * @internal
   */
  aud: string
  /**
   * The decoded subjects from the access token.
   *
   * Has the same shape as the subjects you defined when creating the issuer.
   */
  subject: {
    [type in keyof T]: {
      id: string
      type: type
      properties: v1.InferOutput<T[type]>
    }
  }[keyof T]
}

/**
 * Returned when the verify call fails.
 */
export interface VerifyError {
  /**
   * The type of error that occurred. You can handle this by checking the type.
   *
   * @example
   * ```ts
   * import { InvalidRefreshTokenError } from "@openauthjs/openauth/error"
   *
   * console.log(err instanceof InvalidRefreshTokenError)
   *```
   */
  err: InvalidRefreshTokenError | InvalidAccessTokenError
}

/**
 * An instance of the OpenAuth client contains the following methods.
 */
export interface Client<S extends SubjectSchema> {
  /**
   * Start the autorization flow. For example, in SSR sites.
   *
   * ```ts
   * const { url } = await client.authorize(<redirect_uri>, "code")
   * ```
   *
   * This takes a redirect URI and the type of flow you want to use. The redirect URI is the
   * location where the user will be redirected to after the flow is complete.
   *
   * Supports both the _code_ and _token_ flows. We recommend using the _code_ flow as it's more
   * secure.
   *
   * :::tip
   * This returns a URL to redirect the user to. This starts the OAuth flow.
   * :::
   *
   * This returns a URL to the auth server. You can redirect the user to the URL to start the
   * OAuth flow.
   *
   * For SPA apps, we recommend using the PKCE flow.
   *
   * ```ts {4}
   * const { challenge, url } = await client.authorize(
   *   <redirect_uri>,
   *   "code",
   *   { pkce: true }
   * )
   * ```
   *
   * This returns a redirect URL and a challenge that you need to use later to verify the code.
   */
  authorize(
    redirectURI: string,
    response: "code" | "token",
    opts?: AuthorizeOptions,
  ): Promise<AuthorizeResult>
  /**
   * Exchange the code for access and refresh tokens.
   *
   * ```ts
   * const exchanged = await client.exchange(<code>, <redirect_uri>)
   * ```
   *
   * You call this after the user has been redirected back to your app after the OAuth flow.
   *
   * :::tip
   * For SSR sites, the code is returned in the query parameter.
   * :::
   *
   * So the code comes from the query parameter in the redirect URI. The redirect URI here is
   * the one that you passed in to the `authorize` call when starting the flow.
   *
   * :::tip
   * For SPA sites, the code is returned through the URL hash.
   * :::
   *
   * If you used the PKCE flow for an SPA app, the code is returned as a part of the redirect URL
   * hash.
   *
   * ```ts {4}
   * const exchanged = await client.exchange(
   *   <code>,
   *   <redirect_uri>,
   *   <challenge.verifier>
   * )
   * ```
   *
   * You also need to pass in the previously stored challenge verifier.
   *
   * This method returns the access and refresh tokens. Or if it fails, it returns an error that
   * you can handle depending on the error.
   *
   * ```ts
   * import { InvalidAuthorizationCodeError } from "@openauthjs/openauth/error"
   *
   * if (exchanged.err) {
   *   if (exchanged.err instanceof InvalidAuthorizationCodeError) {
   *     // handle invalid code error
   *   }
   *   else {
   *     // handle other errors
   *   }
   * }
   *
   * const { access, refresh } = exchanged.tokens
   * ```
   */
  exchange(
    code: string,
    redirectURI: string,
    verifier?: string,
  ): Promise<ExchangeSuccess | ExchangeError>
  /**
   * Refreshes the tokens if they have expired. This is used in an SPA app to maintain the
   * session, without logging the user out.
   *
   * ```ts
   * const next = await client.refresh(<refresh_token>)
   * ```
   *
   * Can optionally take the access token as well. If passed in, this will skip the refresh
   * if the access token is still valid.
   *
   * ```ts
   * const next = await client.refresh(<refresh_token>, { access: <access_token> })
   * ```
   *
   * This returns the refreshed tokens only if they've been refreshed.
   *
   * ```ts
   * if (!next.err) {
   *   // tokens are still valid
   * }
   * if (next.tokens) {
   *   const { access, refresh } = next.tokens
   * }
   * ```
   *
   * Or if it fails, it returns an error that you can handle depending on the error.
   *
   * ```ts
   * import { InvalidRefreshTokenError } from "@openauthjs/openauth/error"
   *
   * if (next.err) {
   *   if (next.err instanceof InvalidRefreshTokenError) {
   *     // handle invalid refresh token error
   *   }
   *   else {
   *     // handle other errors
   *   }
   * }
   * ```
   */
  refresh(
    refresh: string,
    opts?: RefreshOptions,
  ): Promise<RefreshSuccess | RefreshError>
  /**
   * Verify the token in the incoming request.
   *
   * This is typically used for SSR sites where the token is stored in an HTTP only cookie. And
   * is passed to the server on every request.
   *
   * ```ts
   * const verified = await client.verify(<subjects>, <token>)
   * ```
   *
   * This takes the subjects that you had previously defined when creating the issuer.
   *
   * :::tip
   * If the refresh token is passed in, it'll automatically refresh the access token.
   * :::
   *
   * This can optionally take the refresh token as well. If passed in, it'll automatically
   * refresh the access token if it has expired.
   *
   * ```ts
   * const verified = await client.verify(<subjects>, <token>, { refresh: <refresh_token> })
   * ```
   *
   * This returns the decoded subjects from the access token. And the tokens if they've been
   * refreshed.
   *
   * ```ts
   * // based on the subjects you defined earlier
   * console.log(verified.subject.properties.userID)
   *
   * if (verified.tokens) {
   *   const { access, refresh } = verified.tokens
   * }
   * ```
   *
   * Or if it fails, it returns an error that you can handle depending on the error.
   *
   * ```ts
   * import { InvalidRefreshTokenError } from "@openauthjs/openauth/error"
   *
   * if (verified.err) {
   *   if (verified.err instanceof InvalidRefreshTokenError) {
   *     // handle invalid refresh token error
   *   }
   *   else {
   *     // handle other errors
   *   }
   * }
   * ```
   */
  verify(
    token: string,
    options?: VerifyOptions,
  ): Promise<VerifyResult<S> | VerifyError>

  /**
   * Decode a JWT token without verifying its signature.
   *
   * ```ts
   * const decoded = client.decode(token, subjects)
   * ```
   *
   * This returns the decoded token's subject if successful.
   *
   * ```ts
   * if (!decoded.err) {
   *   console.log(decoded.subject.properties)
   * }
   * ```
   *
   * Or if it fails, it returns an error.
   *
   * ```ts
   * if (decoded.err) {
   *   // handle error
   * }
   * ```
   */
  decode<T extends SubjectSchema>(
    token: string,
    subjects: T,
  ): DecodeSuccess<T> | DecodeError
}

/**
 * Create an OpenAuth client.
 *
 * @param input - Configure the client.
 */
/**
 * Returned when the decode is successful.
 */
export interface DecodeSuccess<T extends SubjectSchema> {
  /**
   * This is always `false` when the decode is successful.
   */
  err: false
  /**
   * The decoded subject from the token.
   */
  subject: {
    id: string
    type: keyof T
    properties: v1.InferOutput<T[keyof T]>
  }
}

/**
 * Returned when the decode fails.
 */
export interface DecodeError {
  /**
   * The type of error that occurred.
   */
  err: InvalidAccessTokenError
}

export function createClient<S extends SubjectSchema>(
  input: ClientInput<S>,
): Client<S> {
  const jwksCache = new Map<string, ReturnType<typeof createLocalJWKSet>>()
  const issuerCache = new Map<string, WellKnown>()
  const issuer = input.issuer || process.env.OPENAUTH_ISSUER
  if (!issuer) throw new Error("No issuer")
  const f = input.fetch ?? fetch

  async function getIssuer() {
    const cached = issuerCache.get(issuer!)
    if (cached) return cached
    const wellKnown = (await (f || fetch)(
      `${issuer}/.well-known/oauth-authorization-server`,
    ).then((r) => r.json())) as WellKnown
    issuerCache.set(issuer!, wellKnown)
    return wellKnown
  }

  async function getJWKS() {
    const wk = await getIssuer()
    const cached = jwksCache.get(issuer!)
    if (cached) return cached
    const keyset = (await (f || fetch)(wk.jwks_uri).then((r) =>
      r.json(),
    )) as JSONWebKeySet
    const result = createLocalJWKSet(keyset)
    jwksCache.set(issuer!, result)
    return result
  }

  const result = {
    async authorize(
      redirectURI: string,
      response: "code" | "token",
      opts?: AuthorizeOptions,
    ) {
      const result = new URL(issuer + "/authorize")
      const challenge: Challenge = {
        state: crypto.randomUUID(),
      }
      result.searchParams.set("client_id", input.clientID)
      result.searchParams.set("redirect_uri", redirectURI)
      result.searchParams.set("response_type", response)
      result.searchParams.set("state", challenge.state)
      if (opts?.provider) result.searchParams.set("provider", opts.provider)
      if (opts?.pkce && response === "code") {
        const pkce = await generatePKCE()
        result.searchParams.set("code_challenge_method", "S256")
        result.searchParams.set("code_challenge", pkce.challenge)
        challenge.verifier = pkce.verifier
      }
      return {
        challenge,
        url: result.toString(),
      }
    },
    /**
     * @deprecated use `authorize` instead, it will do pkce by default unless disabled with `opts.pkce = false`
     */
    async pkce(
      redirectURI: string,
      opts?: {
        provider?: string
      },
    ) {
      const result = new URL(issuer + "/authorize")
      if (opts?.provider) result.searchParams.set("provider", opts.provider)
      result.searchParams.set("client_id", input.clientID)
      result.searchParams.set("redirect_uri", redirectURI)
      result.searchParams.set("response_type", "code")
      const pkce = await generatePKCE()
      result.searchParams.set("code_challenge_method", "S256")
      result.searchParams.set("code_challenge", pkce.challenge)
      return [pkce.verifier, result.toString()]
    },
    async exchange(
      code: string,
      redirectURI: string,
      verifier?: string,
    ): Promise<ExchangeSuccess | ExchangeError> {
      const tokens = await f(issuer + "/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          redirect_uri: redirectURI,
          grant_type: "authorization_code",
          client_id: input.clientID,
          code_verifier: verifier || "",
        }).toString(),
      })
      const json = (await tokens.json()) as any
      if (!tokens.ok) {
        return {
          err: new InvalidAuthorizationCodeError(),
        }
      }
      return {
        err: false,
        tokens: {
          access: json.access_token as string,
          refresh: json.refresh_token as string,
          expiresIn: json.expires_in as number,
        },
      }
    },
    async refresh(
      refresh: string,
      opts?: RefreshOptions,
    ): Promise<RefreshSuccess | RefreshError> {
      if (opts && opts.access) {
        const decoded = decodeJwt(opts.access)
        if (!decoded) {
          return {
            err: new InvalidAccessTokenError(),
          }
        }
        // allow 30s window for expiration
        if ((decoded.exp || 0) > Date.now() / 1000 + 30) {
          return {
            err: false,
          }
        }
      }
      const tokens = await f(issuer + "/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refresh,
        }).toString(),
      })
      const json = (await tokens.json()) as any
      if (!tokens.ok) {
        return {
          err: new InvalidRefreshTokenError(),
        }
      }
      return {
        err: false,
        tokens: {
          access: json.access_token as string,
          refresh: json.refresh_token as string,
          expiresIn: json.expires_in as number,
        },
      }
    },
    async verify<T extends SubjectSchema>(
      token: string,
      options?: VerifyOptions,
    ): Promise<VerifyResult<T> | VerifyError> {
      const jwks = await getJWKS()
      try {
        const result = await jwtVerify<{
          mode: "access"
          type: keyof T
          properties: v1.InferInput<T[keyof T]>
        }>(token, jwks, {
          issuer,
        })
        let properties = result.payload.properties
        if (input.subjects) {
          const schema = input.subjects[result.payload.type as keyof S]
          const validation = await schema["~standard"].validate(properties)
          if (validation.issues) {
            throw new InvalidSubjectError()
          }
          properties = validation.value
        }
        return {
          aud: result.payload.aud as string,
          subject: {
            id: result.payload.sub,
            type: result.payload.type,
            properties: properties,
          } as any,
        }
      } catch (e) {
        if (e instanceof errors.JWTExpired && options?.refresh) {
          const refreshed = await this.refresh(options.refresh)
          if (refreshed.err) return refreshed
          const verified = await result.verify(refreshed.tokens!.access, {
            refresh: refreshed.tokens!.refresh,
            issuer,
            fetch: options?.fetch,
          })
          if (verified.err) return verified
          verified.tokens = refreshed.tokens
          return verified
        }
        return {
          err: new InvalidAccessTokenError(),
        }
      }
    },

    decode<T extends SubjectSchema>(
      token: string,
      subjects: T,
    ): DecodeSuccess<T> | DecodeError {
      try {
        const payload = decodeJwt(token)
        if (
          !payload ||
          typeof payload.type !== "string" ||
          typeof payload.sub !== "string"
        ) {
          return { err: new InvalidAccessTokenError() }
        }

        const type = payload.type as keyof T
        if (!subjects[type]) {
          return { err: new InvalidAccessTokenError() }
        }

        return {
          err: false,
          subject: {
            id: payload.sub,
            type,
            properties: payload.properties as v1.InferOutput<T[keyof T]>,
          },
        }
      } catch (e) {
        return { err: new InvalidAccessTokenError() }
      }
    },
  }
  return result
}
