/**
 * Valid types that can be stored in the storage adapter
 * Includes primitive types and nested objects with unknown values
 */
export type StorageValue = string | number | boolean | null | Record<string, unknown>;

/**
 * Interface for storage operations in OpenAuth
 * Provides a consistent API for different storage backends (DynamoDB, Cloudflare KV, etc.)
 * All methods use string array keys for hierarchical storage support
 */
export interface StorageAdapter {
  /**
   * Retrieves a value by key
   * @param key - Array of key segments forming the full key path
   * @returns Promise resolving to the stored value or undefined if not found
   */
  get(key: string[]): Promise<Record<string, StorageValue> | undefined>

  /**
   * Removes a value by key
   * @param key - Array of key segments forming the full key path
   * @returns Promise that resolves when the value is removed
   */
  remove(key: string[]): Promise<void>

  /**
   * Sets a value with optional TTL
   * @param key - Array of key segments forming the full key path
   * @param value - Value to store, must be a valid StorageValue type
   * @param ttl - Optional time-to-live in seconds
   * @returns Promise that resolves when the value is stored
   */
  set(key: string[], value: StorageValue, ttl?: number): Promise<void>

  /**
   * Scans storage with prefix
   * @param prefix - Array of key segments to use as prefix for scanning
   * @returns AsyncIterable of key-value pairs matching the prefix
   */
  scan(prefix: string[]): AsyncIterable<[string[], StorageValue]>
}

/** Separator character used for joining key segments */
const SEPERATOR = String.fromCharCode(0x1f)

/**
 * Joins key segments into a single string using the separator
 * @param key - Array of key segments to join
 * @returns Joined key string
 */
export function joinKey(key: string[]) {
  return key.join(SEPERATOR)
}

/**
 * Splits a key string into segments using the separator
 * @param key - Key string to split
 * @returns Array of key segments
 */
export function splitKey(key: string) {
  return key.split(SEPERATOR)
}

/**
 * Namespace providing high-level storage operations with type safety
 * Handles key encoding and type conversion for storage operations
 */
export namespace Storage {
  /**
   * Encodes key segments by removing separator characters
   * @param key - Array of key segments to encode
   * @returns Encoded key segments safe for storage
   * @internal
   */
  function encode(key: string[]) {
    return key.map((k) => k.replaceAll(SEPERATOR, ""))
  }

  /**
   * Type-safe get operation
   * @param adapter - Storage adapter to use
   * @param key - Array of key segments
   * @returns Promise resolving to typed value or undefined
   */
  export function get<T extends StorageValue>(adapter: StorageAdapter, key: string[]) {
    return adapter.get(encode(key)) as Promise<T | undefined>
  }

  /**
   * Sets a value in storage
   * @param adapter - Storage adapter to use
   * @param key - Array of key segments
   * @param value - Value to store
   * @param ttl - Optional time-to-live in seconds
   */
  export function set(
    adapter: StorageAdapter,
    key: string[],
    value: StorageValue,
    ttl?: number,
  ) {
    return adapter.set(encode(key), value, ttl)
  }

  /**
   * Removes a value from storage
   * @param adapter - Storage adapter to use
   * @param key - Array of key segments
   */
  export function remove(adapter: StorageAdapter, key: string[]) {
    return adapter.remove(encode(key))
  }

  /**
   * Type-safe storage scan operation
   * @param adapter - Storage adapter to use
   * @param key - Array of key segments to use as prefix
   * @returns AsyncIterable of typed key-value pairs
   */
  export async function* scan<T extends StorageValue>(
    adapter: StorageAdapter,
    key: string[],
  ): AsyncIterable<[string[], T]> {
    for await (const [k, v] of adapter.scan(encode(key))) {
      yield [k, v as T];
    }
  }
}
