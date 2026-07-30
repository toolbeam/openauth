import { STREAM_PLACEHOLDER } from "@openauthjs/core/custom-ui/util.js"

export function mergePageStream(
  shellHtml: string,
  dynamicStream: ReadableStream,
) {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        const [shellStart, shellEnd] = shellHtml.split(STREAM_PLACEHOLDER)

        if (shellStart === undefined || shellEnd === undefined) {
          throw new Error(
            `Placeholder ${STREAM_PLACEHOLDER} not found in the Hono layout.`,
          )
        }

        controller.enqueue(encoder.encode(shellStart))

        const reader = dynamicStream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }

        controller.enqueue(encoder.encode(shellEnd))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

export function serializeFormData(
  formData: FormData,
): Record<string, string | string[]> {
  const obj: Record<string, string | string[]> = {}

  formData.forEach((value, key) => {
    if (typeof value !== "string") return

    const existing = obj[key]

    if (existing !== undefined) {
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        obj[key] = [existing, value]
      }
    } else {
      obj[key] = value
    }
  })

  return obj
}
