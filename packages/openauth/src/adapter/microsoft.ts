import { Oauth2Adapter, Oauth2WrappedConfig } from "./oauth2.js"
import { OidcAdapter, OidcWrappedConfig } from "./oidc.js"

export interface MicrosoftConfig extends Oauth2WrappedConfig {
  tenant: string
}

export function MicrosoftAdapter(config: MicrosoftConfig) {
  return Oauth2Adapter({
    ...config,
    type: "microsoft",
    endpoint: {
      authorization: `https://login.microsoftonline.com/${config?.tenant}/oauth2/v2.0/authorize`,
      token: `https://login.microsoftonline.com/${config?.tenant}/oauth2/v2.0/token`,
    },
  })
}

export function MicrosoftOidcAdapter(config: OidcWrappedConfig) {
  return OidcAdapter({
    ...config,
    type: "microsoft",
    issuer: "https://graph.microsoft.com/oidc/userinfo",
  })
}