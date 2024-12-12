import { createClient } from "@openauthjs/openauth/client"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

const client = createClient({
  clientID: "react",
  issuer: "http://localhost:3000",
})

let _refresh = localStorage.getItem("refresh")
let _access: string | undefined
async function getToken() {
  if (!_refresh) return
  const next = await client.refresh(_refresh, {
    access: _access,
  })
  if (next.err) return
  if (!next.tokens) return _access
  localStorage.setItem("refresh", next.tokens.refresh)
  _refresh = next.tokens.refresh
  _access = next.tokens.access
  return _access
}

const hash = new URLSearchParams(location.hash.slice(1))
const access = hash.get("access_token")
const refresh = hash.get("refresh_token")
if (access) _access = access
if (refresh) {
  localStorage.setItem("refresh", refresh)
  _refresh = refresh
}
location.hash = ""
const token = await getToken()
if (!token) {
  location.href = client.authorize(location.origin, "token")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

function App() {
  return (
    <button
      onClick={async () => {
        alert(await getToken())
      }}
    >
      See Token
    </button>
  )
}
