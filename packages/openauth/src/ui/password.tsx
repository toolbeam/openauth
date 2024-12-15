/** @jsxImportSource hono/jsx */

import {
  PasswordChangeError,
  PasswordConfig,
  PasswordLoginError,
  PasswordRegisterError,
} from "../adapter/password.js"
import { Layout } from "./base.js"
import "./form.js"
import { FormAlert } from "./form.js"

const DEFAULT_COPY = {
  error_email_taken: "There is already an account with this email.",
  error_invalid_code: "Code is incorrect.",
  error_invalid_email: "Email is not valid.",
  error_invalid_password: "Password is incorrect.",
  error_password_mismatch: "Passwords do not match.",
  register_title: "Welcome to the app",
  register_description: "Sign in with your email",
  login_title: "Welcome to the app",
  login_description: "Sign in with your email",
  register: "Register",
  register_prompt: "Don't have an account?",
  login_prompt: "Already have an account?",
  login: "Login",
  change_prompt: "Forgot password?",
  code_resend: "Resend code",
  code_return: "Back to",
  logo: "A",
  input_email: "Email",
  input_password: "Password",
  input_code: "Code",
  input_repeat: "Repeat password",
  button_continue: "Continue",
} satisfies {
  [key in `error_${
    | PasswordLoginError["type"]
    | PasswordRegisterError["type"]
    | PasswordChangeError["type"]}`]: string
} & Record<string, string>

export type PasswordUICopy = typeof DEFAULT_COPY

export interface PasswordUIOptions {
  sendCode: PasswordConfig["sendCode"]
  copy?: Partial<PasswordUICopy>
}

export function PasswordUI(input: PasswordUIOptions) {
  const copy = {
    ...DEFAULT_COPY,
    ...input.copy,
  }
  return {
    sendCode: input.sendCode,
    login: async (_req, form, error): Promise<Response> => {
      const jsx = (
        <Layout>
          <form data-component="form" method="post">
            <FormAlert message={error?.type && copy?.[`error_${error.type}`]} />
            <input
              data-component="input"
              type="email"
              name="email"
              required
              placeholder={copy.input_email}
              autofocus={!error}
              value={form?.get("email")?.toString()}
            />
            <input
              data-component="input"
              autofocus={error?.type === "invalid_password"}
              required
              type="password"
              name="password"
              placeholder={copy.input_password}
              autoComplete="current-password"
            />
            <button data-component="button">{copy.button_continue}</button>
            <div data-component="form-footer">
              <span>
                {copy.register_prompt}{" "}
                <a data-component="link" href="register">
                  {copy.register}
                </a>
              </span>
              <a data-component="link" href="change">
                {copy.change_prompt}
              </a>
            </div>
          </form>
        </Layout>
      )
      return new Response(jsx.toString(), {
        status: error ? 401 : 200,
        headers: {
          "Content-Type": "text/html",
        },
      })
    },
    register: async (_req, state, form, error): Promise<Response> => {
      const emailError = ["invalid_email", "email_taken"].includes(
        error?.type || "",
      )
      const passwordError = ["invalid_password", "password_mismatch"].includes(
        error?.type || "",
      )
      const jsx = (
        <Layout>
          <form data-component="form" method="post">
            <FormAlert message={error?.type && copy?.[`error_${error.type}`]} />
            {state.type === "start" && (
              <>
                <input type="hidden" name="action" value="register" />
                <input
                  data-component="input"
                  autofocus={!error || emailError}
                  type="email"
                  name="email"
                  value={!emailError ? form?.get("email")?.toString() : ""}
                  required
                  placeholder={copy.input_email}
                />
                <input
                  data-component="input"
                  autofocus={passwordError}
                  type="password"
                  name="password"
                  placeholder={copy.input_password}
                  required
                  value={
                    !passwordError ? form?.get("password")?.toString() : ""
                  }
                  autoComplete="new-password"
                />
                <input
                  data-component="input"
                  type="password"
                  name="repeat"
                  required
                  autofocus={passwordError}
                  placeholder={copy.input_repeat}
                  autoComplete="new-password"
                />
                <button data-component="button">{copy.button_continue}</button>
                <div data-component="form-footer">
                  <span>
                    {copy.login_prompt}{" "}
                    <a data-component="link" href="authorize">
                      {copy.login}
                    </a>
                  </span>
                </div>
              </>
            )}

            {state.type === "code" && (
              <>
                <input type="hidden" name="action" value="verify" />
                <input
                  data-component="input"
                  autofocus
                  name="code"
                  minLength={6}
                  maxLength={6}
                  required
                  placeholder={copy.input_code}
                  autoComplete="one-time-code"
                />
                <button data-component="button">{copy.button_continue}</button>
              </>
            )}
          </form>
        </Layout>
      ) as string
      return new Response(jsx.toString(), {
        headers: {
          "Content-Type": "text/html",
        },
      })
    },
    change: async (_req, state, form, error): Promise<Response> => {
      const passwordError = ["invalid_password", "password_mismatch"].includes(
        error?.type || "",
      )
      const jsx = (
        <Layout>
          <form data-component="form" method="post" replace>
            <FormAlert message={error?.type && copy?.[`error_${error.type}`]} />
            {state.type === "start" && (
              <>
                <input type="hidden" name="action" value="code" />
                <input
                  data-component="input"
                  autofocus
                  type="email"
                  name="email"
                  required
                  value={form?.get("email")?.toString()}
                  placeholder={copy.input_email}
                />
              </>
            )}
            {state.type === "code" && (
              <>
                <input type="hidden" name="action" value="verify" />
                <input
                  data-component="input"
                  autofocus
                  name="code"
                  minLength={6}
                  maxLength={6}
                  required
                  placeholder={copy.input_code}
                  autoComplete="one-time-code"
                />
              </>
            )}
            {state.type === "update" && (
              <>
                <input type="hidden" name="action" value="update" />
                <input
                  data-component="input"
                  autofocus
                  type="password"
                  name="password"
                  placeholder={copy.input_password}
                  required
                  value={
                    !passwordError ? form?.get("password")?.toString() : ""
                  }
                  autoComplete="new-password"
                />
                <input
                  data-component="input"
                  type="password"
                  name="repeat"
                  required
                  value={
                    !passwordError ? form?.get("password")?.toString() : ""
                  }
                  placeholder={copy.input_repeat}
                  autoComplete="new-password"
                />
              </>
            )}
            <button data-component="button">{copy.button_continue}</button>
          </form>
          {state.type === "code" && (
            <form method="post">
              <input type="hidden" name="action" value="code" />
              <input type="hidden" name="email" value={state.email} />
              {state.type === "code" && (
                <div data-component="form-footer">
                  <span>
                    {copy.code_return}{" "}
                    <a data-component="link" href="authorize">
                      {copy.login.toLowerCase()}
                    </a>
                  </span>
                  <button data-component="link">{copy.code_resend}</button>
                </div>
              )}
            </form>
          )}
        </Layout>
      )
      return new Response(jsx.toString(), {
        status: error ? 400 : 200,
        headers: {
          "Content-Type": "text/html",
        },
      })
    },
  } satisfies PasswordConfig
}
