export const OPENAUTH_CONTEXT_DATA_ID = "__openauth-context__"

export function objectToFormData(obj: Record<string, unknown>): FormData {
  const formData = new FormData()

  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null) return

    if (Array.isArray(value)) {
      value.forEach((item) => {
        formData.append(key, item)
      })
    } else {
      formData.append(key, value as Blob | string)
    }
  })

  return formData
}
