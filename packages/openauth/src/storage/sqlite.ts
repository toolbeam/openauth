import {
  joinKey,
  splitKey,
  type StorageAdapter,
} from "@openauthjs/openauth/storage/storage";
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
    `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (key TEXT PRIMARY KEY, value TEXT, ttl INTEGER)`
  );

  const cleanExpired = () => {
    db.prepare(`DELETE FROM ${TABLE_NAME} WHERE ttl < ?`).run(Date.now());
  };

  return {
    async get(key: string[]) {
      cleanExpired();
      const joined = joinKey(key);
      const row = db
        .prepare(`SELECT value FROM ${TABLE_NAME} WHERE key = ?`)
        .get(joined) as { value: string } | undefined;
      return row ? JSON.parse(row.value) : undefined;
    },
    async set(key: string[], value: any, ttl?: number) {
      const joined = joinKey(key);
      db.prepare(
        `INSERT OR REPLACE INTO ${TABLE_NAME} (key, value, ttl) VALUES (?, ?, ?)`
      ).run(joined, JSON.stringify(value), ttl);
    },
    async remove(key: string[]) {
      const joined = joinKey(key);
      db.prepare(`DELETE FROM ${TABLE_NAME} WHERE key = ?`).run(joined);
    },
    async *scan(prefix: string[]) {
      cleanExpired();
      const joined = joinKey(prefix);
      const rows = db
        .prepare(`SELECT key, value, ttl FROM ${TABLE_NAME} WHERE key LIKE ?`)
        .all(joined + "%") as { key: string; value: string; ttl: number }[];

      for (const row of rows) {
        yield [splitKey(row.key), JSON.parse(row.value)];
      }
    },
  };
}
