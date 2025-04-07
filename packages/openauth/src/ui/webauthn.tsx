/**
 * Configure the UI that's used by the WebAuthn provider.
 *
 * This provider requires `@oslojs/webauthn` to be installed.
 * 
 * ```bash
 * npm i @oslojs/webauthn
 * ```
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
 * @packageDocumentation
 */
/** @jsxImportSource hono/jsx */

import { Layout } from "./base.js"
import { FormAlert } from "./form.js"

import type { WebAuthnProviderOptions } from "../provider/webauthn.js"
import { html } from "hono/html"

const DEFAULT_COPY = {
  invalid_challenge: "Invalid Challenge.",
  invalid_rp_id: "Invalid RP ID.",
  invalid_origin: "Invalid Origin.",
  invalid_cross_origin: "Invalid Cross Origin.",
  invalid_signature: "Invalid Signature.",
  invalid_client_data_type: "Invalid Client Data Type.",
  credential_not_found: "Credential not found.",
  unresolved: "Unresolved.",
  rejected: "Rejected.",
  verify: "Verify",
  code_info: "Please verify your identity.",
}

export type WebAuthnUICopy = typeof DEFAULT_COPY

export type WebAuthnUIOptions = {
  /**
   * The request options for navigator.credentials.get.
   *
   * Sent to the client via JSON.
   *
   * See [`Request Options`](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential/parseRequestOptionsFromJSON_static)
   */
  options?: Omit<PublicKeyCredentialRequestOptions, "challenge">
  /**
   * Custom copy for the UI.
   */
  copy?: Partial<WebAuthnUICopy>
  /**
   * Callback to get the webauthn credential for the user.
   */
  getCredential: WebAuthnProviderOptions["getCredential"]
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
  verifyAuthn?: WebAuthnProviderOptions["verifyAuthn"]
}

function stringToBase64Url(from: string): string {
  return btoa(from).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

export function WebAuthnUI(props: WebAuthnUIOptions): WebAuthnProviderOptions {
  const copy = {
    ...DEFAULT_COPY,
    ...props.copy,
  }

  return {
    rpId: props.options?.rpId,
    getCredential: props.getCredential,
    verifyAuthn: props.verifyAuthn,
    request: async (_req, state, _form, error): Promise<Response> => {
      const options = JSON.stringify({
        ...(props.options ?? {}),
        challenge: stringToBase64Url(state.challenge),
      })

      const jsx = (
        <Layout>
          <form data-component="form" method="post" action="/passkey/authorize">
            {error && <FormAlert message={copy[error.error]} />}
            <input type="hidden" name="action" value="request" />
            <input type="hidden" name="options" value={options} />
            <input type="hidden" name="credentialId" value="" />
            <input type="hidden" name="signature" value="" />
            <input type="hidden" name="authData" value="" />
            <input type="hidden" name="clientDataJSON" value="" />

            <button type="button" data-component="button" onclick="start();">
              {copy.verify}
            </button>

            <PasskeyLoader />
          </form>
          <p data-component="form-footer">{copy.code_info}</p>
        </Layout>
      )

      return new Response(jsx.toString(), {
        headers: {
          "Content-Type": "text/html",
        },
      })
    },
  }
}

// in order to trigger the passkey flow, we need to use onclick in <button />,
// but hono server cannot ship with a react runtime, instead returns html.

function PasskeyLoader() {
  return html`
    <script>
      function select(input) {
        return document.querySelector("input[name=" + input + "]")
      }

      const options = JSON.parse(select("options").value)

      async function loadPasskey() {
        const publicKey = parseRequestOptionsFromJSON(options)

        const credential = await navigator.credentials.get({ publicKey })

        if (!(credential instanceof PublicKeyCredential)) {
          throw new Error("Failed to get credential")
        }
        const r = credential.response
        if (!(r instanceof AuthenticatorAssertionResponse)) {
          throw new Error("Unexpected error")
        }

        select("credentialId").value = encode(new Uint8Array(credential.rawId))
        select("signature").value = encode(new Uint8Array(r.signature))
        select("authData").value = encode(new Uint8Array(r.authenticatorData))
        select("clientDataJSON").value = encode(
          new Uint8Array(r.clientDataJSON),
        )

        const form = document.querySelector('form[data-component="form"]')
        form.submit()
      }

      function encode(buffer) {
        return btoa(String.fromCharCode(...buffer))
      }

      function decode(base64) {
        return new Uint8Array(
          atob(base64)
            .split("")
            .map((c) => c.charCodeAt(0)),
        ).buffer
      }

      function parseRequestOptionsFromJSON(options) {
        // this is kinda ponyfill of PublicKeyCredential
        // since API does not work on safari <18.4
        // https://developer.mozilla.org/docs/Web/API/PublicKeyCredential/parseRequestOptionsFromJSON_static

        const challenge = decode(options.challenge)
        const allowCredentials =
          options.allowCredentials?.map((cred) => {
            return { ...cred, id: decode(cred.id) }
          }) ?? []
        return { ...options, allowCredentials, challenge }
      }

      function start() {
        const footer = document.querySelector('p[data-component="form-footer"]')

        loadPasskey().catch((err) => {
          footer.innerText = err.message
        })
      }
    </script>
  `
}
