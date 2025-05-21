/**
 * Configures a provider that supports passkey (WebAuthn) authentication.
 *
 * ```ts
 * import { PasskeyProvider } from "@openauthjs/openauth/provider/passkey"
 *
 * export default issuer({
 *   providers: {
 *     passkey: PasskeyProvider({
 *       rpName: "My Application",
 *       rpID: "example.com", // optional - can also be passed in as a query parameter (see the UI)
 *       origin: "https://example.com", // optional - can also be passed in as a query parameter (see the UI)
 *       userCanRegisterPasskey: async (userId, req) => { // optional
 *         // Check if the user is allowed to register a passkey
 *         return true
 *       }
 *     })
 *   },
 *   // ...
 * })
 * ```
 *
 * PasskeyProvider implements WebAuthn (Web Authentication) to enable passwordless
 * authentication using biometrics, mobile devices, or security keys. It handles
 * the complete flow for registering new passkeys and authenticating with them.
 *
 * The provider requires configuration of:
 * - Relying Party information (rpName, rpID)
 * - Origin validation
 * - UI handlers for authorization and registration
 *
 * It automatically manages:
 * - Challenge generation
 * - Credential storage
 * - Registration verification
 * - Authentication verification
 *
 * This implementation is powered by [@simplewebauthn/server](https://simplewebauthn.dev),
 * which provides the core WebAuthn functionality for passkey authentication.
 *
 * @packageDocumentation
 */

import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  Base64URLString,
  AuthenticatorSelectionCriteria,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  VerifiedRegistrationResponse,
} from "@simplewebauthn/server"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server"

import type { Provider, ProviderOptions, ProviderRoute } from "./provider.js"
import { Storage } from "../storage/storage.js"
import type { Context } from "hono"

/**
 * Converts a Uint8Array to a Base64URL encoded string.
 * This is used to convert binary data for storage in databases or JSON.
 *
 * @param bytes - The Uint8Array to convert
 * @returns Base64URL encoded string
 */
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let str = ""

  for (const charCode of bytes) {
    str += String.fromCharCode(charCode)
  }

  const base64String = btoa(str)

  return base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/**
 * Converts a Base64URL encoded string back to a Uint8Array.
 * This is used to convert stored data back to binary format for WebAuthn operations.
 *
 * @param base64urlString - The Base64URL encoded string to convert
 * @returns Uint8Array containing the decoded data
 */
