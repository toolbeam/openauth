import { describe, expect, test } from "bun:test"
import { signingKeys, encryptionKeys } from "../src/keys.js"
import type { StorageAdapter } from "../src/storage/storage.js"

/**
 * Mock storage adapter that simulates eventual consistency.
 * This mimics Cloudflare KV behavior where writes complete successfully
 * but subsequent scans may not immediately see the new values.
 */
class EventuallyConsistentStorage implements StorageAdapter {
  private data = new Map<string, any>()
  private scanDelayedWrites = new Set<string>()
  private maxRecursionDepth: number

  constructor(maxRecursionDepth = Infinity) {
    this.maxRecursionDepth = maxRecursionDepth
  }

  async get(key: string[]) {
    return this.data.get(JSON.stringify(key))
  }

  async set(key: string[], value: any, expiry?: Date | number) {
    const keyStr = JSON.stringify(key)
    this.data.set(keyStr, value)

    // Simulate eventual consistency: mark this write as "not yet visible to scans"
    // but limit it to prevent infinite recursion in tests
    if (this.data.size <= this.maxRecursionDepth) {
      this.scanDelayedWrites.add(keyStr)
    }

    return undefined
  }

  async remove(key: string[]) {
    this.data.delete(JSON.stringify(key))
  }

  async *scan(prefix: string[]): AsyncGenerator<[string[], any], void, unknown> {
    const prefixStr = JSON.stringify(prefix).slice(0, -1) // Remove trailing ]

    for (const [key, value] of this.data.entries()) {
      // Skip entries that are in the "delayed write" set (simulating eventual consistency)
      if (this.scanDelayedWrites.has(key)) {
        continue
      }

      if (key.startsWith(prefixStr)) {
        yield [JSON.parse(key), value]
      }
    }
  }

  // Helper method to "complete" the eventual consistency and make all writes visible
  makeConsistent() {
    this.scanDelayedWrites.clear()
  }

  // Get the total number of keys created
  getKeyCount() {
    return this.data.size
  }
}

/**
 * Mock storage that counts how many times set() is called.
 * This helps us verify we're not creating hundreds of keys.
 */
class CountingStorage implements StorageAdapter {
  private data = new Map<string, any>()
  public setCallCount = 0

  async get(key: string[]) {
    return this.data.get(JSON.stringify(key))
  }

  async set(key: string[], value: any, expiry?: Date | number) {
    this.setCallCount++
    this.data.set(JSON.stringify(key), value)
    return undefined
  }

  async remove(key: string[]) {
    this.data.delete(JSON.stringify(key))
  }

  async *scan(prefix: string[]): AsyncGenerator<[string[], any], void, unknown> {
    const prefixStr = JSON.stringify(prefix).slice(0, -1)
    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(prefixStr)) {
        yield [JSON.parse(key), value]
      }
    }
  }
}

describe("signingKeys", () => {
  test("generates exactly one key on empty storage", async () => {
    const storage = new CountingStorage()

    const keys = await signingKeys(storage)

    // Should generate exactly one key, not hundreds
    expect(storage.setCallCount).toBe(1)
    expect(keys).toHaveLength(1)
    expect(keys[0].alg).toBe("ES256")
  })

  test("ISSUE #322: fix prevents multiple keys with eventual consistency", async () => {
    // This test verifies the fix for issue #322:
    // The OLD code would recursively call signingKeys() after writing a key.
    // With eventual consistency, the scan wouldn't see the newly written key,
    // so it would create another, triggering infinite recursion (hundreds of keys).
    //
    // The FIX: Return the newly created key directly without recursive scanning.
    // This ensures only ONE key is created per function call.
    const storage = new EventuallyConsistentStorage(10)

    const keys = await signingKeys(storage)

    // With the fix, we create exactly 1 key (no recursive loop)
    expect(storage.getKeyCount()).toBe(1)
    expect(keys).toHaveLength(1)

    // Verify the key is actually persisted
    storage.makeConsistent()
    const persistedKeys = await Array.fromAsync(storage.scan(["signing:key"]))
    expect(persistedKeys).toHaveLength(1)
  })

  test("key is actually persisted to storage", async () => {
    const storage = new CountingStorage()

    const keys = await signingKeys(storage)
    const keyId = keys[0].id

    // Verify the key is in storage by directly scanning
    const storedKeys = await Array.fromAsync(storage.scan(["signing:key"]))
    expect(storedKeys).toHaveLength(1)
    expect(storedKeys[0][1].id).toBe(keyId)
    expect(storedKeys[0][1].alg).toBe("ES256")
  })

  test("reuses existing keys instead of creating new ones", async () => {
    const storage = new CountingStorage()

    // First call creates a key
    const keys1 = await signingKeys(storage)
    expect(storage.setCallCount).toBe(1)

    // Second call should reuse the existing key
    const keys2 = await signingKeys(storage)
    expect(storage.setCallCount).toBe(1) // No new keys created
    expect(keys2[0].id).toBe(keys1[0].id)
  })
})

describe("encryptionKeys", () => {
  test("generates exactly one key on empty storage", async () => {
    const storage = new CountingStorage()

    const keys = await encryptionKeys(storage)

    // Should generate exactly one key, not hundreds
    expect(storage.setCallCount).toBe(1)
    expect(keys).toHaveLength(1)
    expect(keys[0].alg).toBe("RSA-OAEP-512")
  })

  test("ISSUE #322: fix prevents multiple keys with eventual consistency", async () => {
    // Same fix as signingKeys - see test above for detailed explanation
    const storage = new EventuallyConsistentStorage(10)

    const keys = await encryptionKeys(storage)

    // With the fix, we create exactly 1 key (no recursive loop)
    expect(storage.getKeyCount()).toBe(1)
    expect(keys).toHaveLength(1)

    // Verify the key is actually persisted
    storage.makeConsistent()
    const persistedKeys = await Array.fromAsync(storage.scan(["encryption:key"]))
    expect(persistedKeys).toHaveLength(1)
  })

  test("key is actually persisted to storage", async () => {
    const storage = new CountingStorage()

    const keys = await encryptionKeys(storage)
    const keyId = keys[0].id

    // Verify the key is in storage by directly scanning
    const storedKeys = await Array.fromAsync(storage.scan(["encryption:key"]))
    expect(storedKeys).toHaveLength(1)
    expect(storedKeys[0][1].id).toBe(keyId)
    expect(storedKeys[0][1].alg).toBe("RSA-OAEP-512")
  })

  test("reuses existing keys instead of creating new ones", async () => {
    const storage = new CountingStorage()

    // First call creates a key
    const keys1 = await encryptionKeys(storage)
    expect(storage.setCallCount).toBe(1)

    // Second call should reuse the existing key
    const keys2 = await encryptionKeys(storage)
    expect(storage.setCallCount).toBe(1) // No new keys created
    expect(keys2[0].id).toBe(keys1[0].id)
  })
})
