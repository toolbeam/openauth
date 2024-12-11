import { joinKey, splitKey, type StorageAdapter } from "./storage.js";
import Database from "libsql";

export interface SqliteStorageOptions {
  persist?: string;
  tableName?: string;
}

export function SQLiteStorage(input?: SqliteStorageOptions): StorageAdapter {
  // initialize sqlite database and create the necessary table structure
  const db = new Database(input?.persist ?? ":memory:");
  const TABLE_NAME = input?.tableName ?? "__openauth__kv_storage";

  db.exec(
    `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (key TEXT PRIMARY KEY, value TEXT, expiry INTEGER)`
  );

  return {
    async get(key: string[]) {
      const joined = joinKey(key);

      const row = db
        .prepare(`SELECT value, expiry FROM ${TABLE_NAME} WHERE key = ?`)
        .get(joined) as { value: string; expiry: number } | undefined;

      if (row && row.expiry && row.expiry < Date.now()) {
        db.prepare(`DELETE FROM ${TABLE_NAME} WHERE key = ?`).run(joined);
        return undefined;
      }
      return row ? JSON.parse(row.value) : undefined;
    },
    async set(key: string[], value: any, ttl?: number) {
      const expiry = ttl ? Date.now() + ttl * 1000 : undefined;
      const joined = joinKey(key);
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLE_NAME} (key, value, expiry) VALUES (?, ?, ?)`
      ).run(joined, JSON.stringify(value), expiry);
    },
    async remove(key: string[]) {
      const joined = joinKey(key);
      db.prepare(`DELETE FROM ${TABLE_NAME} WHERE key = ?`).run(joined);
    },
    async *scan(prefix: string[]) {
      const joined = joinKey(prefix);
      const rows = db
        .prepare(
          `SELECT key, value, expiry FROM ${TABLE_NAME} WHERE key LIKE ?`
        )
        .all(joined + "%") as { key: string; value: string; expiry: number }[];

      for (const row of rows) {
        if (row.expiry && row.expiry < Date.now()) {
          continue;
        }
        yield [splitKey(row.key), JSON.parse(row.value)];
      }
    },
  };
}
