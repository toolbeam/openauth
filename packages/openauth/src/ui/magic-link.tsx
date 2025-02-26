/**
 * Configure the UI that's used by the Magic Link provider.
 *
 * ```ts {1,7-12}
 * import { MagicLinkUI } from "@openauthjs/openauth/ui/magic-link"
 * import { MagicLinkProvider } from "@openauthjs/openauth/provider/magic-link"
 *
 * export default issuer({
 *   providers: {
 *     magicLink: MagicLinkProvider(
 *       MagicLinkUI({
 *         copy: {
 *           link_info: "We'll send a link to your email"
 *         },
 *         sendLink: (claims, link) => console.log(claims.email, link)
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

import { Layout } from "./base.js"
import { FormAlert } from "./form.js"
import { MagicLinkProviderOptions } from "../provider/magic-link.js"

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
   * Copy informing that the link will be emailed.
   */
  link_info: "We'll send a link to your email.",
  /**
   * Copy for when the link was sent.
   */
  link_sent: "Link sent to ",
}

export type MagicLinkUICopy = typeof DEFAULT_COPY

/**
 * Configure the Magic Link UI
 */
export interface MagicLinkUIOptions {
  /**
   * Callback to send the magic link to the user.
   *
   * The `claims` object contains the email of the user. You can send the magic link
   * using this.
   *
   * @example
   * ```ts
   * async (claims, link) => {
   *   // Send the link via the claim
   * }
   * ```
   */
  sendLink: (claims: Record<string, string>, link: string) => Promise<void>
  /**
   * Custom copy for the UI.
   */
  copy?: Partial<MagicLinkUICopy>
}

/**
 * Creates a UI for the Magic Link provider flow
 * @param props - Configure the UI.
 */
export function MagicLinkUI(
  props: MagicLinkUIOptions,
): MagicLinkProviderOptions {
  const copy = {
    ...DEFAULT_COPY,
    ...props.copy,
  }

  return {
    sendLink: props.sendLink,
    request: async (_req, state, _form, error): Promise<Response> => {
      const jsx = (
        <Layout>
          <form data-component="form" method="post">
            {error?.type === "invalid_claim" && (
              <FormAlert message={copy.email_invalid} />
            )}
            {state.type === "link" && (
              <FormAlert
                message={copy.link_sent + state.claims.email}
                color="success"
              />
            )}
            <input
              data-component="input"
              autofocus
              type="email"
              name="email"
              inputmode="email"
              required
              placeholder={copy.email_placeholder}
            />
            <button data-component="button">{copy.button_continue}</button>
          </form>
          <p data-component="form-footer">{copy.link_info}</p>
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
