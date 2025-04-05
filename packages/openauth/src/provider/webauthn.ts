/**
 * Configures a provider that supports webauthn authentication. This is usually
 * paired with the `WebAuthnUI`.
 *
 * ```ts
 * import { WebAuthnUI } from "@openauthjs/openauth/ui/webauthn"
 * import { WebAuthnProvider } from "@openauthjs/openauth/provider/webauthn"
 *
 * export default issuer({
 *    passkey: WebAuthnProvider(
 *      WebAuthnUI({
 *        // options returned to the browser for navigator.credentials.get()
 *        options: {
 *          userVerification: "required",
 *          rpId: "myapp.com", // optional, defaults to the domain of the issuer (auth.myapp.com)
 *        },
 *        async getCredential(id) {
 *          const credential = await authService.getPasskeyCredential(id);
 *
 *          if (!credential) return null;
 *          return { credential, claims: { userId: credential.userId } };
 *        },
 *      }),
 *    ),
 *   },
 *   // ...
 * })
 * ```
 *
 * Behind the scenes, the `WebAuthnProvider` expects callbacks that implements request handlers
 * that generate the UI for the following.
 *
 * ```ts
 * WebAuthnProvider({
 *   // ...
 *   rpId?: string;
 *   request: (req: Request, state: WebAuthnProviderState, form?: FormData, error?: WebAuthnProviderError) => Promise<Response>
 *   getCredential: (credentialId: Uint8Array) => Promise<{ credential: { id: Uint8Array; algorithm: number; publicKey: Uint8Array }; claims: Claims } | null>
 *   verifyAuthn?: (data) => Promise<WebAuthnProviderError | undefined>
 * })
 * ```
 *
 * This allows you to create your own UI.
 *
 * @packageDocumentation
 */

import type { Provider } from "./provider.js"
import type { Context } from "hono"

import { generateUnbiasedDigits, timingSafeCompare } from "../random.js"
import { getRelativeUrl } from "../util.js"
import {
  decodePKIXECDSASignature,
  decodeSEC1PublicKey,
  p256,
  verifyECDSASignature,
} from "@oslojs/crypto/ecdsa"
import { sha256 } from "@oslojs/crypto/sha2"
import {
  ClientDataType,
  createAssertionSignatureMessage,
  parseAuthenticatorData,
  parseClientDataJSON,
} from "@oslojs/webauthn"

export type WebAuthnProviderConfig<
  Claims extends Record<string, string> = Record<string, string>,
> = {
  /**
   * The request handler to generate the UI for the webauthn flow.
   *
   * Takes the standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
   * and optionally [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
   * ojects.
   *
   * Also passes in the current `state` of the flow and any `error` that occurred.
   *
   * Expects the [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object
   * in return.
   */
  request: (
    req: Request,
    state: WebAuthnProviderState,
    form?: FormData,
    error?: WebAuthnProviderError,
  ) => Promise<Response>
  /**
   * The relying party ID to use for the webauthn flow.
   */
  rpId?: string
  /**
   * Callback to get credential and claims for the user.
   */
  getCredential: (credentialId: Uint8Array) => Promise<{
    credential: {
      id: Uint8Array
      algorithm: number
      publicKey: Uint8Array
    }
    claims: Claims
  } | null>
  /**
   * Callback to verify the credential for the user.
   *
   * @example
   * ```ts
   *  {
   *    async verifyAuthn(data) {
   *      const clientData = parseClientDataJSON(data.raw.clientDataJSON);
   *
   *      if (clientData.type !== ClientDataType.Get) {
   *        return { error: "rejected" }
   *      }
   *      // ... other checks
   *
   *      // decode & verify signature
   *    }
   *  }
   * ```
   */
  verifyAuthn?: (data: {
    credential: {
      id: Uint8Array
      algorithm: number // (ES256)
      publicKey: Uint8Array
    }
    claims: Record<string, string>
    raw: {
      credentialId: Uint8Array
      signature: Uint8Array
      authenticatorData: Uint8Array
      clientDataJSON: Uint8Array
    }
  }) => Promise<WebAuthnProviderError | undefined>
}

/**
 * The state of the webauthn flow.
 *
 * | State | Description |
 * | ----- | ----------- |
 * | `start` | The user is asked to use their credential to start the flow. |
 */
export type WebAuthnProviderState = { type: "start"; challenge: string }

export type WebAuthnProviderError =
  | { error: "invalid_challenge" }
  | { error: "invalid_rp_id" }
  | { error: "invalid_origin" }
  | { error: "invalid_cross_origin" }
  | { error: "invalid_signature" }
  | { error: "invalid_client_data_type" }
  | { error: "credential_not_found" }
  | { error: "unresolved" }
  | { error: "rejected" }

function decodeBase64(str: string): Uint8Array {
  return new Uint8Array(
    atob(str)
      .split("")
      .map((c) => c.charCodeAt(0)),
  )
}

