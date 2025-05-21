import { PasskeyProviderConfig } from "../provider/passkey.js"
import { Layout } from "./base.js"
import { FormAlert } from "./form.js"

import { AuthenticatorSelectionCriteria } from "@simplewebauthn/server"

const DEFAULT_COPY = {
  /**
   * Copy for the register button.
   */
  register: "Register",
  register_with_passkey: "Register With Passkey",
  register_other_device: "Use another device",
  /**
   * Copy for the register link.
   */
  register_prompt: "Don't have an account?",
  /**
   * Copy for the login link.
   */
  login_prompt: "Already have an account?",
  /**
   * Copy for the login button.
   */
  login: "Login",
  /**
   * Copy for the login with passkey button.
   */
  login_with_passkey: "Login With Passkey",
  /**
   * Copy for the forgot password link.
   */
  change_prompt: "Forgot password?",
  /**
   * Copy for the resend code button.
   */
  code_resend: "Resend code",
  /**
   * Copy for the "Back to" link.
   */
  code_return: "Back to",
  /**
   * Copy for the email input.
   */
  input_email: "Email",
}
type PasskeyUIOptions = Omit<PasskeyProviderConfig, "authorize" | "register">

export function PasskeyUI(options: PasskeyUIOptions): PasskeyProviderConfig {
  const {
    rpName,
    rpID,
    origin,
    userCanRegisterPasskey,
    authenticatorSelection,
    attestationType,
    timeout,
  } = options
  const copy = {
    ...DEFAULT_COPY,
    ...options.copy,
  }
  return {
    authorize: async () => {
      const jsx = (
        <Layout>
          <script
            dangerouslySetInnerHTML={{
              __html: `

window.addEventListener("load", async () => {
  const { startAuthentication } = SimpleWebAuthnBrowser;
  const message = document.querySelector("[data-slot='message']");
  const authorizeForm = document.getElementById("authorizeForm");
  const origin = window.location.origin;
  const rpID = window.location.hostname;
  authorizeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(authorizeForm);
    const email = formData.get("email");
    message.innerHTML = "";

    // GET registration options from the endpoint that calls
    // @simplewebauthn/server -> generateRegistrationOptions()
    const resp = await fetch(
      "/passkey/authenticate-options?userId=" + email + "&rpID=" + rpID
    );

    const optionsJSON = await resp.json();

    if (optionsJSON.error) {
      message.innerHTML = optionsJSON.error;
      return;
    }

    let attResp;
    try {
      // Pass the options to the authenticator and wait for a response
      attResp = await startAuthentication({ optionsJSON });
    } catch (error) {
      message.innerHTML = error;
      throw error;
    }
    const verificationResp = await fetch(
      "/passkey/authenticate-verify?userId=" +
        email +
        "&rpID=" +
        rpID +
        "&origin=" +
        origin,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attResp),
      }
    );
    
    // Check if the request was redirected and the final response is OK
    if (verificationResp.redirected && verificationResp.ok) {
      // Navigate the browser to the final URL
      window.location.href = verificationResp.url;
    } else {
      // Handle errors (e.g., 4xx, 5xx status codes from the final URL)
      console.error(
        "Request failed:",
        verificationResp.status,
        verificationResp.statusText
      );
      try {
        const errorData = await verificationResp.json();
        message.innerHTML = errorData.error;
      } catch (error) {
        message.innerHTML = "Something went wrong";
      }
    }
  });
});
              `,
            }}
          />
          <p>Passkeys are a simple and more secure alternative to passwords.</p>
          <p>
            With passkeys, you can log in with your PIN, biometric sensor, or
            hardware security key. You can create a passkey on this device, or
            use another device.
          </p>
          <form id="authorizeForm" data-component="form" method="post">
            <FormAlert />
            <input
              data-component="input"
              type="email"
              name="email"
              required
              placeholder={copy.input_email}
            />
            <button type="submit" id="btnLogin" data-component="button">
              {copy.login_with_passkey}
            </button>
            <div data-component="form-footer">
              <span>
                {copy.register_prompt}{" "}
                <a data-component="link" href="register">
                  {copy.register}
                </a>
              </span>
            </div>
          </form>
          <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
        </Layout>
      )
      return new Response(jsx.toString(), {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      })
    },
    register: async () => {
      const jsx = (
        <Layout>
          <script
            dangerouslySetInnerHTML={{
              __html: `

window.addEventListener("load", async () => {
  const { startRegistration } = SimpleWebAuthnBrowser;
  const message = document.querySelector("[data-slot='message']");
  const registerForm = document.getElementById("registerForm");
  const origin = window.location.origin;
  const rpID = window.location.hostname;
  // Start registration when the user clicks a button
  const register = async (otherDevice = false) => {
    const formData = new FormData(registerForm);
    const email = formData.get("email");
    message.innerHTML = "";

    // GET registration options from the endpoint that calls
    // @simplewebauthn/server -> generateRegistrationOptions()
    const resp = await fetch(
      "/passkey/register-request?userId=" +
        email +
        "&origin=" +
        origin +
        "&rpID=" +
        rpID +
        "&otherDevice=" +
        otherDevice,
    );
    const optionsJSON = await resp.json();

    if (optionsJSON.error) {
      message.innerHTML = optionsJSON.error;
      return;
    }

    let attResp;
    try {
      // Pass the options to the authenticator and wait for a response
      attResp = await startRegistration({ optionsJSON });
    } catch (error) {
      message.innerHTML = error;

      throw error;
    }

    // POST the response to the endpoint that calls
    // @simplewebauthn/server -> verifyRegistrationResponse()
    try {
      const verificationResp = await fetch(
        "/passkey/register-verify?userId=" +
          email +
          "&origin=" +
          origin +
          "&rpID=" +
          rpID,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attResp),
        }
      );

      // Check if the request was redirected and the final response is OK
      if (verificationResp.redirected && verificationResp.ok) {
        // Navigate the browser to the final URL
        window.location.href = verificationResp.url;
      } else {
        // Handle errors (e.g., 4xx, 5xx status codes from the final URL)
        console.error(
          "Request failed:",
          verificationResp.status,
          verificationResp.statusText
        );
        try {
          const errorData = await verificationResp.json();
          message.innerHTML = errorData.error;
        } catch (error) {
          message.innerHTML = "Something went wrong";
        }
      }
    } catch (error) {
      console.error(error);
      message.innerHTML = "Something went wrong";
    }
  };
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    register();
  });
    
});

              `,
            }}
          />

          <form id="registerForm" data-component="form" method="post">
            <FormAlert />
            <input
              data-component="input"
              type="email"
              name="email"
              required
              placeholder={copy.input_email}
            />
            <button data-component="button" type="submit" id="btnRegister">
              {copy.register_with_passkey}
            </button>
            <button data-component="button" type="submit" id="btnOtherDevice">
              {copy.register_other_device}
            </button>
            <div data-component="form-footer">
              <span>
                {copy.login_prompt}{" "}
                <a data-component="link" href="authorize">
                  {copy.login}
                </a>
              </span>
            </div>
          </form>
          <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
        </Layout>
      )
      return new Response(jsx.toString(), {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      })
    },
    rpName,
    rpID,
    origin,
    userCanRegisterPasskey,
    authenticatorSelection,
    attestationType,
    timeout,
  }
}
