/** @jsxImportSource react */
import { renderToReadableStream } from "react-dom/server"
import React from "react";
import { SSRRenderer } from "@openauthjs/core/custom-ui"
import { AuthContext } from "./context.js"
import { pages } from "virtual:openauth/custom-ui/components"
import type { ComponentType } from "react"

export function react(): SSRRenderer<ComponentType<{}>> {
  return {
    name: "react",
    async match(options) {
      const acceptedExtensions = [".tsx", ".ts", ".jsx", ".js"]
      const { moduleSourceExtension, load } = pages[options.route]

      if (!acceptedExtensions.includes(moduleSourceExtension)) {
        return false
      }

      return load<ComponentType>().then((m) => m.Component)
    },
    async render(context, Page) {
      const authContext = { ...context }
      const loaderData = context.loaderData ?? {}
      delete authContext.loaderData

      return renderToReadableStream(
        <AuthContext.Provider value={authContext}>
          <openauth-react-root style={{ display: "contents" }}>
            <Page {...loaderData} />
          </openauth-react-root>
        </AuthContext.Provider>,
      )
    },
  }
}
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "openauth-react-root": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >
    }
  }
}
