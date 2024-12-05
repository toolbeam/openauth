/** @jsxImportSource hono/jsx */

import { CodeAdapterOptions } from "../adapter/code.js";
import { UnknownStateError } from "../error.js";
import { Layout } from "./base.js";
import { FormAlert } from "./form.js";

export function CodeUI(props: {
  sendCode: (claims: Record<string, string>, code: string) => Promise<void>;
}) {
  return {
    sendCode: props.sendCode,
    length: 6,
    request: async (_req, state, _form, error) => {
      if (state.type === "start") {
        const jsx = (
          <Layout>
            {/* Form */}
            <form data-component="form" method="post">
              {error?.type === "invalid_claim" && (
                <FormAlert message={"Email address is not valid"} />
              )}
              <input type="hidden" name="action" value="request" />
              <input
                data-component="input"
                autofocus
                type="email"
                name="email"
                required
                placeholder="Email"
              />
              <button data-component="button">Continue</button>
            </form>
            <p data-component="form-footer">
              We&apos;ll send a pin code to your email
            </p>
          </Layout>
        );
        return new Response(jsx.toString(), {
          headers: {
            "Content-Type": "text/html",
          },
        });
      }

      if (state.type === "code") {
        const jsx = (
          <Layout>
            <form data-component="form" class="form" method="post">
              {error?.type === "invalid_code" && (
                <FormAlert message={"Invalid code"} />
              )}
              {state.type === "code" && (
                <FormAlert
                  message={"Code resent to " + state.claims.email}
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
                placeholder="Code"
              />
              <button data-component="button">Continue</button>
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
                  Didn't get code? <button data-component="link">Resend</button>
                </span>
              </div>
            </form>
          </Layout>
        );
        return new Response(jsx.toString(), {
          headers: {
            "Content-Type": "text/html",
          },
        });
      }

      throw new UnknownStateError();
    },
  } satisfies CodeAdapterOptions;
}
