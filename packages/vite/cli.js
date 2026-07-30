#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, copyFileSync, mkdirSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

function getViteBinPath() {
  try {
    const vitePkgPath = require.resolve("vite/package.json")
    const vitePkg = JSON.parse(readFileSync(vitePkgPath, "utf-8"))

    const binPath =
      typeof vitePkg.bin === "string" ? vitePkg.bin : vitePkg.bin.vite

    return join(dirname(vitePkgPath), binPath)
  } catch (error) {
    console.error(
      "Failed to locate the 'vite' binary. Ensure it is installed as a dependency.",
    )
    process.exit(1)
  }
}

const viteBin = getViteBinPath()

function runViteDev() {
  spawnSync(
    process.execPath,
    [viteBin, "dev", "--config", "openauth.config.ts"],
    { stdio: "inherit", env: { ...process.env, NODE_ENV: "development" } },
  )
}

function getServerEntry(argPath) {
  if (argPath) return argPath

  const pkgPath = resolve(process.cwd(), "package.json")
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
      if (pkg.main) {
        return pkg.main
      }
    } catch (error) {}
  }

  return "src/server/issuer.ts"
}

function runViteBuild(serverEntry) {
  console.log("Starting OpenAuth frontend build...")

  const clientBuild = spawnSync(
    process.execPath,
    [viteBin, "build", "--config", "openauth.config.ts"],
    {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    },
  )

  if (clientBuild.status !== 0) {
    console.error("\nFrontend build failed. Aborting.")
    process.exit(1)
  }

  console.log(`\nStarting OpenAuth backend build (Entry: ${serverEntry})...`)
  process.env.OPENAUTH_SSR_ENTRY = serverEntry

  const serverBuild = spawnSync(
    process.execPath,
    [viteBin, "build", "--config", "openauth.config.ts", "--ssr"],
    {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    },
  )

  if (serverBuild.status !== 0) {
    console.error("\nBackend build failed.")
    process.exit(1)
  }

  copyManifestFile()
  console.log("\nBuild completed successfully!")

  function copyManifestFile() {
    const manifestSrc = resolve(
      process.cwd(),
      ".openauth/build/client/.vite/manifest.json",
    )
    const manifestDest = resolve(
      process.cwd(),
      ".openauth/build/server/manifest.json",
    )

    if (existsSync(manifestSrc)) {
      const destDir = dirname(manifestDest)
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }

      copyFileSync(manifestSrc, manifestDest)
    } else {
      console.warn(`\nWarning: Manifest not found at ${manifestSrc}`)
    }
  }
}

// --- CLI Execution ---

const [command, arg] = process.argv.slice(2)

if (command !== "dev" && command !== "build") {
  console.log("Usage:")
  console.log("  openauth dev")
  console.log("  openauth build [server-entry]")
  process.exit(1)
}

if (command === "dev") {
  runViteDev()
} else if (command === "build") {
  const serverEntry = getServerEntry(arg)
  runViteBuild(serverEntry)
}
