/**
 * Configure a fully customizable UI for the Password provider using a modern frontend framework (e.g., React) via Vite.
 *
 * ```ts {1,7-24}
 * import { CustomPasswordUI } from "@openauthjs/vite" // Adjust import path if necessary
 * import { PasswordProvider } from "@openauthjs/openauth/provider/password"
 *
 * export default issuer({
 *   providers: {
 *     password: PasswordProvider(
 *       CustomPasswordUI({
 *         sendCode: async (email, code) => {
 *           console.log(email, code);
 *         },
 *         loader: {
 *           login: async () => {
 *             const dbData = await getDataFromDb();
 *
 *             return {
 *               data: dbData,
 *               responseInit: {
 *                 headers: {
 *                   "x-custom-header": "hello",
 *                 },
 *               },
 *             };
 *           },
 *         }
 *       })
 *     )
 *   },
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */

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
/**
 * Configure the custom password UI.
 */
export interface CustomPasswordUIOptions
  extends Pick<
    PasswordConfig,
    "sendCode" | "validatePassword" | "length" | "hasher"
  > {
  /**
   * Optional server-side data loaders for your custom pages.
   * Allows you to fetch data during SSR and pass it to your UI components,
   * or customize the server response (e.g., adding headers).
   */
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
    const fileString = missingPaths.length === 1 ? "file is" : "files are"

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
/**
 * Creates a custom Vite-powered UI for the Password provider flow.
 * @param input - Configure the custom UI and SSR data loaders.
 */
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
