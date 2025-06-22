import type { Context, Hono } from "hono"
import { StorageAdapter } from "../storage/storage.js"

export type ProviderRoute = Hono

export interface Provider<Properties = any> {
  type: string
  init: (route: ProviderRoute, options: ProviderOptions<Properties>) => void
  client?: (input: {
    clientID: string
    clientSecret?: string,
    params: Record<string, string>
  }) => Promise<Properties>
}

export interface ProviderOptions<Properties> {
  name: string
  success: (
    ctx: Context,
    properties: Properties,
    opts?: {
      invalidate?: (subject: string) => Promise<void>
    },
  ) => Promise<Response>
  forward: (ctx: Context, response: Response) => Response
  set: <T>(ctx: Context, key: string, maxAge: number, value: T) => Promise<void>
  get: <T>(ctx: Context, key: string) => Promise<T>
  unset: (ctx: Context, key: string) => Promise<void>
  invalidate: (subject: string) => Promise<void>
  storage: StorageAdapter
}
export class ProviderError extends Error {}
export class ProviderUnknownError extends ProviderError {}
