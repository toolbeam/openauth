import type { PluginOption } from "vite"

export type Context = {
  form?: Record<string, unknown>
  state?: Record<string, unknown>
  loaderData?: Record<string, unknown>
  error?: Record<string, unknown>
}

export interface MatcherOptions<C = unknown> {
  route: string
  context: C
}

export type Matcher<C = unknown, T = unknown> = (
  options: MatcherOptions<C>,
) => false | T | Promise<false | T>

export interface SSRRenderer<T = MatcherOptions, C = unknown> {
  name: string
  match: Matcher<C, T>
  render: (
    context: Context,
    config: T,
  ) => ReadableStream | Promise<ReadableStream>
}

export interface OpenAuthHeadTag {
  tag: string
  props: Record<string, string | boolean>
  children?: string
}

export interface OpenAuthBuildContext {
  isSSR: boolean
  command: string
  projectRoot: string
}

export interface OpenAuthIntegration {
  name: string
  getPlugins?: (ctx: OpenAuthBuildContext) => PluginOption[]
  ssrRenderer?: { modulePath: string; exportName: string }
  getHeadTags?: () => OpenAuthHeadTag[]
  getPagesExtensions?: () => string[]
}
