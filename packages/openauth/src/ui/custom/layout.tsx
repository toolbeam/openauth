/** @jsx jsx */
/** @jsxImportSource hono/jsx */
/** @jsxFrag Fragment */
import {
  STREAM_PLACEHOLDER,
  HEAD_PLACEHOLDER,
} from "@openauthjs/core/custom-ui"
import { PropsWithChildren } from "hono/jsx"
import { raw } from "hono/html"

export function Outlet() {
  return raw(STREAM_PLACEHOLDER)
}

export function Head({ children }: PropsWithChildren) {
  return (
    <head>
      {raw(HEAD_PLACEHOLDER)}
      {children}
    </head>
  )
}

export function DefaultLayout() {
  return (
    <html>
      <Head>
        <title>Open Auth React</title>
      </Head>
      <body>
        <Outlet />
      </body>
    </html>
  )
}
