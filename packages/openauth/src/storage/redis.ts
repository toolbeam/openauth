import { Redis, RedisOptions } from "ioredis"
import { joinKey, splitKey, StorageAdapter } from "./storage.js"

export interface RedisStorageOptions {
  connectionUrl: string
}

export interface RedisStorageCredentials extends RedisOptions {}

type OnlyOne<T> = T extends RedisStorageCredentials
  ? Required<RedisStorageCredentials> extends T
    ? T
    : never
  : RedisStorageOptions extends T
    ? T
    : never

export function RedisStorage<
  T extends RedisStorageOptions | RedisStorageCredentials,
>(opts: OnlyOne<T>): StorageAdapter {
  const client =
    "connectionUrl" in opts ? new Redis(opts.connectionUrl) : new Redis(opts)

  return {
    async get(key: string[]) {
      const value = await client.get(joinKey(key))
      if (!value) return
      return JSON.parse(value) as Record<string, any>
    },
    async set(key: string[], value: any, ttl?: number) {
      if (ttl !== undefined && ttl > 0) {
        await client.set(
          joinKey(key),
          JSON.stringify(value),
          "EX",
          Math.trunc(ttl),
        )
      } else {
        await client.set(joinKey(key), JSON.stringify(value))
      }
    },
    async remove(key: string[]) {
      await client.del(joinKey(key))
    },
    async *scan(prefix: string[]) {
      let cursor = "0"

      while (true) {
        let [next, keys] = await client.scan(
          cursor,
          "MATCH",
          `${joinKey(prefix)}*`,
        )

        for (const key of keys) {
          const value = await client.get(key)
          if (value !== null) {
            yield [splitKey(key), JSON.parse(value)]
          }
        }

        // Number(..) cant handle 64bit integer
        if (BigInt(next) === BigInt(0)) {
          break
        }

        cursor = next
      }
    },
  }
}
