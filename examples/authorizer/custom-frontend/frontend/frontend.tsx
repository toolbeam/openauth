/** @jsx jsx */
/** @jsxImportSource hono/jsx */

import { Hono } from "hono"
import { PropsWithChildren } from "hono/jsx"

function Layout(props: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Authorizer</title>
      </head>
      <body>{props.children}</body>
    </html>
  )
}

const app = new Hono()
  .get("/auth/start", async (c) => {
    return c.html(
      <Layout>
        <h1>Authorizer</h1>
        <form method="post" action="http://localhost:3000/code/authorize">
          <input type="hidden" name="action" value="request" />
          <label for="email">Email</label>
          <input type="email" name="email" id="email" />
          <button type="submit">Request</button>
        </form>
      </Layout>,
    )
  })
  .get("/auth/code", async (c) => {
    return c.html(
      <Layout>
        <h1>Code</h1>
        <form method="post" action="http://localhost:3000/code/authorize">
          <input type="hidden" name="action" value="verify" />
          <label for="code">Code</label>
          <input
            type="text"
            name="code"
            id="code"
            minLength={6}
            maxLength={6}
          />
          <button type="submit">Verify</button>
        </form>
      </Layout>,
    )
  })

export default {
  port: 3001,
  fetch: app.fetch,
}
