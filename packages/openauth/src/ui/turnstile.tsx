/** @jsxImportSource hono/jsx */

import { TurnstileOptions } from "../turnstile.js"

export function TurnstileScript() {
  return (
    <script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js"
      async
      defer
    />
  )
}

export function TurnstileWidget(props: {
  siteKey: string
  action?: string
  widget?: TurnstileOptions["widget"]
}) {
  return (
    <div
      class="cf-turnstile"
      data-sitekey={props.siteKey}
      data-action={props.action}
      data-theme={props.widget?.theme}
      data-size={props.widget?.size}
      data-appearance={props.widget?.appearance}
      data-retry={props.widget?.retry}
      data-refresh-expired={props.widget?.refreshExpired}
    />
  )
}

