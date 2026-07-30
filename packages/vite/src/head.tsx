/** @jsxImportSource hono/jsx */
import { OPENAUTH_CONTEXT_DATA_ID } from "@openauthjs/core/custom-ui/util.js"
import { getEnv, getManifest, isDevServer } from "./globals.js"
import { injectedHeadTags } from "virtual:openauth/custom-ui/renderers"
import { Context } from "@openauthjs/core/custom-ui"

/** @internal */
export async function renderHeadTags(route: string, contextData: Context) {
  const baseUrl = isDevServer() ? getEnv("OPENAUTH_DEV_URL") : ""

  const manifest = await getManifest()

  const entryKey = manifest.find((key: string) =>
    key.startsWith(`src/pages/${route}.`),
  )

  const clientKey = manifest.find((key: string) => key.startsWith(`src/main.`))

  if (!entryKey) {
    throw new Error(`Could not find manifest entry for route: ${route}`)
  }

  if (!clientKey) {
    throw new Error(
      `Could not find manifest entry for the client file. Did you created the src/main.[ext]?`,
    )
  }

  const entryFiles = entryKey.files
  const clienEntryFiles = clientKey?.files

  return (
    <>
      {isDevServer() && (
        <script type="module" src={`${baseUrl}/@vite/client`}></script>
      )}
      {/* 1. Framework Hook: Render ANY tags injected by integrations */}
      {injectedHeadTags.map((t: any, index: number) => {
        const Tag = t.tag
        if (t.tag === "style") {
          return (
            <style
              key={`integration-tag-${index}`}
              {...t.props}
              dangerouslySetInnerHTML={{ __html: t.children || "" }}
            />
          )
        }

        if (t.tag === "script") {
          return (
            <script
              key={`integration-tag-${index}`}
              {...t.props}
              dangerouslySetInnerHTML={{ __html: t.children || "" }}
            />
          )
        }

        return (
          <Tag key={`integration-tag-${index}`} {...t.props}>
            {t.children}
          </Tag>
        )
      })}
      {getStaticTags(entryFiles)}
      {getStaticTags(clienEntryFiles!)}
      <script
        id={OPENAUTH_CONTEXT_DATA_ID}
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ route, contextData }),
        }}
      />
    </>
  )

  function getImportsMap(files: Record<string, unknown>) {
    const js = files.file as string
    const css = (files.css as string[]) || []
    const imports = (files.imports as string[]) || []
    const assets = (files.assets as string[]) || []

    return {
      js,
      css,
      imports,
      assets,
    }
  }

  function getStaticTags(files: Record<string, unknown>) {
    const { js, css, imports, assets } = getImportsMap(files)
    return (
      <>
        {assets
          .filter(
            (asset: string) =>
              asset.endsWith(".woff2") || asset.endsWith(".woff"),
          )
          .map((fontFile: string) => (
            <link
              key={fontFile}
              rel="preload"
              href={`${baseUrl}/${fontFile}`}
              as="font"
              type={`font/${fontFile.split(".").pop()}`}
              crossOrigin="anonymous"
            />
          ))}
        {css.map((css: string) => (
          <link key={css} rel="stylesheet" href={`${baseUrl}/${css}`} />
        ))}
        {imports.map((importKey: string) => {
          const chunk = manifest.raw[importKey]
          if (chunk && chunk.file) {
            return (
              <link
                key={chunk.file}
                rel="modulepreload"
                href={`${baseUrl}/${chunk.file}`}
              />
            )
          }
          return null
        })}
        <script type="module" src={`${baseUrl}/${js}`}></script>
      </>
    )
  }
}
