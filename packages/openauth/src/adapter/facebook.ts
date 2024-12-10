import { Oauth2Adapter, Oauth2WrappedConfig } from "./oauth2.js";
import { OidcAdapter, OidcWrappedConfig } from "./oidc.js";

export function FacebookAdapter(config: Oauth2WrappedConfig) {
  return Oauth2Adapter({
    ...config,
    type: "facebook",
    endpoint: {
      authorization: "https://www.facebook.com/v12.0/dialog/oauth", 
      token: "https://graph.facebook.com/v12.0/oauth/access_token", 
    },
  });
}

export function FacebookOidcAdapter(config: OidcWrappedConfig) {
  return OidcAdapter({
    ...config,
    type: "facebook",
    issuer: "https://graph.facebook.com", 
  });
}
