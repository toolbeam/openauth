import { useEffect, useState } from "react"
import { Button, Platform, Text, View } from "react-native"
import * as WebBrowser from "expo-web-browser"
import {
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from "expo-auth-session"

WebBrowser.maybeCompleteAuthSession()

const redirectUri = makeRedirectUri()

const discovery = {
  authorizationEndpoint: "http://localhost:3000/authorize",
  tokenEndpoint: "http://localhost:3000/token",
}

export default function Index() {
  

  const [authTokens, setAuthTokens] = useState({
    access_token: "",
    refresh_token: "",
  })

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: "clientid",
      usePKCE: true,
      redirectUri: redirectUri,
    },
    discovery,
  )

  useEffect(() => {
    const exchange = async (exchangeTokenReq) => {
      console.log("Exchange Token Request: ", exchangeTokenReq)
      console.log("Code Verifier: ", request?.codeVerifier)
      try {
        const exchangeTokenResponse = await exchangeCodeAsync(
          {
            clientId: "clientid",
            code: exchangeTokenReq,
            redirectUri: redirectUri,
            extraParams: {
              code_verifier: request?.codeVerifier,
            },
          },
          discovery,
        )
        console.log("Exchange Token Response: ", exchangeTokenResponse)
        setAuthTokens(exchangeTokenResponse)
      } catch (error) {
        console.error("error", error)
      }
    }

    if (response) {
      if (response.error) {
        console.error(
          "Authentication error",
          response.params.error_description || "something went wrong",
        )
      }
      if (response.type === "success") {
        exchange(response.params.code)
      }
    }
  }, [discovery, request, response])

  return (
    <View className="flex flex-1 justify-center items-center">
      <View>
        <Button
          title="login"
          onPress={() => {
            promptAsync()
          }}
        />
        <Text>AuthTokens: {JSON.stringify(authTokens)}</Text>
      </View>
    </View>
  )
}
