import type { MatcherOptions, SSRRenderer } from "@openauthjs/core/custom-ui"
import type {
  PasswordConfig,
  PasswordChangeState,
  PasswordChangeError,
  PasswordLoginError,
  PasswordRegisterError,
  PasswordRegisterState,
} from "../../provider/password.js"
import { mergePageStream, serializeFormData } from "./util.js"
import { DefaultLayout } from "./layout.js"
import { renderers } from "virtual:openauth/custom-ui/renderers"
import { layout, pages } from "virtual:openauth/custom-ui/components"
import { renderHeadTags } from "@openauthjs/vite/head"
import { HEAD_PLACEHOLDER } from "@openauthjs/core/custom-ui/util.js"
import { JSX } from "hono/jsx/jsx-runtime"
export interface RenderContext {
  req: Request
  state?: PasswordRegisterState | PasswordChangeState
  form?: FormData
  error?: PasswordLoginError | PasswordRegisterError | PasswordChangeError
}

export interface PasswordLoaderResult {
  data: Record<string, unknown>
  responseInit?: ResponseInit
}

export interface CustomPasswordUIOptions
  extends Pick<
    PasswordConfig,
    "sendCode" | "validatePassword" | "length" | "hasher"
  > {
  loader?: {
    [K in "register" | "login" | "change"]: (
      ...args: Parameters<PasswordConfig[K]>
    ) => PasswordLoaderResult | Promise<PasswordLoaderResult>
  }
}

function validateRoutes() {
  const requiredRoutes = ["register", "login", "change"]
  const allRoutes = Object.keys(pages)

  const missingRoutes = requiredRoutes.filter(
    (route) => !allRoutes.includes(route),
  )

  const missingPaths = missingRoutes.map((route) => `src/pages/${route}.ext`)

  if (missingRoutes.length > 0) {
    const fileString = missingPaths.length === 1 ? 'file is' : "files are"

    throw new Error(`${missingPaths.join(", ")} ${fileString} missing`)
  }
}

async function renderRouteComponent(
  route: string,
  context: RenderContext,
  loadData: () => PasswordLoaderResult | Promise<PasswordLoaderResult>,
) {
  let matchedRenderer: {
    renderer: SSRRenderer<unknown, RenderContext>
    config: unknown
  } = null!

  const options: MatcherOptions<RenderContext> = {
    route,
    context,
  }
  const renderersList = (renderers || []) as SSRRenderer<
    unknown,
    RenderContext
  >[]
  for (const renderer of renderersList) {
    const match = await renderer.match(options)
    if (match === false) continue

    if (matchedRenderer) {
      console.error(
        `Renderer Conflict: Renderer ${renderer.name} is conflicting with renderer ${matchedRenderer.renderer.name}. Only ${matchedRenderer.renderer.name} will be used`,
      )

      continue
    }

    matchedRenderer = {
      renderer: renderer,
      config: match,
    }
  }

  const { data: loaderData, responseInit } = await loadData()

  const contextServerData = {
    loaderData,
    state: context.state,
    form: context.form ? serializeFormData(context.form) : undefined,
    error: context.error,
  }

  const Shell = await layout
    .load<() => JSX.Element>()
    .then((m) => m.Component)
    .catch(() => DefaultLayout)

  const shell = <Shell />

  const ssrStream = await matchedRenderer.renderer.render(
    contextServerData,
    matchedRenderer.config,
  )

  const resolvedShell = await shell
  let htmlString = resolvedShell.toString()
  const headTags = await renderHeadTags(route, contextServerData)

  htmlString = htmlString.replace(HEAD_PLACEHOLDER, headTags.toString())
  const stream = await mergePageStream(htmlString, ssrStream)

  const headers = new Headers(responseInit?.headers)
  headers.set("Content-Type", "text/html")
  headers.set("Transfer-Encoding", "chunked")

  return new Response(stream, {
    ...responseInit,
    status: 200,
    headers,
  })
}

const DEFAULT_LOADER_RESULT = {
  data: {},
}

export function CustomPasswordUI(
  input: CustomPasswordUIOptions,
): PasswordConfig {
  validateRoutes()

  return {
    ...input,
    register: async (req, state, form, error): Promise<Response> => {
      return renderRouteComponent(
        "register",
        {
          req,
          state,
          form,
          error,
        },
        () =>
          input.loader?.register(req, state, form, error) ??
          DEFAULT_LOADER_RESULT,
      )
    },
    change: async (req, state, form, error): Promise<Response> => {
      return renderRouteComponent(
        "change",
        {
          req,
          state,
          form,
          error,
        },
        () =>
          input.loader?.change(req, state, form, error) ??
          DEFAULT_LOADER_RESULT,
      )
    },
    login: async (req, form, error): Promise<Response> => {
      return renderRouteComponent(
        "login",
        {
          req,
          form,
          error,
        },
        () => input.loader?.login(req, form, error) ?? DEFAULT_LOADER_RESULT,
      )
    },
  }
}
