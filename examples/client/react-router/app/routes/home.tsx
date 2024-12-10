import { tryAuth } from "~/auth";
import type { Route } from "./+types/home";
import { data, Form, Link } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await tryAuth(request)
  if (!auth) {
    return { user: null }
  }
  return data({ user: auth.subject }, { headers: auth.headers })
}

export default function Page({ loaderData }: Route.ComponentProps) {
  if (!loaderData.user) {
    return (
      <div>
        <p>You are not authorized.</p>
        <Link to="/login">Login</Link>
      </div>
    )
  }

  return (
    <div>
      <p>Hello {loaderData.user.properties.email}</p>
      <Form method="POST" action="/logout">
        <button type="submit">Logout</button>
      </Form>
    </div>
  )
}
