/**
 * Configure OpenAuth to use unstorage as a store.
 *
 * This enables you to use any unstorage driver as a store.
 * Please refer to [unstorage docs](https://unstorage.unjs.io/drivers) for details on possible drivers.
 *
 * By default, it uses the memory driver.
 *
 * :::caution
 * The default memory driver is not meant to be used in production.
 * :::
 *
 * ```ts
 * import { UnStorage } from "@openauthjs/openauth/storage/unstorage"
 *
 * const storage = UnStorage()
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * Optionally, you can specify a driver.
 *
 * ```ts
 * import fsDriver from "unstorage/drivers/fs";
 *
 * UnStorage({
 *   driver: fsDriver({ base: "./tmp" }),
 * })
 * ```
 *
 * @packageDocumentation
 */
import { joinKey, splitKey, StorageAdapter } from "./storage.js"
import { createStorage, type Driver as UnstorageDriver } from "unstorage"
import memoryDriver from "unstorage/drivers/memory"

type Entry = { value: Record<string, any> | undefined; expiry?: number }

export function UnStorage({
  driver,
}: { driver?: UnstorageDriver } = {}): StorageAdapter {
  const store = createStorage<Entry>({
    driver: driver || memoryDriver(),
  })

  return {
    async get(key: string[]) {
      const k = joinKey(key)
      const entry = await store.getItem(k)

      if (!entry) {
        return undefined
      }

      if (entry.expiry && Date.now() >= entry.expiry) {
        await store.removeItem(k)
        return undefined
      }

      return entry.value
    },

    async set(key: string[], value: any, expiry?: Date) {
      const k = joinKey(key)

      await store.setItem(k, {
        value,
        expiry: expiry ? expiry.getTime() : undefined,
      } satisfies Entry)
    },

    async remove(key: string[]) {
      const k = joinKey(key)
      await store.removeItem(k)
    },

    async *scan(prefix: string[]) {
      const now = Date.now()
      const prefixStr = joinKey(prefix)

      // Get all keys matching our prefix
      const keys = await store.getKeys(prefixStr)

      for (const key of keys) {
        // Get the entry for this key
        const entry = await store.getItem(key)

        if (!entry) continue
        if (entry.expiry && now >= entry.expiry) {
          // Clean up expired entries as we go
          await store.removeItem(key)
          continue
        }

        yield [splitKey(key), entry.value]
      }
    },
  }
}
