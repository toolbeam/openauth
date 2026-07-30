import { useContext } from "react"
import { AuthContext } from "./context.js"
import { objectToFormData } from "@openauthjs/core/custom-ui/util/shared"

/**
 * The data provided by the OpenAuth server to your custom UI components.
 */
export interface AuthContextData {
  /**
   * The form data submitted by the user, useful for preserving input values after a failed submission.
   */
  form?: FormData
  /**
   * Data returned from your server-side loaders or internal OpenAuth state.
   */
  state?: Record<string, unknown>
  /**
   * Validation or authentication errors returned by the server.
   */
  error?: Record<string, unknown>
}
/**
 * A React hook to access OpenAuth data inside your custom pages.
 * Use this to retrieve form submissions, server state, and errors.
 *
 * @example
 * ```tsx title="src/pages/login.tsx"
 * import { useAuth } from "@openauthjs/react"
 *
 * export default function Login() {
 *   const { error, form } = useAuth()
 *
 *   return (
 *     <form method="post">
 *       {error && <p>Failed to login</p>}
 *       <input
 *         name="email"
 *         defaultValue={form?.get("email") as string}
 *       />
 *       <button type="submit">Log in</button>
 *     </form>
 *   )
 * }
 * ```
 */
export function useAuth(): AuthContextData {
  const data = useContext(AuthContext)
  return { ...data, form: data.form ? objectToFormData(data.form) : data.form }
}
