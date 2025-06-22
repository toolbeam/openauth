/**
 * The `issuer` create an OpentAuth server, a [Hono](https://hono.dev) app that's
 * designed to run anywhere.
 *
 * The `issuer` function requires a few things:
 *
 * ```ts title="issuer.ts"
 * import { issuer } from "@openauthjs/openauth"
 *
 * const app = issuer({
 *   providers: { ... },
 *   storage,
 *   subjects,
 *   success: async (ctx, value) => { ... }
 * })
 * ```
 *
 * #### Add providers
 *
 * You start by specifying the auth providers you are going to use. Let's say you want your users
 * to be able to authenticate with GitHub and with their email and password.
 *
 * ```ts title="issuer.ts"
 * import { GithubProvider } from "@openauthjs/openauth/provider/github"
 * import { PasswordProvider } from "@openauthjs/openauth/provider/password"
 *
 * const app = issuer({
 *   providers: {
 *     github: GithubProvider({
 *       // ...
 *     }),
 *     password: PasswordProvider({
 *       // ...
 *     }),
 *   },
 * })
 * ```
 *
 * #### Handle success
 *
 * The `success` callback receives the payload when a user completes a provider's auth flow.
 *
 * ```ts title="issuer.ts"
 * const app = issuer({
 *   providers: { ... },
 *   subjects,
 *   async success(ctx, value) {
 *     let userID
 *     if (value.provider === "password") {
 *       console.log(value.email)
 *       userID = ... // lookup user or create them
 *     }
 *     if (value.provider === "github") {
 *       console.log(value.tokenset.access)
 *       userID = ... // lookup user or create them
 *     }
 *     return ctx.subject("user", {
 *       userID
 *     })
 *   }
 * })
 * ```
 *
 * Once complete, the `issuer` issues the access tokens that a client can use. The `ctx.subject`
 * call is what is placed in the access token as a JWT.
 *
 * #### Define subjects
 *
 * You define the shape of these in the `subjects` field.
 *
 * ```ts title="subjects.ts"
 * import { object, string } from "valibot"
 * import { createSubjects } from "@openauthjs/openauth/subject"
 *
 * const subjects = createSubjects({
 *   user: object({
 *     userID: string()
 *   })
 * })
 * ```
 *
 * It's good to place this in a separate file since this'll be used in your client apps as well.
 *
 * ```ts title="issuer.ts"
 * import { subjects } from "./subjects.js"
 *
 * const app = issuer({
 *   providers: { ... },
 *   subjects,
 *   // ...
 * })
 * ```
 *
 * #### Deploy
 *
 * Since `issuer` is a Hono app, you can deploy it anywhere Hono supports.
 *
 * <Tabs>
 *   <TabItem label="Node">
 *   ```ts title="issuer.ts"
 *   import { serve } from "@hono/node-server"
 *
 *   serve(app)
 *   ```
 *   </TabItem>
 *   <TabItem label="Lambda">
 *   ```ts title="issuer.ts"
 *   import { handle } from "hono/aws-lambda"
 *
 *   export const handler = handle(app)
 *   ```
 *   </TabItem>
 *   <TabItem label="Bun">
 *   ```ts title="issuer.ts"
 *   export default app
 *   ```
 *   </TabItem>
 *   <TabItem label="Workers">
 *   ```ts title="issuer.ts"
 *   export default app
 *   ```
 *   </TabItem>
 * </Tabs>
 *
 * @packageDocumentation
 */
