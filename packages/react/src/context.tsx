import { createContext } from "react"

/** @internal */
export interface AuthContextServerData {
  form?: Record<string, unknown>
  state?: Record<string, unknown>
  error?: Record<string, unknown>
}

/** @internal */
export const AuthContext = createContext<AuthContextServerData>({})