function base64UrlToUint8Array(base64urlString: string): Uint8Array {
  // Convert from Base64URL to Base64
  const base64 = base64urlString.replace(/-/g, "+").replace(/_/g, "/")
  /**
   * Pad with '=' until it's a multiple of four
   * (4 - (85 % 4 = 1) = 3) % 4 = 3 padding
   * (4 - (86 % 4 = 2) = 2) % 4 = 2 padding
   * (4 - (87 % 4 = 3) = 1) % 4 = 1 padding
   * (4 - (88 % 4 = 0) = 4) % 4 = 0 padding
   */
  const padLength = (4 - (base64.length % 4)) % 4
  const padded = base64.padEnd(base64.length + padLength, "=")

  // Convert to a binary string
  const binary = atob(padded)

  // Convert binary string to buffer
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

/**
 * User model for passkey authentication.
 * Contains the core user data needed for WebAuthn operations.
 */
export type UserModel = {
  id: string // User's unique ID (must be stable and unique)
  username: string
  // other user fields...
}

/**
 * Original PasskeyModel structure for in-memory use.
 * Represents a registered credential with public key as Uint8Array.
 */
export type PasskeyModel = {
  id: string
  publicKey: Uint8Array
  userId: string // Foreign key to UserModel
  webauthnUserID: string
  counter: number
  deviceType: CredentialDeviceType
  backedUp: boolean
  transports?: AuthenticatorTransportFuture[]
}

/**
 * PasskeyModel version for KV storage with publicKey as string.
 * Used for storing credentials in a key-value store.
 */
export type PasskeyModelStored = Omit<PasskeyModel, "publicKey"> & {
  publicKey: string // Stored as Base64URL string
}

// --- Storage Key Definitions ---
const userKey = (userId: string) => ["passkey", "user", userId]
const passkeyKey = (userId: string, credentialId: Base64URLString) => [
  "passkey",
  "user",
  userId,
  "credential",
  credentialId,
  "passkey",
]
const optionsKey = (userId: string) => ["passkey", "user", userId, "options"]
const userPasskeysIndexKey = (userId: string) => [
  "passkey",
  "user",
  userId,
  "passkeys",
] // Stores list of credentialIDs

// Configuration
const DEFAULT_COPY = {
  error_user_not_allowed:
    "There is already an account with this email. Login to add a passkey.",
}

/**
 * Configuration for the PasskeyProvider.
 * Defines how the passkey authentication flow should behave.
 */
export interface PasskeyProviderConfig {
  /**
   * Custom authorization handler that generates the UI for authorization.
   */
  authorize: (req: Request) => Promise<Response>

  /**
   * Custom registration handler that generates the UI for registration.
   */
  register: (req: Request) => Promise<Response>

  /**
   * The human-readable name of the relying party (your application).
   */
  rpName: string

  /**
   * The ID of the relying party, typically the domain name without protocol.
   */
  rpID?: string

  /**
   * The origin URL(s) that are allowed to initiate WebAuthn ceremonies.
   */
  origin?: string | string[]

  /**
   * Optional function to check if a user is allowed to register a passkey.
   */
  userCanRegisterPasskey?: (userId: string, req: Request) => Promise<boolean>

  /**
   * Optional WebAuthn authenticator selection criteria.
   */
  authenticatorSelection?: AuthenticatorSelectionCriteria

  /**
   * Optional attestation type.
   */
  attestationType?: "none" | "direct" | "enterprise"

  /**
   * Optional timeout for challenges in milliseconds.
   */
  timeout?: number

  /**
   * Custom copy texts for error messages and UI elements.
   */
  copy?: Partial<typeof DEFAULT_COPY>
}

/**
 * Creates a passkey (WebAuthn) authentication provider.
 *
 * This provider enables passwordless authentication using biometrics, hardware security
 * keys, or platform authenticators. It implements the Web Authentication (WebAuthn) standard.
 *
 * It handles:
 * - Passkey registration (creating new credentials)
 * - Authentication with existing passkeys
 * - Secure storage of credentials
 * - Challenge verification
 *
 * @param config Configuration options for the passkey provider
 * @returns A Provider instance configured for passkey authentication
 */
export function PasskeyProvider(
  config: PasskeyProviderConfig,
): Provider<{ userId: string; credentialId?: Base64URLString }> {
  const copy = {
    ...DEFAULT_COPY,
    ...config.copy,
  }
  return {
    type: "passkey",
    init(
      routes: ProviderRoute,
      ctx: ProviderOptions<{
        userId: string
        credentialId?: Base64URLString
        verified: boolean
      }>,
    ) {
      const {
        rpName,
        authenticatorSelection,
        attestationType = "none",
        timeout = 5 * 60 * 1000, // 5 minutes in ms for challenge
      } = config

      // --- Internal Data Access Functions using options.storage ---

      async function getStoredUserById(
        userId: string,
      ): Promise<UserModel | null> {
        return await Storage.get<UserModel>(ctx.storage, userKey(userId))
      }

      async function saveUser(user: UserModel): Promise<void> {
        await Storage.set(ctx.storage, userKey(user.id), user)
      }

      async function getStoredPasskeyById(
        userId: string,
        credentialID: Base64URLString,
      ): Promise<PasskeyModel | null> {
        const storedPasskey = await Storage.get<PasskeyModelStored>(
          ctx.storage,
          passkeyKey(userId, credentialID),
        )
        if (!storedPasskey) return null
        return {
          ...storedPasskey,
          publicKey: base64UrlToUint8Array(storedPasskey.publicKey),
        }
      }

      async function getStoredUserPasskeys(
        userId: string,
      ): Promise<PasskeyModel[]> {
        const passkeyIds =
          (await Storage.get<Base64URLString[]>(
            ctx.storage,
            userPasskeysIndexKey(userId),
          )) || []
        const passkeys: PasskeyModel[] = []
        for (const id of passkeyIds) {
          const pk = await getStoredPasskeyById(userId, id)
          if (pk) passkeys.push(pk)
        }
        return passkeys
      }

      async function saveNewStoredPasskey(
        passkeyData: PasskeyModel,
      ): Promise<void> {
        const storablePasskey: PasskeyModelStored = {
          ...passkeyData,
          publicKey: uint8ArrayToBase64Url(passkeyData.publicKey),
        }
        await Storage.set(
          ctx.storage,
          passkeyKey(passkeyData.userId, passkeyData.id),
          storablePasskey,
        )

        // Update user's passkey index
        const passkeyIds =
          (await Storage.get<Base64URLString[]>(
            ctx.storage,
            userPasskeysIndexKey(passkeyData.userId),
          )) || []
        if (!passkeyIds.includes(passkeyData.id)) {
          passkeyIds.push(passkeyData.id)
          await Storage.set(
            ctx.storage,
            userPasskeysIndexKey(passkeyData.userId),
            passkeyIds,
          )
        }
      }

      async function updateStoredPasskeyCounter(
        userId: string,
        credentialID: Base64URLString,
        newCounter: number,
      ): Promise<void> {
        const passkey = await getStoredPasskeyById(userId, credentialID)
        if (passkey) {
          passkey.counter = newCounter
          const storablePasskey: PasskeyModelStored = {
            ...passkey,
            publicKey: uint8ArrayToBase64Url(passkey.publicKey),
          }
          await Storage.set(
            ctx.storage,
            passkeyKey(userId, credentialID),
            storablePasskey,
          )
        }
      }

      routes.get("/authorize", async (c) => {
        return ctx.forward(c, await config.authorize(c.req.raw))
      })

      routes.get("/register", async (c) => {
        return ctx.forward(c, await config.register(c.req.raw))
      })

      // --- REGISTRATION FLOW ---
      routes.get("/register-request", async (c: Context) => {
        const userId = c.req.query("userId")
        const rpID = config.rpID || c.req.query("rpID")
        const otherDevice = c.req.query("otherDevice") === "true"

        if (!userId) {
          return c.json({ error: "User ID for registration is required." }, 400)
        }
        if (!rpID) {
          return c.json({ error: "RP ID for registration is required." }, 400)
        }
        const username = c.req.query("username") || userId

        let user = await getStoredUserById(userId)

        if (config.userCanRegisterPasskey) {
          const isAllowed = await config.userCanRegisterPasskey(
            userId,
            c.req.raw,
          )
          if (!isAllowed) {
            return c.json(
              {
                error: copy.error_user_not_allowed,
              },
              403,
            )
          }
        }
        // If user does not exist, you might create them here or expect them to be pre-registered
        if (!user) {
          user = { id: userId, username }
          await saveUser(user)
        }

        const userPasskeys = await getStoredUserPasskeys(user.id)

        const regOptions: PublicKeyCredentialCreationOptionsJSON =
          await generateRegistrationOptions({
            rpName,
            rpID,
            userName: user.username,
            attestationType,
            excludeCredentials: userPasskeys.map((pk) => ({
              id: pk.id,
              transports: pk.transports,
            })),
            authenticatorSelection: authenticatorSelection ?? {
              residentKey: "preferred",
              userVerification: "preferred",
              authenticatorAttachment: otherDevice
                ? "cross-platform"
                : "platform",
            },
            timeout,
          })
        await Storage.set(ctx.storage, optionsKey(user.id), regOptions)
        return c.json(regOptions)
      })

      routes.post("/register-verify", async (c: Context) => {
        const body: RegistrationResponseJSON = await c.req.json()

        const { userId } = c.req.query() as { userId: string }
        const rpID = config.rpID || c.req.query("rpID")
        const origin = config.origin || c.req.query("origin")
        if (!userId) {
          return c.json(
            {
              verified: false,
              error: "User ID for verification is required.",
            },
            400,
          )
        }
        if (!rpID) {
          return c.json({ error: "RP ID for verification is required." }, 400)
        }
        if (!origin) {
          return c.json({ error: "Origin for verification is required." }, 400)
        }

        const user = await getStoredUserById(userId)
        if (!user) {
          return c.json(
            { verified: false, error: "User not found during verification." },
            404,
          )
        }
        const regOptions =
          await Storage.get<PublicKeyCredentialCreationOptionsJSON>(
            ctx.storage,
            optionsKey(user.id),
          )
        if (!regOptions) {
          return c.json(
            { verified: false, error: "Registration options not found." },
            400,
          )
        }
        const challenge = regOptions.challenge

        let verification: VerifiedRegistrationResponse
        try {
          verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification:
              authenticatorSelection?.userVerification !== "discouraged",
          })
        } catch (error: any) {
          console.error("Passkey Registration Verification Error:", error)
          return c.json({ verified: false, error: error.message }, 400)
        }

        const { verified, registrationInfo } = verification

        if (verified && registrationInfo) {
          const { credential, credentialDeviceType, credentialBackedUp } =
            registrationInfo

          if (credential) {
            const newPasskey: PasskeyModel = {
              id: credential.id,
              userId: user.id,
              webauthnUserID: regOptions.user.id,
              publicKey: credential.publicKey,
              counter: credential.counter,
              transports: credential.transports,
              deviceType: credentialDeviceType,
              backedUp: credentialBackedUp,
            }

            await saveNewStoredPasskey(newPasskey)

            return ctx.success(c, {
              userId: user.id,
              credentialId: newPasskey.id,
              verified: true,
            })
          }
        }
        return c.json(
          { verified: false, error: "Registration verification failed." },
          400,
        )
      })

      // --- AUTHENTICATION FLOW ---
      routes.get("/authenticate-options", async (c: Context) => {
        const { userId } = c.req.query() as { userId?: string }
        if (!userId) {
          return c.json(
            { error: "User ID for authentication is required." },
            400,
          )
        }
        const rpID = config.rpID || c.req.query("rpID")
        if (!rpID) {
          return c.json({ error: "RP ID for authentication is required." }, 400)
        }

        const userForAuth = await getStoredUserById(userId)
        if (!userForAuth) {
          return c.json({ error: "User not found for authentication." }, 404)
        }

        const userPasskeys = await getStoredUserPasskeys(userForAuth.id)
        const allowCredentialsList = userPasskeys.map((pk) => ({
          id: pk.id,
          transports: pk.transports,
        }))

        const authOptions: PublicKeyCredentialRequestOptionsJSON =
          await generateAuthenticationOptions({
            rpID,
            allowCredentials: allowCredentialsList,
            userVerification:
              authenticatorSelection?.userVerification ?? "preferred",
            timeout,
          })

        await Storage.set(ctx.storage, optionsKey(userForAuth.id), authOptions)
        return c.json(authOptions)
      })

      routes.post("/authenticate-verify", async (c: Context) => {
        const body: AuthenticationResponseJSON = await c.req.json()
        const { userId } = c.req.query() as { userId?: string }
        if (!userId) {
          return c.json(
            { error: "User ID for authentication is required." },
            400,
          )
        }
        const rpID = config.rpID || c.req.query("rpID")
        if (!rpID) {
          return c.json({ error: "RP ID for authentication is required." }, 400)
        }
        const origin = config.origin || c.req.query("origin")
        if (!origin) {
          return c.json(
            { error: "Origin for authentication is required." },
            400,
          )
        }

        const user = await getStoredUserById(userId)
        if (!user) {
          return c.json(
            { verified: false, error: `User ${userId} not found.` },
            404,
          )
        }

        const authOptions =
          await Storage.get<PublicKeyCredentialRequestOptionsJSON>(
            ctx.storage,
            optionsKey(user.id),
          )

        if (!authOptions) {
          return c.json({ error: "Authentication options not found." }, 400)
        }
        const passkey = await getStoredPasskeyById(userId, body.id)

        if (!passkey) {
          return c.json(
            {
              verified: false,
              error: `Passkey ${body.id} not found for user ${user.username}.`,
            },
            400,
          )
        }

        const { publicKey, counter, transports } = passkey

        if (!publicKey || typeof counter !== "number" || !transports) {
          return c.json({ error: "Passkey not found for authentication." }, 400)
        }

        const challenge = authOptions.challenge
        if (!challenge) {
          return c.json({ error: "Authentication challenge not found." }, 400)
        }

        const verification = await verifyAuthenticationResponse({
          response: body,
          expectedChallenge: challenge,
          expectedOrigin: origin || "",
          expectedRPID: rpID,
          credential: {
            id: passkey.id,
            publicKey: publicKey,
            counter: counter,
            transports: transports,
          },
        })

        const { verified, authenticationInfo } = verification

        if (verified) {
          await updateStoredPasskeyCounter(
            user.id,
            passkey.id,
            authenticationInfo.newCounter,
          )
          return ctx.success(c, {
            userId: user.id,
            credentialId: passkey.id,
            verified: true,
          })
        }
        return c.json(
          { verified: false, error: "Authentication verification failed." },
          400,
        )
      })
    },
  }
}
