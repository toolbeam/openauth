import { useContext } from "react"
import { AuthContext } from "./context.js"
import { objectToFormData } from "@openauthjs/core/custom-ui/util/shared"

export interface AuthContextData {
  form?: FormData
  state?: Record<string, unknown>
  error?: Record<string, unknown>
}

export function useAuth(): AuthContextData {
  const data = useContext(AuthContext)
  return { ...data, form: data.form ? objectToFormData(data.form) : data.form }
}
