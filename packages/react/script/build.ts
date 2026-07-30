import { Glob, $ } from "bun"
import pkg from "../package.json" // Adju
const externalDeps = [
  ...Object.keys(pkg.peerDependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]

await $`rm -rf dist`
const files = new Glob("./src/**/*.{ts,tsx}").scan()
for await (const file of files) {
  await Bun.build({
    format: "esm",
    outdir: "dist/esm",
    external: [...externalDeps, "*"],
    root: "src",
    entrypoints: [file],
    define: {
      "process.env.NODE_ENV": "process.env.NODE_ENV",
    },
  })
}
await $`tsc --outDir dist/types --declaration --emitDeclarationOnly --declarationMap`
