import { existsSync, readdirSync } from "node:fs"
import { resolve, parse } from "node:path"

export const STREAM_PLACEHOLDER = "<open-auth-stream></open-auth-stream>"
export const HEAD_PLACEHOLDER = `<script type="openauth/headers-placeholder"></script>`

export function matchFileExtension(extensions: string[], path: string) {
  return extensions.some((ext) => path.endsWith(ext))
}

export function getExistingFilesFromDirectory(
  projectRoot: string,
  directoryPath: string,
  possibleFileNames: string[],
  possibleExtensions: string[],
) {
  const directory = resolve(projectRoot, directoryPath)

  const includedFiles: Record<string, string> = {}

  if (existsSync(directory)) {
    const files = readdirSync(directory)

    possibleFileNames.forEach((name) => {
      const matchedFile = files.find(
        (file) =>
          parse(file).name === name &&
          matchFileExtension(possibleExtensions, file),
      )

      if (matchedFile) {
        includedFiles[`${directoryPath}/${name}`] =
          `${directoryPath}/${matchedFile}`
      }
    })
  }

  return includedFiles
}

export function getExistingFiles(
  projectRoot: string,
  directoryFilesMap: Record<string, string[]>,
  possibleExtensions: string[],
) {
  let result: Record<string, string> = {}

  for (const key in directoryFilesMap) {
    let includedFiles = getExistingFilesFromDirectory(
      projectRoot,
      key,
      directoryFilesMap[key],
      possibleExtensions,
    )

    Object.assign(result, includedFiles)
  }

  return {
    toArray: () => Object.values(result),
    toJson: () => result,
  }
}

export function getFrontendTargetFiles(
  projectRoot: string,
  possibleExtensions: string[],
) {
  return getExistingFiles(
    projectRoot,
    {
      "src/pages": ["register", "login", "change"],
      src: ["main"],
    },
    possibleExtensions,
  )
}

export function getBackendTargetFiles(
  projectRoot: string,
  possibleExtensions: string[],
) {
  return getExistingFiles(
    projectRoot,
    {
      "src/pages": ["register", "login", "change"],
      src: ["layout"],
    },
    possibleExtensions,
  )
}
