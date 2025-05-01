import { afterEach, setSystemTime } from "bun:test"
import { beforeEach, describe, expect, test } from "bun:test"
import { UnStorage } from "../src/storage/unstorage.js"

let storage = UnStorage()

beforeEach(async () => {
  storage = UnStorage()
  setSystemTime(new Date("1/1/2024"))
})

afterEach(() => {
  setSystemTime()
})

describe("set", () => {
  test("basic", async () => {
    await storage.set(["users", "123"], { name: "Test User" })
    const result = await storage.get(["users", "123"])
    expect(result).toEqual({ name: "Test User" })
  })

  test("ttl", async () => {
    await storage.set(
      ["temp", "key"],
      { value: "value" },
      new Date(Date.now() + 100),
    ) // 100ms TTL
    let result = await storage.get(["temp", "key"])
    expect(result?.value).toBe("value")

    setSystemTime(Date.now() + 150)
    result = await storage.get(["temp", "key"])
    expect(result).toBeUndefined()
  })

  test("nested", async () => {
    const complexObj = {
      id: 1,
      nested: { a: 1, b: { c: 2 } },
      array: [1, 2, 3],
    }
    await storage.set(["complex"], complexObj)
    const result = await storage.get(["complex"])
    expect(result).toEqual(complexObj)
  })
})

describe("get", () => {
  test("missing", async () => {
    const result = await storage.get(["nonexistent"])
    expect(result).toBeUndefined()
  })

  test("key", async () => {
    await storage.set(["a", "b", "c"], { value: "nested" })
    const result = await storage.get(["a", "b", "c"])
    expect(result?.value).toBe("nested")
  })
})

describe("remove", () => {
  test("existing", async () => {
    await storage.set(["test"], "value")
    await storage.remove(["test"])
    const result = await storage.get(["test"])
    expect(result).toBeUndefined()
  })

  test("missing", async () => {
    expect(storage.remove(["nonexistent"])).resolves.toBeUndefined()
  })
})

describe("scan", () => {
  test("all", async () => {
    await storage.set(["users", "1"], { id: 1 })
    await storage.set(["users", "2"], { id: 2 })
    await storage.set(["other"], { id: 3 })
    const results = await Array.fromAsync(storage.scan(["users"]))
    expect(results).toHaveLength(2)
    expect(results).toContainEqual([["users", "1"], { id: 1 }])
    expect(results).toContainEqual([["users", "2"], { id: 2 }])
  })

  test("ttl", async () => {
    await storage.set(["temp", "1"], "a", new Date(Date.now() + 100))
    await storage.set(["temp", "2"], "b", new Date(Date.now() + 100))
    await storage.set(["temp", "3"], "c")
    expect(await Array.fromAsync(storage.scan(["temp"]))).toHaveLength(3)
    setSystemTime(Date.now() + 150)
    expect(await Array.fromAsync(storage.scan(["temp"]))).toHaveLength(1)
  })
})
