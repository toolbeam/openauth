import { client, setTokens } from "../../auth";
import type { Route } from "./+types/callback";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  try {
    const tokens = await client.exchange(code!, url.origin + "/callback");
    const headers = await setTokens(tokens.access, tokens.refresh);
    headers.append("Location", "/");
    return new Response(null, {
      headers,
      status: 302,
    })
  } catch (e) {
    return Response.json(e, {
      status: 400,
    });
  }
}