import { Provider, ProviderOptions } from "./provider/provider.js"
import { SubjectPayload, SubjectSchema } from "./subject.js"
import { Hono } from "hono/tiny"
import { handle as awsHandle } from "hono/aws-lambda"
import { Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import type { v1 } from "@standard-schema/spec"

/**
 * Sets the subject payload in the JWT token and returns the response.
 *
 * ```ts
 * ctx.subject("user", {
 *   userID
 * })
 * ```
 */
export interface OnSuccessResponder<
  T extends { type: string; properties: any },
> {
  /**
   * The `type` is the type of the subject, that was defined in the `subjects` field.
   *
   * The `properties` are the properties of the subject. This is the shape of the subject that
   * you defined in the `subjects` field.
   */
  subject<Type extends T["type"]>(
    type: Type,
    properties: Extract<T, { type: Type }>["properties"],
    opts?: {
      ttl?: {
        access?: number
        refresh?: number
      }
      subject?: string
    },
  ): Promise<Response>
}

/**
 * @internal
 */
export interface AuthorizationState {
  redirect_uri: string
  response_type: string
  state: string
  client_id: string
  audience?: string
  pkce?: {
    challenge: string
    method: "S256"
  }
}

/**
 * @internal
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

import {
  MissingParameterError,
  OauthError,
  UnauthorizedClientError,
  UnknownStateError,
} from "./error.js"
import { compactDecrypt, CompactEncrypt, jwtVerify, SignJWT } from "jose"
import { Storage, StorageAdapter } from "./storage/storage.js"
import { encryptionKeys, legacySigningKeys, signingKeys } from "./keys.js"
import { validatePKCE } from "./pkce.js"
import { Select } from "./ui/select.js"
import { setTheme, Theme } from "./ui/theme.js"
import { getRelativeUrl, isDomainMatch, lazy } from "./util.js"
import { DynamoStorage } from "./storage/dynamo.js"
import { MemoryStorage } from "./storage/memory.js"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

/** @internal */
export const aws = awsHandle

export interface IssuerInput<
  Providers extends Record<string, Provider<any>>,
  Subjects extends SubjectSchema,
  Result = {
    [key in keyof Providers]: Prettify<
      {
        provider: key
      } & (Providers[key] extends Provider<infer T> ? T : {})
    >
  }[keyof Providers],
> {
  /**
   * The shape of the subjects that you want to return.
   *
   * @example
   *
   * ```ts title="issuer.ts"
   * import { object, string } from "valibot"
   * import { createSubjects } from "@openauthjs/openauth/subject"
   *
   * issuer({
   *   subjects: createSubjects({
   *     user: object({
   *       userID: string()
   *     })
   *   })
   *   // ...
   * })
   * ```
   */
  subjects: Subjects
  /**
   * The storage adapter that you want to use.
   *
   * @example
   * ```ts title="issuer.ts"
   * import { DynamoStorage } from "@openauthjs/openauth/storage/dynamo"
   *
   * issuer({
   *   storage: DynamoStorage()
   *   // ...
   * })
   * ```
   */
  storage?: StorageAdapter
  /**
   * The providers that you want your OpenAuth server to support.
   *
   * @example
   *
   * ```ts title="issuer.ts"
   * import { GithubProvider } from "@openauthjs/openauth/provider/github"
   *
   * issuer({
   *   providers: {
   *     github: GithubProvider()
   *   }
   * })
   * ```
   *
   * The key is just a string that you can use to identify the provider. It's passed back to
   * the `success` callback.
   *
   * You can also specify multiple providers.
   *
   * ```ts
   * {
   *   providers: {
   *     github: GithubProvider(),
   *     google: GoogleProvider()
   *   }
   * }
   * ```
   */
  providers: Providers
  /**
   * The theme you want to use for the UI.
   *
   * This includes the UI the user sees when selecting a provider. And the `PasswordUI` and
   * `CodeUI` that are used by the `PasswordProvider` and `CodeProvider`.
   *
   * @example
   * ```ts title="issuer.ts"
   * import { THEME_SST } from "@openauthjs/openauth/ui/theme"
   *
   * issuer({
   *   theme: THEME_SST
   *   // ...
   * })
   * ```
   *
   * Or define your own.
   *
   * ```ts title="issuer.ts"
   * import type { Theme } from "@openauthjs/openauth/ui/theme"
   *
   * const MY_THEME: Theme = {
   *   // ...
   * }
   *
   * issuer({
   *   theme: MY_THEME
   *   // ...
   * })
   * ```
   */
  theme?: Theme
  /**
   * Set the TTL, in seconds, for access and refresh tokens.
   *
   * @example
   * ```ts
   * {
   *   ttl: {
   *     access: 60 * 60 * 24 * 30,
   *     refresh: 60 * 60 * 24 * 365
   *   }
   * }
   * ```
   */
  ttl?: {
    /**
     * Interval in seconds where the access token is valid.
     * @default 30d
     */
    access?: number
    /**
     * Interval in seconds where the refresh token is valid.
     * @default 1y
     */
    refresh?: number
    /**
     * Interval in seconds where refresh token reuse is allowed. This helps mitigrate
     * concurrency issues.
     * @default 60s
     */
    reuse?: number
    /**
     * Interval in seconds to retain refresh tokens for reuse detection.
     * @default 0s
     */
    retention?: number
  }
  /**
   * Optionally, configure the UI that's displayed when the user visits the root URL of the
   * of the OpenAuth server.
   *
   * ```ts title="issuer.ts"
   * import { Select } from "@openauthjs/openauth/ui/select"
   *
   * issuer({
   *   select: Select({
   *     providers: {
   *       github: { hide: true },
   *       google: { display: "Google" }
   *     }
   *   })
   *   // ...
   * })
   * ```
   *
   * @default Select()
   */
  select?(providers: Record<string, string>, req: Request): Promise<Response>
  /**
   * @internal
   */
  start?(req: Request): Promise<void>
  /**
   * The success callback that's called when the user completes the flow.
   *
   * This is called after the user has been redirected back to your app after the OAuth flow.
   *
   * @example
   * ```ts
   * {
   *   success: async (ctx, value) => {
   *     let userID
   *     if (value.provider === "password") {
   *       console.log(value.email)
   *       userID = ... // lookup user or create them
   *     }
   *     if (value.provider === "github") {
   *       console.log(value.tokenset.access)
   *       userID = ... // lookup user or create them
   *     }
   *     return ctx.subject("user", {
   *       userID
   *     })
   *   },
   *   // ...
   * }
   * ```
   */
  success(
    response: OnSuccessResponder<SubjectPayload<Subjects>>,
    input: Result,
    req: Request,
  ): Promise<Response>
  /**
   * @internal
   */
  error?(error: UnknownStateError, req: Request): Promise<Response>
  /**
   * Override the logic for whether a client request is allowed to call the issuer.
   *
   * By default, it uses the following:
   *
   * - Allow if the `redirectURI` is localhost.
   * - Compare `redirectURI` to the request's hostname or the `x-forwarded-host` header. If they
   *   are from the same sub-domain level, then allow.
   *
   * @example
   * ```ts
   * {
   *   allow: async (input, req) => {
   *     // Allow all clients
   *     return true
   *   }
   * }
   * ```
   */
  allow?(
    input: {
      clientID: string
      redirectURI: string
      audience?: string
    },
    req: Request,
  ): Promise<boolean>
}

/**
 * Create an OpenAuth server, a Hono app.
 */
export function issuer<
  Providers extends Record<string, Provider<any>>,
  Subjects extends SubjectSchema,
  Result = {
    [key in keyof Providers]: Prettify<
      {
        provider: key
      } & (Providers[key] extends Provider<infer T> ? T : {})
    >
  }[keyof Providers],
>(input: IssuerInput<Providers, Subjects, Result>) {
  const error =
    input.error ??
    function (err) {
      return new Response(err.message, {
        status: 400,
        headers: {
          "Content-Type": "text/plain",
        },
      })
    }
  const ttlAccess = input.ttl?.access ?? 60 * 60 * 24 * 30
  const ttlRefresh = input.ttl?.refresh ?? 60 * 60 * 24 * 365
  const ttlRefreshReuse = input.ttl?.reuse ?? 60
  const ttlRefreshRetention = input.ttl?.retention ?? 0
  if (input.theme) {
    setTheme(input.theme)
  }

  const select = lazy(() => input.select ?? Select())
  const allow = lazy(
    () =>
      input.allow ??
      (async (input: any, req: Request) => {
        const redir = new URL(input.redirectURI).hostname
        if (redir === "localhost" || redir === "127.0.0.1") {
          return true
        }
        const forwarded = req.headers.get("x-forwarded-host")
        const host = forwarded
          ? new URL(`https://${forwarded}`).hostname
          : new URL(req.url).hostname

        return isDomainMatch(redir, host)
      }),
  )

  let storage = input.storage
  if (process.env.OPENAUTH_STORAGE) {
    const parsed = JSON.parse(process.env.OPENAUTH_STORAGE)
    if (parsed.type === "dynamo") storage = DynamoStorage(parsed.options)
    if (parsed.type === "memory") storage = MemoryStorage()
    if (parsed.type === "cloudflare")
      throw new Error(
        "Cloudflare storage cannot be configured through env because it requires bindings.",
      )
  }
  if (!storage)
    throw new Error(
      "Store is not configured. Either set the `storage` option or set `OPENAUTH_STORAGE` environment variable.",
    )
  const allSigning = lazy(() =>
    Promise.all([signingKeys(storage), legacySigningKeys(storage)]).then(
      ([a, b]) => [...a, ...b],
    ),
  )
  const allEncryption = lazy(() => encryptionKeys(storage))
  const signingKey = lazy(() => allSigning().then((all) => all[0]))
  const encryptionKey = lazy(() => allEncryption().then((all) => all[0]))

  const auth: Omit<ProviderOptions<any>, "name"> = {
    async success(ctx: Context, properties: any, successOpts) {
      return await input.success(
        {
          async subject(type, properties, subjectOpts) {
            const authorization = await getAuthorization(ctx)
            const subject = subjectOpts?.subject
              ? subjectOpts.subject
              : await resolveSubject(type, properties)
            await successOpts?.invalidate?.(
              await resolveSubject(type, properties),
            )
            if (authorization.response_type === "token") {
              const location = new URL(authorization.redirect_uri)
              const tokens = await generateTokens(ctx, {
                subject,
                type: type as string,
                properties,
                clientID: authorization.client_id,
                ttl: {
                  access: subjectOpts?.ttl?.access ?? ttlAccess,
                  refresh: subjectOpts?.ttl?.refresh ?? ttlRefresh,
                },
              })
              location.hash = new URLSearchParams({
                access_token: tokens.access,
                refresh_token: tokens.refresh,
                state: authorization.state || "",
              }).toString()
              await auth.unset(ctx, "authorization")
              return ctx.redirect(location.toString(), 302)
            }
            if (authorization.response_type === "code") {
              const code = crypto.randomUUID()
              await Storage.set(
                storage,
                ["oauth:code", code],
                {
                  type,
                  properties,
                  subject,
                  redirectURI: authorization.redirect_uri,
                  clientID: authorization.client_id,
                  pkce: authorization.pkce,
                  ttl: {
                    access: subjectOpts?.ttl?.access ?? ttlAccess,
                    refresh: subjectOpts?.ttl?.refresh ?? ttlRefresh,
                  },
                },
                60,
              )
              const location = new URL(authorization.redirect_uri)
              location.searchParams.set("code", code)
              location.searchParams.set("state", authorization.state || "")
              await auth.unset(ctx, "authorization")
              return ctx.redirect(location.toString(), 302)
            }
            throw new OauthError(
              "invalid_request",
              `Unsupported response_type: ${authorization.response_type}`,
            )
          },
        },
        {
          provider: ctx.get("provider"),
          ...properties,
        },
        ctx.req.raw,
      )
    },
    forward(ctx, response) {
      return ctx.newResponse(
        response.body,
        response.status as any,
        Object.fromEntries(response.headers.entries()),
      )
    },
    async set(ctx, key, maxAge, value) {
      setCookie(ctx, key, await encrypt(value), {
        maxAge,
        httpOnly: true,
        ...(ctx.req.url.startsWith("https://")
          ? { secure: true, sameSite: "None" }
          : {}),
      })
    },
    async get(ctx: Context, key: string) {
      const raw = getCookie(ctx, key)
      if (!raw) return
      return decrypt(raw).catch((ex) => {
        console.error("failed to decrypt", key, ex)
      })
    },
    async unset(ctx: Context, key: string) {
      deleteCookie(ctx, key)
    },
    async invalidate(subject: string) {
      // Resolve the scan in case modifications interfere with iteration
      const keys = await Array.fromAsync(
        Storage.scan(this.storage, ["oauth:refresh", subject]),
      )
      for (const [key] of keys) {
        await Storage.remove(this.storage, key)
      }
    },
    storage,
  }

  async function getAuthorization(ctx: Context) {
    const match =
      (await auth.get(ctx, "authorization")) || ctx.get("authorization")
    if (!match) throw new UnknownStateError()
    return match as AuthorizationState
  }

  async function encrypt(value: any) {
    return await new CompactEncrypt(
      new TextEncoder().encode(JSON.stringify(value)),
    )
      .setProtectedHeader({ alg: "RSA-OAEP-512", enc: "A256GCM" })
      .encrypt(await encryptionKey().then((k) => k.public))
  }

  async function resolveSubject(type: string, properties: any) {
    const jsonString = JSON.stringify(properties)
    const encoder = new TextEncoder()
    const data = encoder.encode(jsonString)
    const hashBuffer = await crypto.subtle.digest("SHA-1", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    return `${type}:${hashHex.slice(0, 16)}`
  }

  async function generateTokens(
    ctx: Context,
    value: {
      type: string
      properties: any
      subject: string
      clientID: string
      ttl: {
        access: number
        refresh: number
      }
      timeUsed?: number
      nextToken?: string
    },
    opts?: {
      generateRefreshToken?: boolean
    },
  ) {
    const refreshToken = value.nextToken ?? crypto.randomUUID()
    if (opts?.generateRefreshToken ?? true) {
      /**
       * Generate and store the next refresh token after the one we are currently returning.
       * Reserving these in advance avoids concurrency issues with multiple refreshes.
       * Similar treatment should be given to any other values that may have race conditions,
       * for example if a jti claim was added to the access token.
       */
      const refreshValue = {
        ...value,
        nextToken: crypto.randomUUID(),
      }
      delete refreshValue.timeUsed
      await Storage.set(
        storage!,
        ["oauth:refresh", value.subject, refreshToken],
        refreshValue,
        value.ttl.refresh,
      )
    }
    const accessTimeUsed = Math.floor((value.timeUsed ?? Date.now()) / 1000)
    return {
      access: await new SignJWT({
        mode: "access",
        type: value.type,
        properties: value.properties,
        aud: value.clientID,
        iss: issuer(ctx),
        sub: value.subject,
      })
        .setExpirationTime(Math.floor(accessTimeUsed + value.ttl.access))
        .setProtectedHeader(
          await signingKey().then((k) => ({
            alg: k.alg,
            kid: k.id,
            typ: "JWT",
          })),
        )
        .sign(await signingKey().then((item) => item.private)),
      expiresIn: Math.floor(
        accessTimeUsed + value.ttl.access - Date.now() / 1000,
      ),
      refresh: [value.subject, refreshToken].join(":"),
    }
  }

  async function decrypt(value: string) {
    return JSON.parse(
      new TextDecoder().decode(
        await compactDecrypt(
          value,
          await encryptionKey().then((v) => v.private),
        ).then((value) => value.plaintext),
      ),
    )
  }

  function issuer(ctx: Context) {
    return new URL(getRelativeUrl(ctx, "/")).origin
  }

  const app = new Hono<{
    Variables: {
      authorization: AuthorizationState
    }
  }>().use(logger())

  for (const [name, value] of Object.entries(input.providers)) {
    const route = new Hono<any>()
    route.use(async (c, next) => {
      c.set("provider", name)
      await next()
    })
    value.init(route, {
      name,
      ...auth,
    })
    app.route(`/${name}`, route)
  }

  app.get(
    "/.well-known/jwks.json",
    cors({
      origin: "*",
      allowHeaders: ["*"],
      allowMethods: ["GET"],
      credentials: false,
    }),
    async (c) => {
      const all = await allSigning()
      return c.json({
        keys: all.map((item) => ({
          ...item.jwk,
          alg: item.alg,
          exp: item.expired
            ? Math.floor(item.expired.getTime() / 1000)
            : undefined,
        })),
      })
    },
  )

  app.get(
    "/.well-known/oauth-authorization-server",
    cors({
      origin: "*",
      allowHeaders: ["*"],
      allowMethods: ["GET"],
      credentials: false,
    }),
    async (c) => {
      const iss = issuer(c)
      return c.json({
        issuer: iss,
        authorization_endpoint: `${iss}/authorize`,
        token_endpoint: `${iss}/token`,
        jwks_uri: `${iss}/.well-known/jwks.json`,
        response_types_supported: ["code", "token"],
      })
    },
  )

  app.post(
    "/token",
    cors({
      origin: "*",
      allowHeaders: ["*"],
      allowMethods: ["POST"],
      credentials: false,
    }),
    async (c) => {
      const form = await c.req.formData()
      const grantType = form.get("grant_type")

      if (grantType === "authorization_code") {
        const code = form.get("code")
        if (!code)
          return c.json(
            {
              error: "invalid_request",
              error_description: "Missing code",
            },
            400,
          )
        const key = ["oauth:code", code.toString()]
        const payload = await Storage.get<{
          type: string
          properties: any
          clientID: string
          redirectURI: string
          subject: string
          ttl: {
            access: number
            refresh: number
          }
          pkce?: AuthorizationState["pkce"]
        }>(storage, key)
        if (!payload) {
          return c.json(
            {
              error: "invalid_grant",
              error_description: "Authorization code has been used or expired",
            },
            400,
          )
        }
        if (payload.redirectURI !== form.get("redirect_uri")) {
          return c.json(
            {
              error: "invalid_redirect_uri",
              error_description: "Redirect URI mismatch",
            },
            400,
          )
        }
        if (payload.clientID !== form.get("client_id")) {
          return c.json(
            {
              error: "unauthorized_client",
              error_description:
                "Client is not authorized to use this authorization code",
            },
            403,
          )
        }

        if (payload.pkce) {
          const codeVerifier = form.get("code_verifier")?.toString()
          if (!codeVerifier)
            return c.json(
              {
                error: "invalid_grant",
                error_description: "Missing code_verifier",
              },
              400,
            )

          if (
            !(await validatePKCE(
              codeVerifier,
              payload.pkce.challenge,
              payload.pkce.method,
            ))
          ) {
            return c.json(
              {
                error: "invalid_grant",
                error_description: "Code verifier does not match",
              },
              400,
            )
          }
        }
        const tokens = await generateTokens(c, payload)
        await Storage.remove(storage, key)
        return c.json({
          access_token: tokens.access,
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refresh,
        })
      }

      if (grantType === "refresh_token") {
        const refreshToken = form.get("refresh_token")
        if (!refreshToken)
          return c.json(
            {
              error: "invalid_request",
              error_description: "Missing refresh_token",
            },
            400,
          )
        const splits = refreshToken.toString().split(":")
        const token = splits.pop()!
        const subject = splits.join(":")
        const key = ["oauth:refresh", subject, token]
        const payload = await Storage.get<{
          type: string
          properties: any
          clientID: string
          subject: string
          ttl: {
            access: number
            refresh: number
          }
          nextToken: string
          timeUsed?: number
        }>(storage, key)
        if (!payload) {
          return c.json(
            {
              error: "invalid_grant",
              error_description: "Refresh token has been used or expired",
            },
            400,
          )
        }
        const generateRefreshToken = !payload.timeUsed
        if (ttlRefreshReuse <= 0) {
          // no reuse interval, remove the refresh token immediately
          await Storage.remove(storage, key)
        } else if (!payload.timeUsed) {
          payload.timeUsed = Date.now()
          await Storage.set(
            storage,
            key,
            payload,
            ttlRefreshReuse + ttlRefreshRetention,
          )
        } else if (Date.now() > payload.timeUsed + ttlRefreshReuse * 1000) {
          // token was reused past the allowed interval
          await auth.invalidate(subject)
          return c.json(
            {
              error: "invalid_grant",
              error_description: "Refresh token has been used or expired",
            },
            400,
          )
        }
        const tokens = await generateTokens(c, payload, {
          generateRefreshToken,
        })
        return c.json({
          access_token: tokens.access,
          refresh_token: tokens.refresh,
          expires_in: tokens.expiresIn,
        })
      }

      if (grantType === "client_credentials") {
        const provider = form.get("provider")?.toString(); 
        if (!provider)
          return c.json({ error: "missing `provider` form value" }, 400)
        const match = input.providers[provider];
        if (!match) {
          return c.json(
            { error: "invalid_request", error_description: `Invalid provider: ${provider}` },
            400,
          );
        }
        if (!match.client) {
          return c.json(
            { error: "unsupported_grant_type", error_description: `Provider "${provider}" does not support client_credentials` },
            400,
          );
        }

        const clientID = form.get("client_id")?.toString();
        const clientSecret = form.get("client_secret")?.toString();

        if (!clientID) {
          return c.json({ error: "missing `client_id` form value" }, 400)
        }

        try {
          const response = await match.client({
            clientID: clientID, 
            clientSecret: clientSecret,
            params: Object.fromEntries(form) as Record<string, string>, 
          })
          return input.success(
            {
              async subject(type, properties, opts) {
                const tokens = await generateTokens(c, {
                  type: type as string,
                  subject:
                    opts?.subject || (await resolveSubject(type, properties)),
                  properties,
                  clientID: clientID, 
                  ttl: {
                    access: opts?.ttl?.access ?? ttlAccess,
                    refresh: opts?.ttl?.refresh ?? ttlRefresh,
                  },
                });
                return c.json({
                  access_token: tokens.access,
                  refresh_token: tokens.refresh,
                })
              },
            },
            {
              provider: provider, 
              ...response, 
            },
            c.req.raw,
          );
        } catch (err: any) {
          // Handle errors from the provider's client function
          const oauthError = err instanceof OauthError 
            ? err 
            : new OauthError("invalid_grant", err.message || "Client validation failed");
          return c.json(
            { error: oauthError.error, error_description: oauthError.description },
            400,
          );
        }
      }

      throw new Error("Invalid grant_type")
    },
  )

  app.get("/authorize", async (c) => {
    const provider = c.req.query("provider")
    const response_type = c.req.query("response_type")
    const redirect_uri = c.req.query("redirect_uri")
    const state = c.req.query("state")
    const client_id = c.req.query("client_id")
    const audience = c.req.query("audience")
    const code_challenge = c.req.query("code_challenge")
    const code_challenge_method = c.req.query("code_challenge_method")
    const authorization: AuthorizationState = {
      response_type,
      redirect_uri,
      state,
      client_id,
      audience,
      pkce:
        code_challenge && code_challenge_method
          ? {
              challenge: code_challenge,
              method: code_challenge_method,
            }
          : undefined,
    } as AuthorizationState
    c.set("authorization", authorization)

    if (!redirect_uri) {
      return c.text("Missing redirect_uri", { status: 400 })
    }

    if (!response_type) {
      throw new MissingParameterError("response_type")
    }

    if (!client_id) {
      throw new MissingParameterError("client_id")
    }

    if (input.start) {
      await input.start(c.req.raw)
    }

    if (
      !(await allow()(
        {
          clientID: client_id,
          redirectURI: redirect_uri,
          audience,
        },
        c.req.raw,
      ))
    )
      throw new UnauthorizedClientError(client_id, redirect_uri)
    await auth.set(c, "authorization", 60 * 60 * 24, authorization)
    if (provider) return c.redirect(`/${provider}/authorize`)
    const providers = Object.keys(input.providers)
    if (providers.length === 1) return c.redirect(`/${providers[0]}/authorize`)
    return auth.forward(
      c,
      await select()(
        Object.fromEntries(
          Object.entries(input.providers).map(([key, value]) => [
            key,
            value.type,
          ]),
        ),
        c.req.raw,
      ),
    )
  })

  app.get("/userinfo", async (c) => {
    const header = c.req.header("Authorization")

    if (!header) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "Missing Authorization header",
        },
        400,
      )
    }

    const [type, token] = header.split(" ")

    if (type !== "Bearer") {
      return c.json(
        {
          error: "invalid_request",
          error_description: "Missing or invalid Authorization header",
        },
        400,
      )
    }

    if (!token) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "Missing token",
        },
        400,
      )
    }

    const result = await jwtVerify<{
      mode: "access"
      type: keyof SubjectSchema
      properties: v1.InferInput<SubjectSchema[keyof SubjectSchema]>
    }>(token, () => signingKey().then((item) => item.public), {
      issuer: issuer(c),
    })

    const validated = await input.subjects[result.payload.type][
      "~standard"
    ].validate(result.payload.properties)

    if (!validated.issues && result.payload.mode === "access") {
      return c.json(validated.value as SubjectSchema)
    }

    return c.json({
      error: "invalid_token",
      error_description: "Invalid token",
    })
  })

  app.onError(async (err, c) => {
    console.error(err)
    if (err instanceof UnknownStateError) {
      return auth.forward(c, await error(err, c.req.raw))
    }
    const authorization = await getAuthorization(c)
    const url = new URL(authorization.redirect_uri)
    const oauth =
      err instanceof OauthError
        ? err
        : new OauthError("server_error", err.message)
    url.searchParams.set("error", oauth.error)
    url.searchParams.set("error_description", oauth.description)
    return c.redirect(url.toString())
  })

  return app
}
