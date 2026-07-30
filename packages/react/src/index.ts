import { getFrontendTargetFiles } from "@openauthjs/core/custom-ui/util/server"

import {
  type OpenAuthHeadTag,
  type OpenAuthIntegration,
} from "@openauthjs/core/custom-ui/types"
import viteReact, { type Options as ReactOptions } from "@vitejs/plugin-react"

export function react(options?: ReactOptions): OpenAuthIntegration {
  return {
    name: "openauth-react",
    ssrRenderer: {
      modulePath: "@openauthjs/react/server.js",
      exportName: "react",
    },
    getPagesExtensions() {
      return ["tsx", "ts", "jsx", "js"]
    },
    getHeadTags() {
      if (process.env.OPENAUTH_DEV_URL)
        return getDevHeadTags(process.env.OPENAUTH_DEV_URL)

      return []
    },
    getPlugins(ctx) {
      const reactExtensions = this.getPagesExtensions!()

      const targetFiles = getFrontendTargetFiles(
        ctx.projectRoot,
        reactExtensions,
      ).toArray()
      return [
        {
          name: "openauth-react:config",
          config() {
            return {
              resolve: {
                dedupe: ["react", "react-dom"],
              },
              ssr: {
                external:
                  !ctx.isSSR && ctx.command === "dev"
                    ? ["react", "react-dom", "react-dom/server.node"]
                    : undefined,
                optimizeDeps: {
                  include: ["react", "react-dom/server"],
                },
              },
            }
          },
        },
        viteReact({
          ...options,
          include: targetFiles.length > 0 ? targetFiles : [],
        }),
      ]
    },
  }

  function getDevHeadTags(viteServerUrl: string): OpenAuthHeadTag[] {
    return [
      {
        tag: "script",
        props: { type: "module" },
        children: `
        import RefreshRuntime from "${viteServerUrl}/@react-refresh"
        RefreshRuntime.injectIntoGlobalHook(window)
        window.$RefreshReg$ = () => {}
        window.$RefreshSig$ = () => (type) => type
        window.__vite_plugin_react_preamble_installed__ = true
      `,
      },
      {
        tag: "script",
        props: {
          type: "module",
          src: `${viteServerUrl}/@vite/client`,
        },
      },
    ]
  }
}
