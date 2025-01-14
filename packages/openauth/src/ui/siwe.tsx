import { PublicClient } from "viem"
import { SiweConfig } from "../provider/siwe.js"
import { Layout } from "./base.js"
import { getTheme } from "./theme.js"

export interface SiweUiOptions {
  chainId: number
  client: PublicClient
  statement?: string
  resources?: string[]
  walletConnectProjectId?: string
}

export function SiweUi({
  client,
  chainId,
  statement,
  resources,
  walletConnectProjectId,
}: SiweUiOptions): SiweConfig {
  return {
    client,
    async signin(request, nonce) {
      const theme = getTheme()
      const url = new URL(request.url)
      const jsx = (
        <Layout>
          <div data-component="connectors-list"></div>
          <script
            type="importmap"
            dangerouslySetInnerHTML={{
              __html: `
            {
              "imports": {
                "@wagmi/core": "https://esm.sh/@wagmi/core@^2.16.3",
                "@wagmi/connectors": "https://esm.sh/@wagmi/connectors@^5.7.3?standalone&exports=coinbaseWallet,walletConnect",
                "viem/": "https://esm.sh/viem@^2.22.8/"
              }  
            }
            `,
            }}
          ></script>
          <script
            type="module"
            dangerouslySetInnerHTML={{
              __html: `
            import { createConfig, watchConnectors, http, signMessage, getConnectors } from "@wagmi/core"
            import { coinbaseWallet, walletConnect } from "@wagmi/connectors"
            import { mainnet } from "viem/chains"
            import { createSiweMessage } from "viem/siwe"

            const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches
            const appName = "${theme.title}"
            const appLogoUrl = darkMode ? "${theme.logo.dark}" : "${theme.logo.light}" 

            const config = createConfig({
              chains: [mainnet],
              transports: {
                [mainnet.id]: http()
              },
              connectors: [
                coinbaseWallet({
                  appName,
                  appLogoUrl,
                }),
                ${
                  walletConnectProjectId
                    ? `walletConnect({
                  projectId: "${walletConnectProjectId}",
                  metadata: {
                    name: appName,
                    url: window.location.origin,
                    description: appName,
                    icons: [appLogoUrl]
                  }
                })`
                    : ""
                }
              ]
            })

            const connectors = getConnectors(config)
            populateConnectors(connectors)
            
            async function populateConnectors(connectors) {
              const list = document.querySelector("[data-component=connectors-list]")
              list.innerHTML = ""

              if (connectors.length === 0) {
                list.textContent = "No connectors available"
              } else {
                for (const connector of connectors) {
                  const button = document.createElement("button")
                  button.dataset.component = "button"
                  button.type = "button"
                  if (connector.icon) {
                    const icon = document.createElement("img")
                    icon.src = connector.icon
                    icon.width = 24
                    icon.alt = connector.name
                    button.appendChild(icon)
                  }
                  button.appendChild(document.createTextNode(connector.name))

                  button.addEventListener("click", async () => {
                    const { accounts: [account] } = await connector.connect({ chainId: ${chainId} })
                    const message = createSiweMessage({
                      chainId: ${chainId},
                      address: account,
                      domain: "${url.host}",
                      nonce: "${nonce}",
                      uri: "${url.href}",
                      version: "1",
                      resources: ${JSON.stringify(resources)},
                      ${statement ? `statement: "${statement}",` : ""}
                    })

                    const signature = await signMessage(config, { message, account, connector })

                    await fetch("${url.href}", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ signature, message }),
                    })
                  })

                  list.appendChild(button)
                }
              }
            }
            `,
            }}
          ></script>
        </Layout>
      )
      return new Response(jsx.toString(), {
        headers: {
          "Content-Type": "text/html",
        },
      })
    },
  }
}
