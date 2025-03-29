/**
 * Configure OpenAuth to use [Redis](https://redis.io/) as a storage adapter.
 *
 * ```ts
 * import { RedisStorage } from '@openauthjs/openauth/storage/redis'
 *
 * const REDIS_URL = 'redis://myserver'
 *
 * export default issuer({
 *   storage: await RedisStorage({ url: REDIS_URL }),
 *   // ...
 * })
 * ```
 *
 * Uses the recommended [node-redis](https://github.com/redis/node-redis) client
 *
 * Other [client configuration options](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md#createclient-configuration)
 *
 * @packageDocumentation
 */
import { createClient, type RedisClientOptions } from 'redis'
import { joinKey, splitKey, StorageAdapter } from './storage.js'

/**
 * Creates a Redis KV store.
 * @param options - The config for the adapter.
 */
export async function RedisStorage(options?: RedisClientOptions): Promise<StorageAdapter> {
  const client = await createClient(options)
    .on('error', (err) => console.error('Redis Client Error', err))
    .connect()

  return {
    async get(key: string[]) {
      const value = await client.get(joinKey(key))
      if (!value) return
      return JSON.parse(value) as Record<string, any>
    },

    async set(key: string[], value: any, expiry?: Date) {
      const _opts = expiry ? { EXAT: expiry.getTime() } : {}
      await client.set(joinKey(key), JSON.stringify(value), _opts)
    },

    async remove(key: string[]) {
      await client.del(joinKey(key))
    },

    async *scan(prefix: string[]) {
      let cursor = 0

      while (true) {
        let { cursor: next, keys } = await client.scan(cursor, {
          MATCH: `${joinKey(prefix)}*`,
        })

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
