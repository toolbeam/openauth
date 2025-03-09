/**
 * Configure OpenAuth to use [Cloudflare KV](https://developers.cloudflare.com/kv/) as a
 * storage adapter.
 *
 * ```ts
 * import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare"
 *
 * const storage = CloudflareStorage({
 *   namespace: "my-namespace"
 * })
 *
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
import type { KVNamespace } from "@cloudflare/workers-types"
import { joinKey, splitKey, StorageAdapter } from "./storage.js"

/**
 * Configure the Cloudflare KV store that's created.
 */
export interface CloudflareStorageOptions {
  namespace: KVNamespace
}
/**
 * Creates a Cloudflare KV store.
 * @param options - The config for the adapter.
 */
export function CloudflareStorage(
  options: CloudflareStorageOptions,
): StorageAdapter {
  return {
    async get(key: string[]) {
      const value = await options.namespace.get(joinKey(key), "json")
      if (!value) return
      return value as Record<string, any>
    },

    async set(key: string[], value: any, expiry?: Date) {
      await options.namespace.put(joinKey(key), JSON.stringify(value), {
        expirationTtl: expiry
          ? Math.max(Math.floor((expiry.getTime() - Date.now()) / 1000), 60)
          : undefined,
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
