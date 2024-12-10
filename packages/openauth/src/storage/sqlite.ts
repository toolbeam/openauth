import {
  joinKey,
  splitKey,
  type StorageAdapter,
} from "@openauthjs/openauth/storage/storage";

import Database from "libsql";

export interface SqliteStorageOptions {
  persist?: string;
}
export function SQLiteStorage(input?: SqliteStorageOptions): StorageAdapter {
  // initialize sqlite database and create the necessary table structure
  const db = new Database(input?.persist || ":memory:");
  db.exec(
    "CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY, value TEXT, ttl INTEGER)"
  );

  return {
    async get(key: string[]) {
      const joined = joinKey(key);
      const row = db
        .prepare("SELECT value FROM storage WHERE key = ?")
        .get(joined) as { value: string } | undefined;
      return row ? JSON.parse(row.value) : undefined;
    },
    async set(key: string[], value: any, ttl?: number) {
      const joined = joinKey(key);
      db.prepare(
        "INSERT OR REPLACE INTO storage (key, value, ttl) VALUES (?, ?, ?)"
      ).run(joined, JSON.stringify(value), ttl);
    },
    async remove(key: string[]) {
      const joined = joinKey(key);
      db.prepare("DELETE FROM storage WHERE key = ?").run(joined);
    },
    async *scan(prefix: string[]) {
      const joined = joinKey(prefix);
      const rows = db
        .prepare("SELECT key, value, ttl FROM storage WHERE key LIKE ?")
        .all(joined + "%") as { key: string; value: string; ttl: number }[];

      for (const row of rows) {
        yield [splitKey(row.key), JSON.parse(row.value)];
      }
    },
  };
}
