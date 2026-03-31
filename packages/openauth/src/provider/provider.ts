import type { Context, Hono } from "hono"
import { StorageAdapter } from "../storage/storage.js"

export type ProviderRoute = Hono

/**
 * Payload passed to `provider.finalize()` when lazy registration is enabled.
 */
export interface ProviderFinalizeInput {
  storage: StorageAdapter
  subject: string
  type: string
  properties: any
  data: any
}

export interface Provider<Properties = any> {
  type: string
  init: (route: ProviderRoute, options: ProviderOptions<Properties>) => void
  /**
   * Finalize provider-side persistence at token exchange time.
   *
   * Called when `IssuerInput.persistence.registration = "lazy"` and the
   * provider supplied commit payload during `success()`.
   */
  finalize?: (input: ProviderFinalizeInput) => Promise<void>
  client?: (input: {
    clientID: string
    clientSecret: string
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
      /**
       * Arbitrary provider payload for lazy persistence.
       *
       * Saved into authorization-code state and passed to `finalize()`.
       */
      commit?: any
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
