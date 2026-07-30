import { OPENAUTH_CONTEXT_DATA_ID } from "@openauthjs/core/custom-ui/util/shared.js"
import type { Context } from "@openauthjs/core/custom-ui/types.js"
import { pages } from "virtual:openauth/custom-ui/components"
import type { ComponentType } from "react"
import React from "react"
import { AuthContext } from "./context.js"
import { hydrateRoot } from "react-dom/client"

/**
 * Hydrates the server-rendered OpenAuth custom UI in the browser.
 * This should be called in your client entrypoint file.
 *
 * @example
 * ```tsx title="src/main.tsx"
 * import { hydrate } from "@openauthjs/react"
 *
 * hydrate()
 * ```
 *
 */
export function hydrate() {
  const contextDataScript = document.getElementById(
    OPENAUTH_CONTEXT_DATA_ID,
  ) as HTMLScriptElement

  let contextData: {
    route: string
    contextData: Context
  }
  try {
    contextData = JSON.parse(contextDataScript.textContent!)
  } catch (error) {
    throw Error(
      "Error while hydrating the client: Please setup OpenAuth Custom Auth Client correctly",
    )
  }

  const root = document.getElementsByTagName("openauth-react-root")[0]

  if (!root) {
    throw new Error(
      "Hydration root not founded. Did you setup the react plugin correctly?",
    )
  }
  const authData = { ...contextData.contextData }
  const loaderData = authData.loaderData ?? {}
  delete authData.loaderData

  pages[contextData.route].load<ComponentType>().then(({ Component }) => {
    hydrateRoot(
      root,
      <AuthContext.Provider value={authData}>
        <Component {...loaderData} />
      </AuthContext.Provider>,
    )
  })
}
