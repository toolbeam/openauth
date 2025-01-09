/**
 * Configure the UI that's used by the Code provider.
 *
 * ```ts {1,7-12}
 * import { CodeUI } from "@openauthjs/openauth/ui/code"
 * import { CodeProvider } from "@openauthjs/openauth/provider/code"
 *
 * export default issuer({
 *   providers: {
 *     code: CodeAdapter(
 *       CodeUI({
 *         copy: {
 *           code_info: "We'll send a pin code to your email"
 *         },
 *         sendCode: (claims, code) => console.log(claims.email, code)
 *       })
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
/** @jsxImportSource hono/jsx */

import { CodeProviderOptions } from "../provider/code.js"
import { UnknownStateError } from "../error.js"
import { Layout } from "./base.js"
import { FormAlert } from "./form.js"

const DEFAULT_COPY = {
  /**
   * Copy for the email input.
   */
  email_placeholder: "Email",
  /**
   * Error message when the email is invalid.
   */
  email_invalid: "Email address is not valid",
  /**
   * Copy for the continue button.
   */
  button_continue: "Continue",
  /**
   * Copy informing that the pin code will be emailed.
   */
  code_info: "We'll send a pin code to your email",
  /**
   * Copy for the pin code input.
   */
  code_placeholder: "Code",
  /**
   * Error message when the code is invalid.
   */
  code_invalid: "Invalid code",
  /**
   * Copy for when the code was sent.
   */
  code_sent: "Code sent to ",
  /**
   * Copy for when the code was resent.
   */
  code_resent: "Code resent to ",
  /**
   * Copy for the link to resend the code.
   */
  code_didnt_get: "Didn't get code?",
  /**
   * Copy for the resend button.
   */
  code_resend: "Resend",
}

export type CodeUICopy = typeof DEFAULT_COPY

/**
 * Configure the password UI.
 */
export interface CodeUIOptions {
  /**
   * Callback to send the pin code to the user.
   *
   * The `claims` object contains the email or phone number of the user. You can send the code
   * using this.
   *
   * @example
   * ```ts
   * async (claims, code) => {
   *   // Send the code via the claim
   * }
   * ```
   */
  sendCode: (claims: Record<string, string>, code: string) => Promise<void>
  /**
   * Custom copy for the UI.
   */
  copy?: Partial<CodeUICopy>
  /**
   * The mode to use for the input.
   * @default "email"
   */
  mode?: "email" | "phone"
}

/**
 * Creates a UI for the Code provider flow.
 * @param props - Configure the UI.
 */
export function CodeUI(props: CodeUIOptions): CodeProviderOptions {
  const copy = {
    ...DEFAULT_COPY,
    ...props.copy,
  }

  const mode = props.mode ?? "email"

  return {
    sendCode: props.sendCode,
    length: 6,
    request: async (_req, state, _form, error): Promise<Response> => {
      if (state.type === "start") {
        const jsx = (
          <Layout>
            <form data-component="form" method="post">
              {error?.type === "invalid_claim" && (
                <FormAlert message={copy.email_invalid} />
              )}
              <input type="hidden" name="action" value="request" />
              <input
                data-component="input"
                autofocus
                type={mode === "email" ? "email" : "tel"}
                name={mode === "email" ? "email" : "phone"}
                inputmode={mode === "email" ? "email" : "numeric"}
                required
                placeholder={copy.email_placeholder}
              />
              <button data-component="button">{copy.button_continue}</button>
            </form>
            <p data-component="form-footer">{copy.code_info}</p>
          </Layout>
        )
        return new Response(jsx.toString(), {
          headers: {
            "Content-Type": "text/html",
          },
        })
      }

      if (state.type === "code") {
        const jsx = (
          <Layout>
            <form data-component="form" class="form" method="post">
              {error?.type === "invalid_code" && (
                <FormAlert message={copy.code_invalid} />
              )}
              {state.type === "code" && (
                <FormAlert
                  message={
                    (state.resend ? copy.code_resent : copy.code_sent) +
                    state.claims.email
                  }
                  color="success"
                />
              )}
              <input type="hidden" name="action" value="verify" />
              <input
                data-component="input"
                autofocus
                minLength={6}
                maxLength={6}
                type="text"
                name="code"
                required
                inputmode="numeric"
                autocomplete="one-time-code"
                placeholder={copy.code_placeholder}
              />
              <button data-component="button">{copy.button_continue}</button>
            </form>
            <form method="post">
              {Object.entries(state.claims).map(([key, value]) => (
                <input
                  key={key}
                  type="hidden"
                  name={key}
                  value={value}
                  className="hidden"
                />
              ))}
              <input type="hidden" name="action" value="request" />
              <div data-component="form-footer">
                <span>
                  {copy.code_didnt_get}{" "}
                  <button data-component="link">{copy.code_resend}</button>
                </span>
              </div>
            </form>
          </Layout>
        )
        return new Response(jsx.toString(), {
          headers: {
            "Content-Type": "text/html",
          },
        })
      }

      throw new UnknownStateError()
    },
  }
}
