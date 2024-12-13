import type { KVNamespace } from "@cloudflare/workers-types"
import { joinKey, splitKey, StorageAdapter } from "./storage.js"

interface CloudflareStorageOptions {
  namespace: KVNamespace
}
export function CloudflareStorage(
  options: CloudflareStorageOptions,
): StorageAdapter {
  return {
    async get(key: string[]) {
      const value = await options.namespace.get(joinKey(key), "json")
      if (!value) return
      return value as Record<string, any>
    },

    async set(key: string[], value: any, ttl?: number) {
      await options.namespace.put(joinKey(key), JSON.stringify(value), {
        expirationTtl: ttl,
      })
    },

    async remove(key: string[]) {
      await options.namespace.delete(joinKey(key))
    },

    async *scan(prefix: string[]) {
      let cursor: string | undefined
      while (true) {
        const result = await options.namespace.list({
          prefix: joinKey([...prefix, ""]),
          cursor,
        })

        for (const key of result.keys) {
          const value = await options.namespace.get(key.name, "json")
          if (value !== null) {
            yield [splitKey(key.name), value]
          }
        }
        if (result.list_complete) {
          break
        }
        cursor = result.cursor
      }
    },
  }
}
