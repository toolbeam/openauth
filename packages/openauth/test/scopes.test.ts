import { describe, expect, test } from "bun:test"
import { parseScopes, validateScopes } from "../src/scopes.js"

test("parse", () => {
  expect(parseScopes(undefined)).toBeUndefined()
  expect(parseScopes("")).toBeEmpty()
  expect(parseScopes("foo")).toEqual(["foo"])
  expect(parseScopes("foo bar")).toEqual(["foo", "bar"])
  expect(parseScopes("bar foo")).toEqual(["bar", "foo"])
  expect(parseScopes("bar foo ")).toEqual(["bar", "foo"])
})

describe("validate", () => {
  test("undefined scopes", () => {
    expect(validateScopes(undefined, undefined)).toBeUndefined()
    expect(validateScopes(null, undefined)).toBeUndefined()
    expect(validateScopes("", undefined)).toBeUndefined()
    expect(validateScopes("foo", undefined)).toBeUndefined()
  })

  test("empty scopes", () => {
    expect(validateScopes(undefined, [])).toBeEmpty()
    expect(validateScopes(null, [])).toBeEmpty()
    expect(validateScopes("", [])).toBeEmpty()
  })

  test("equal scopes", () => {
    expect(validateScopes(undefined, ["foo"])).toEqual(["foo"])
    expect(validateScopes(null, ["foo"])).toEqual(["foo"])
    expect(validateScopes("foo", ["foo"])).toEqual(["foo"])
    expect(validateScopes("foo bar", ["foo","bar"])).toEqual(["foo", "bar"])
    expect(validateScopes("bar foo", ["foo","bar"])).toEqual(["bar", "foo"])
  })

  test("narrower scopes", () => {
    expect(validateScopes("", ["foo"])).toBeEmpty()
    expect(validateScopes("foo", ["foo","bar"])).toEqual(["foo"])
    expect(validateScopes("foo", ["foo", "bar"])).toEqual(["foo"])
  })

  test("ignore broader scopes", () => {
    expect(validateScopes("foo", [])).toBeEmpty()
    expect(validateScopes("foo bar", ["foo"])).toEqual(["foo"])
    expect(validateScopes("bar", ["foo"])).toBeEmpty()
  })
})
