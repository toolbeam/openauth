import {
  type UserConfig,
  defineConfig as viteDefineConfig,
  mergeConfig,
  type ViteDevServer,
  type Plugin,
} from "vite"
import { resolve } from "node:path"
import { existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import {
  getFrontendTargetFiles,
  getBackendTargetFiles,
} from "@openauthjs/core/custom-ui/util.js"
import type {
  OpenAuthBuildContext,
  OpenAuthIntegration,
} from "@openauthjs/core/custom-ui"
import { getRequestListener } from "@hono/node-server"
declare const awslambda: any

export interface OpenAuthUserConfig extends UserConfig {
  integrations?: OpenAuthIntegration[]
}
/**
 * Configure the OpenAuth Vite dev server and build process.
 * 
 * @example
 * ```ts title="openauth.config.ts"
 * import { defineConfig } from "@openauthjs/vite";
 * import { react } from "@openauthjs/react";
 * import tailwindcss from "@tailwindcss/vite";
 *
 * export default defineConfig({
 *   integrations: [react()],
 *   plugins: [tailwindcss()],
 * });
 * ```
 */
export const defineConfig = (rawConfig?: OpenAuthUserConfig) => {
  const userConfig = rawConfig ?? {}
  const integrations = userConfig.integrations ?? []
  delete userConfig.integrations

  const isSSR = process.argv.includes("--ssr") || !!userConfig.build?.ssr
  const command = process.argv[2]

  const projectRoot = process.cwd()
  const buildContext: OpenAuthBuildContext = { isSSR, projectRoot, command }
  const pagesExtensions = getAllPagesCoveredExtensions()

  if (!isSSR && userConfig.build?.manifest === false) {
    console.error(
      "Manifest file is required for OpenAuth, ignoring `build.manifest` property",
    )
  }

  const ssrEntry =
    process.env.OPENAUTH_SSR_ENTRY ||
    (typeof userConfig.build?.ssr === "string"
      ? userConfig.build.ssr
      : resolve(process.cwd(), "src/server/issuer.ts"))

  const frameworkConfig: UserConfig = {
    appType: "custom",
    ssr: {
      target: "node",
      noExternal: true,
    },
    build: {
      minify: true,
      manifest: !isSSR,
      outDir: isSSR ? ".openauth/build/server" : ".openauth/build/client",
      target: isSSR ? "node24" : "esnext",
      emptyOutDir: true,
      rolldownOptions: {
        input: isSSR ? { ...getInput(), index: ssrEntry } : getInput(),
        output: isSSR
          ? {
              format: "es",
              entryFileNames: "[name].mjs",
              chunkFileNames: "[name]-[hash].mjs",
            }
          : {},
      },
    },
    plugins: [
      devManifestPlugin(),
      virtualComponentsRouterPlugin(),
      viteDevServerPlugin(),
      ...integrationPlugins(),
    ],
  }

  const config = mergeConfig(frameworkConfig, userConfig)

  return viteDefineConfig(config)
  function integrationPlugins() {
    const integrationPlugins = integrations.flatMap((integration) =>
      integration.getPlugins ? integration.getPlugins(buildContext) : [],
    )

    return [
      ...integrationPlugins,
      {
        name: "openauth-virtual-renderers",
        resolveId(id: string) {
          if (id === "virtual:openauth/custom-ui/renderers") {
            return "\0virtual:openauth/custom-ui/renderers"
          }
        },
        load(id: string) {
          if (id === "\0virtual:openauth/custom-ui/renderers") {
            let code = `export const renderers = [];\n`
            let allHeadTags: any[] = []

            integrations.forEach((integration, i) => {
              if (integration.ssrRenderer) {
                const { modulePath, exportName } = integration.ssrRenderer
                code += `import { ${exportName} as renderer_${i} } from "${modulePath}";\n`
                code += `renderers.push(renderer_${i}());\n`
              }

              if (integration.getHeadTags) {
                const tags = integration.getHeadTags()
                allHeadTags.push(...tags)
              }
            })

            code += `export const injectedHeadTags = ${JSON.stringify(allHeadTags)};\n`
            return code
          }
        },
      },
    ]
  }

  function getInput() {
    const projectRoot = process.cwd()
    const input = isSSR
      ? getBackendTargetFiles(projectRoot, pagesExtensions).toJson()
      : getFrontendTargetFiles(projectRoot, pagesExtensions).toJson()

    if (!isSSR && !Object.keys(input).includes(`src/main`)) {
      throw new Error(`the src/main.[ext] file is missing`)
    }

    return input
  }

  function viteDevServerPlugin() {
    return {
      name: "openauth-dev-server",
      configureServer(server: ViteDevServer) {
        setViteDevConfig(server)

        // streamHandle(app) breaks without this
        if (typeof awslambda === "undefined") {
          ;(globalThis as any).awslambda = {
            streamifyResponse: () => {},
          }
        }

        return () => {
          server.middlewares.use(async (req, res, next) => {
            const localUrl = server.resolvedUrls?.local?.[0]

            if (!process.env.OPENAUTH_DEV_URL && localUrl) {
              process.env.OPENAUTH_DEV_URL = localUrl.replace(/\/$/, "")
            }

            try {
              if (
                req.url?.startsWith("/@") ||
                req.url?.startsWith("/src/") ||
                req.url?.startsWith("/node_modules/")
              ) {
                return next()
              }

              const mod = await server.ssrLoadModule(ssrEntry)
              const fetchHandler = mod.default?.fetch || mod.fetch
              if (!fetchHandler) {
                console.error(
                  `[OpenAuth] You must export the raw Hono app as default in ${ssrEntry} for local development.`,
                )
                return next()
              }

              const listener = getRequestListener(fetchHandler)
              listener(req, res)
            } catch (e) {
              server.ssrFixStacktrace(e as Error)
              next(e)
            }
          })
        }
      },
    }
  }

  function getAllPagesCoveredExtensions() {
    const honoDefaults = new Set(["jsx", "ts", "js", "tsx"])

    integrations.forEach((integration) => {
      integration.getPagesExtensions?.().forEach((ext) => honoDefaults.add(ext))
    })

    return [...honoDefaults].map((ext) => `.${ext}`)
  }

  function devManifestPlugin(): Plugin {
    const virtualModuleId = "virtual:openauth/custom-ui/dev-manifest"
    const resolvedVirtualModuleId = "\0" + virtualModuleId
    let viteServer: ViteDevServer

    return {
      name: "openauth-dev-manifest",
      configureServer(server) {
        viteServer = server
      },
      resolveId(id) {
        if (id === virtualModuleId) {
          return resolvedVirtualModuleId
        }
      },
      handleHotUpdate({ server }) {
        const virtualMod = server.moduleGraph.getModuleById(
          resolvedVirtualModuleId,
        )
        if (virtualMod) {
          server.moduleGraph.invalidateModule(virtualMod)
        }
      },
      async load(id) {
        if (id === resolvedVirtualModuleId) {
          if (!viteServer) return `export const manifest = {}`

          const entries = getFrontendTargetFiles(
            projectRoot,
            pagesExtensions,
          ).toArray()
          const manifest: Record<string, any> = {}

          for (const entry of entries) {
            const url = entry.startsWith("/") ? entry : `/${entry}`

            try {
              await viteServer.transformRequest(url)
            } catch (e) {
              console.warn(`[OpenAuth] Failed to transform ${url}`, e)
              continue
            }

            const mod = await viteServer.moduleGraph.getModuleByUrl(url)
            if (!mod) continue

            const css = new Set<string>()
            const assets = new Set<string>()
            const imports = new Set<string>()

            const seen = new Set()
            const traverse = (node: any, isRoot = false) => {
              if (seen.has(node)) return
              seen.add(node)

              if (node.url && !isRoot) {
                const cleanUrl = node.url.split("?")[0].replace(/^\//, "")

                if (cleanUrl.match(/\.(css|scss|sass|less|styl)$/)) {
                  css.add(cleanUrl)
                } else if (
                  cleanUrl.match(/\.(woff|woff2|eot|ttf|svg|png|jpg|jpeg|ico)$/)
                ) {
                  assets.add(cleanUrl)
                } else if (cleanUrl.match(/\.(js|ts|jsx|tsx|mjs)$/)) {
                  imports.add(cleanUrl)
                }
              }
              node.importedModules?.forEach((child: any) => traverse(child))
            }

            traverse(mod, true)

            const cleanEntry = entry.replace(/^\//, "")
            manifest[cleanEntry] = {
              file: cleanEntry,
              src: cleanEntry,
              isEntry: true,
              css: Array.from(css),
              assets: Array.from(assets),
              imports: Array.from(imports),
            }
          }

          return `export const manifest = ${JSON.stringify(manifest)};`
        }
      },
    }
  }

  function setViteDevConfig(server: ViteDevServer) {
    server.httpServer?.once("listening", () => {
      setTimeout(() => {
        const localUrl = server.resolvedUrls?.local[0]

        if (!localUrl) {
          console.error("Unable to create vite local server URL.")
          return
        }

        const cleanUrl = localUrl.replace(/\/$/, "")
        process.env.OPENAUTH_DEV_URL = cleanUrl

        const devConfig = {
          viteServerUrl: cleanUrl,
        }

        const configDir = `${projectRoot}/.openauth`
        mkdirSync(configDir, { recursive: true })

        writeFileSync(
          `${configDir}/devconfig.json`,
          JSON.stringify(devConfig, null, 2),
        )
      })
    })
  }

  function virtualComponentsRouterPlugin(): Plugin {
    return {
      name: "openauth-virtual-components-router",
      resolveId(id: string) {
        if (id === "virtual:openauth/custom-ui/components") {
          return "\0virtual:openauth/custom-ui/components"
        }
      },
      load(id) {
        if (id === "\0virtual:openauth/custom-ui/components") {
          const frontendFiles = getFrontendTargetFiles(
            projectRoot,
            pagesExtensions,
          ).toJson()
          const backendFiles = getBackendTargetFiles(
            projectRoot,
            pagesExtensions,
          ).toJson()

          const allTargetFiles = { ...frontendFiles, ...backendFiles }

          let pagesCode = `export const pages = {\n`
          let mainCode = `export const main = null;\n`
          let layoutCode = `export const layout = null;\n`

          for (const [logicalPath, relativeFilePath] of Object.entries(
            allTargetFiles,
          )) {
            const absolutePath = resolve(projectRoot, relativeFilePath)
              .split("\\")
              .join("/")
            this.addWatchFile(absolutePath)

            const extension = pagesExtensions.find((ext) =>
              relativeFilePath.endsWith(ext),
            )

            if (extension) {
              const importPath = isSSR ? absolutePath : `/${relativeFilePath}`

              const nodeCode = `{
              load: () => import("${importPath}").then((m) => ({
                ...m,
                Component: m.default
              })),
              moduleSourcePath: "${relativeFilePath}",
              moduleSourceExtension: "${extension}"
            }`

              if (logicalPath.startsWith("src/pages/")) {
                const route = logicalPath.replace("src/pages/", "")
                pagesCode += `  "${route}": ${nodeCode},\n`
              } else if (logicalPath === "src/main") {
                mainCode = `export const main = ${nodeCode};\n`
              } else if (logicalPath === "src/layout") {
                layoutCode = `export const layout = ${nodeCode};\n`
              }
            }
          }

          pagesCode += `};\n\n`

          return pagesCode + mainCode + layoutCode
        }
      },
    }
  }
}