export function WebAuthnProvider<
  Claims extends Record<string, string> = Record<string, string>,
>(config: WebAuthnProviderConfig<Claims>): Provider<{ claims: Claims }> {
  return {
    type: "code",
    init(routes, ctx) {
      async function transition(
        c: Context,
        next: WebAuthnProviderState,
        fd?: FormData,
        err?: WebAuthnProviderError,
      ) {
        await ctx.set<WebAuthnProviderState>(c, "provider", 60 * 60 * 24, next)
        const resp = ctx.forward(
          c,
          await config.request(c.req.raw, next, fd, err),
        )
        return resp
      }

      async function transitionToStart(
        c: Context,
        fd?: FormData,
        err?: WebAuthnProviderError,
      ) {
        const challenge = generateUnbiasedDigits(32)
        return await transition(c, { type: "start", challenge }, fd, err)
      }

      routes.get("/authorize", async (c) => {
        return await transitionToStart(c)
      })

      routes.post("/authorize", async (c) => {
        const fd = await c.req.formData()
        const state = await ctx.get<WebAuthnProviderState | undefined>(
          c,
          "provider",
        )

        const credentialId = fd.get("credentialId")?.toString()
        const signature = fd.get("signature")?.toString()
        const authenticatorData = fd.get("authData")?.toString()
        const clientDataJSON = fd.get("clientDataJSON")?.toString()

        if (
          state?.type !== "start" ||
          !credentialId ||
          !signature ||
          !authenticatorData ||
          !clientDataJSON
        ) {
          return await transitionToStart(c, fd, { error: "unresolved" })
        }

        const credId = decodeBase64(credentialId)
        const sig = decodeBase64(signature)
        const authData = decodeBase64(authenticatorData)
        const clientDataJson = decodeBase64(clientDataJSON)

        const clientData = parseClientDataJSON(clientDataJson)
        const challenge = new TextDecoder().decode(clientData.challenge)

        if (!timingSafeCompare(state.challenge, challenge)) {
          return await transitionToStart(c, fd, { error: "invalid_challenge" })
        }

        const res = await config.getCredential(credId)

        if (!res) {
          return await transitionToStart(c, fd, {
            error: "credential_not_found",
          })
        }

        const url = new URL(getRelativeUrl(c, "/"))
        const origin = url.origin
        const rpId = config.rpId || url.hostname

        const verifyError = config.verifyAuthn
          ? await config.verifyAuthn({
              credential: res.credential,
              claims: res.claims,
              raw: {
                credentialId: credId,
                signature: sig,
                authenticatorData: authData,
                clientDataJSON: clientDataJson,
              },
            })
          : verifyWebAuthn({
              rpId,
              origin,
              credentialPublicKey: res.credential.publicKey,
              signature: sig,
              authData,
              clientDataJSON: clientDataJson,
            })

        if (verifyError) {
          return await transitionToStart(c, fd, verifyError)
        }

        await ctx.unset(c, "provider")
        return ctx.forward(c, await ctx.success(c, res))
      })
    },
  }
}

/**
 * @internal
 */
export type WebAuthnProviderOptions<
  Claims extends Record<string, string> = Record<string, string>,
> = WebAuthnProviderConfig<Claims>

/**
 * Default implementation of the `verifyWebAuthn` function.
 * This function verifies the webauthn signature and checks if the user is present and verified.
 * Reference: https://webauthn.oslojs.dev/examples/authentication
 */
function verifyWebAuthn(input: {
  rpId: string
  origin: string
  credentialPublicKey: Uint8Array
  signature: Uint8Array
  authData: Uint8Array
  clientDataJSON: Uint8Array
}): WebAuthnProviderError | undefined {
  const authenticatorData = parseAuthenticatorData(input.authData)
  if (!authenticatorData.verifyRelyingPartyIdHash(input.rpId)) {
    return { error: "invalid_rp_id" }
  }
  if (!authenticatorData.userPresent || !authenticatorData.userVerified) {
    return { error: "rejected" }
  }

  const clientData = parseClientDataJSON(input.clientDataJSON)
  if (clientData.type !== ClientDataType.Get) {
    return { error: "invalid_client_data_type" }
  }

  if (clientData.origin !== input.origin) {
    return { error: "invalid_origin" }
  }
  if (clientData.crossOrigin !== null && clientData.crossOrigin) {
    return { error: "invalid_cross_origin" }
  }

  // Decode DER-encoded signature
  const ecdsaSignature = decodePKIXECDSASignature(input.signature)
  const ecdsaPublicKey = decodeSEC1PublicKey(p256, input.credentialPublicKey)
  const hash = sha256(
    createAssertionSignatureMessage(input.authData, input.clientDataJSON),
  )
  const valid = verifyECDSASignature(ecdsaPublicKey, hash, ecdsaSignature)

  if (!valid) {
    return { error: "invalid_signature" }
  }
}
