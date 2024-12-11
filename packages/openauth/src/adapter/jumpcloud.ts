import { Oauth2Adapter, Oauth2WrappedConfig } from "./oauth2.js"

export function JumpCloudAdapter(config: Oauth2WrappedConfig) {
  return Oauth2Adapter({
    type: "jumpcloud",
    ...config,
    endpoint: {
      authorization: "https://oauth.id.jumpcloud.com/oauth2/auth",
      token: "https://oauth.id.jumpcloud.com/oauth2/token",
    },
  });
}
