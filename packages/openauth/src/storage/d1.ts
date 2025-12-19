/**
 * Configure OpenAuth to use [Cloudflare D1](https://developers.cloudflare.com/d1/) as a
 * storage adapter.
 *
 * D1 is Cloudflare's native serverless SQL database built on SQLite. Each tenant can have
 * their own isolated D1 database for true data isolation.
 *
 * ```ts
 * import { D1Storage } from "@openauthjs/openauth/storage/d1"
 *
 * const storage = D1Storage({
 *   database: env.DB
 * })
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * The storage adapter will automatically create the required table on first use.
 *
 * @packageDocumentation
 */
import type { D1Database } from "@cloudflare/workers-types"
import { joinKey, splitKey, StorageAdapter } from "./storage.js"

/**
 * Configure the D1 database.
 */
export interface D1StorageOptions {
  /**
   * The D1 database binding from your Cloudflare Worker environment.
   *
   * @example
   * ```ts
   * {
   *   database: env.DB
   * }
   * ```
   */
  database: D1Database
  /**
   * Optional table name for storing auth data.
   *
   * @default "openauth_storage"
   */
  table?: string
}

/**
 * Creates a D1 storage adapter.
 *
 * The adapter automatically creates a table with the following schema:
 * - `key` (TEXT PRIMARY KEY): The storage key
 * - `value` (TEXT): JSON-encoded value
 * - `expiry` (INTEGER): Expiration timestamp in milliseconds (null = no expiry)
 *
 * @param options - The config for the adapter.
 */
export function D1Storage(options: D1StorageOptions): StorageAdapter {
  const { database, table = "openauth_storage" } = options
  let initialized = false

  async function ensureTable() {
    if (initialized) return

    // Create table if it doesn't exist
    await database
      .prepare(
        `
      CREATE TABLE IF NOT EXISTS ${table} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expiry INTEGER
      )
    `,
      )
      .run()

    // Create index for prefix scanning
    await database
      .prepare(
        `
      CREATE INDEX IF NOT EXISTS idx_${table}_key_prefix
      ON ${table}(key)
    `,
      )
      .run()

    // Create index for expiry cleanup
    await database
      .prepare(
        `
      CREATE INDEX IF NOT EXISTS idx_${table}_expiry
      ON ${table}(expiry)
      WHERE expiry IS NOT NULL
    `,
      )
      .run()

    initialized = true
  }

  return {
    async get(key: string[]) {
      await ensureTable()

      const keyStr = joinKey(key)
      const now = Date.now()

      const result = await database
        .prepare(
          `
        SELECT value FROM ${table}
        WHERE key = ?
        AND (expiry IS NULL OR expiry > ?)
      `,
        )
        .bind(keyStr, now)
        .first()

      if (!result) return undefined

      return JSON.parse(result.value as string)
    },

    async set(key: string[], value: any, expiry?: Date) {
      await ensureTable()

      const keyStr = joinKey(key)
      const expiryMs = expiry ? expiry.getTime() : null

      await database
        .prepare(
          `
        INSERT INTO ${table} (key, value, expiry)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          expiry = excluded.expiry
      `,
        )
        .bind(keyStr, JSON.stringify(value), expiryMs)
        .run()
    },

    async remove(key: string[]) {
      await ensureTable()

      const keyStr = joinKey(key)

      await database
        .prepare(
          `
        DELETE FROM ${table}
        WHERE key = ?
      `,
        )
        .bind(keyStr)
        .run()
    },

    async *scan(prefix: string[]) {
      await ensureTable()

      const prefixStr = joinKey([...prefix, ""])
      const now = Date.now()

      // SQLite LIKE with escape for special characters
      const pattern =
        prefixStr.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%"

      const { results } = await database
        .prepare(
          `
        SELECT key, value FROM ${table}
        WHERE key LIKE ? ESCAPE '\\'
        AND (expiry IS NULL OR expiry > ?)
        ORDER BY key
      `,
        )
        .bind(pattern, now)
        .all()

      if (!results) return

      for (const row of results) {
        const key = splitKey(row.key as string)
        const value = JSON.parse(row.value as string)
        yield [key, value]
      }
    },
  }
}

/**
 * Utility function to clean up expired entries from the D1 database.
 *
 * D1 doesn't automatically delete expired entries like KV does, so you may want to
 * run this periodically (e.g., via a Cloudflare Cron Trigger).
 *
 * @param options - The same options used to create the storage adapter
 * @returns The number of expired entries deleted
 *
 * @example
 * ```ts
 * // In a scheduled worker
 * export default {
 *   async scheduled(event, env, ctx) {
 *     const deleted = await cleanupExpiredEntries({
 *       database: env.DB
 *     })
 *     console.log(`Cleaned up ${deleted} expired entries`)
 *   }
 * }
 * ```
 */
export async function cleanupExpiredEntries(
  options: D1StorageOptions,
): Promise<number> {
  const { database, table = "openauth_storage" } = options
  const now = Date.now()

  const result = await database
    .prepare(
      `
    DELETE FROM ${table}
    WHERE expiry IS NOT NULL AND expiry <= ?
  `,
    )
    .bind(now)
    .run()

  return result.meta.changes || 0
}
