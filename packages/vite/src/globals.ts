import { readFile } from "node:fs/promises"
import { join } from "node:path"

let manifest: Record<
  string,
  {
    file: string
    src: string
    isEntry: boolean
    css: string[]
    assets: string[]
    imports: string[]
  }
> = null!

export async function getManifest() {
  if (!manifest && !isDevServer()) {
    try {
      const manifestPath = join(process.cwd(), "manifest.json")
      manifest = JSON.parse(await readFile(manifestPath, "utf-8"))
    } catch (error) {
      throw new Error(
        "Missing manifest file. The issuer function is not set up correctly.",
      )
    }
  }

  if (!manifest && isDevServer()) {
    const { manifest: devManifest } = await import("virtual:openauth/custom-ui/dev-manifest")
    manifest = devManifest
  }

  return {
    raw: manifest,
    find(matcher: (file: string) => boolean) {
      const key = Object.keys(manifest).find((key) => matcher(key))

      if (!key) return null

      return {
        files: manifest[key as keyof typeof manifest],
        source: key,
      }
    },
  }
}

type OpenAuthViteEnvKeys = "OPENAUTH_DEV_URL"

export function getEnv(key: OpenAuthViteEnvKeys, required = true) {
  const value = process.env[key]

  if (!value && required)
    throw new Error(
      `Missing ${key} environment variable. The issuer function is not set up correctly.`,
    )

  return value
}

export const isDevServer = () => !!getEnv("OPENAUTH_DEV_URL", false)
