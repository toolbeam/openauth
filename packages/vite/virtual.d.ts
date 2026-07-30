declare module "virtual:openauth/custom-ui/renderers" {
  import { OpenAuthHeadTag, SSRRenderer } from "@openauthjs/core/custom-ui"

  export const renderers: SSRRenderer[]
  export const injectedHeadTags: OpenAuthHeadTag[]
}

declare module "virtual:openauth/custom-ui/components" {
  export type VirtualComponentNode = {
    load: <C = () => unknown>() => Promise<{
      Component: C
      [key: string]: any
    }>
    moduleSourcePath: string
    moduleSourceExtension: string
  }

  export const pages: Record<string, VirtualComponentNode>
  export const main: VirtualComponentNode
  export const layout: VirtualComponentNode
}

declare module "virtual:openauth/custom-ui/dev-manifest" {
  export const manifest: Record<
    string,
    {
      file: string
      src: string
      isEntry: boolean
      css: string[]
      assets: string[]
      imports: string[]
    }
  >
}
