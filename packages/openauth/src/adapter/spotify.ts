import { Oauth2Adapter, type Oauth2WrappedConfig } from "./oauth2.js"

export function SpotifyAdapter(config: Oauth2WrappedConfig) {
  return Oauth2Adapter({
    ...config,
    type: "spotify",
    endpoint: {
      authorization: "https://accounts.spotify.com/authorize",
      token: "https://accounts.spotify.com/api/token",
    },
  })
}
