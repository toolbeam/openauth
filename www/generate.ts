import * as path from "path"
import * as fs from "fs"
import * as TypeDoc from "typedoc"
import config from "./config"

let warnings = 0
const OUTPUT_DIR = "src/content/docs/docs"
type Text = string | Text[]

configureLogger()
const project = await build()
const modules = project.getChildrenByKind(TypeDoc.ReflectionKind.Module)
const subject = modules.find((m) => m.name === "subject")!
const issuer = modules.find((m) => m.name === "issuer")!
const error = modules.find((m) => m.name === "error")!
const client = modules.find((m) => m.name === "client")!
const uis = modules.filter((m) => m.name.startsWith("ui/"))
const providers = modules.filter((m) => m.name.startsWith("provider/"))
const storages = modules.filter((m) => m.name.startsWith("storage/"))

const FRONTMATTER: Record<
  string,
  { title: string; editUrl: string; description: string }
> = {
  themeUI: {
    title: "Themes",
    description: "Reference docs for themes.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/ui/theme.ts`,
  },
  passwordUI: {
    title: "PasswordUI",
    description: "Reference doc for the `PasswordUI`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/ui/password.tsx`,
  },
  codeUI: {
    title: "CodeUI",
    description: "Reference doc for the `CodeUI`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/ui/code.tsx`,
  },
  selectUI: {
    title: "Select",
    description: "Reference doc for the `Select` UI.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/ui/select.tsx`,
  },
  dynamo: {
    title: "DynamoDB",
    description: "Reference doc for the DynamoDB storage adapter.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/storage/dynamo.ts`,
  },
  memory: {
    title: "Memory",
    description: "Reference doc for the Memory storage adapter.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/storage/memory.ts`,
  },
  cloudflare: {
    title: "Cloudflare KV",
    description: "Reference doc for the Cloudflare KV storage adapter.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/storage/cloudflare.ts`,
  },
  issuer: {
    title: "Issuer",
    description: "Reference doc for the OpenAuth server.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/issuer.ts`,
  },
  subject: {
    title: "Subject",
    description: "Reference doc for creating subjects.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/subject.ts`,
  },
  client: {
    title: "Client",
    description: "Reference doc for the OpenAuth client.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/client.ts`,
  },
  apple: {
    title: "AppleProvider",
    description: "Reference doc for the `AppleProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/apple.ts`,
  },
  google: {
    title: "GoogleProvider",
    description: "Reference doc for the `GoogleProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/google.ts`,
  },
  x: {
    title: "XProvider",
    description: "Reference doc for the `XProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/x.ts`,
  },
  yahoo: {
    title: "YahooProvider",
    description: "Reference doc for the `YahooProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/yahoo.ts`,
  },
  github: {
    title: "GithubProvider",
    description: "Reference doc for the `GithubProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/github.ts`,
  },
  microsoft: {
    title: "MicrosoftProvider",
    description: "Reference doc for the `MicrosoftProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/microsoft.ts`,
  },
  password: {
    title: "PasswordProvider",
    description: "Reference doc for the `PasswordProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/password.ts`,
  },
  keycloak: {
    title: "KeycloakProvider",
    description: "Reference doc for the `KeycloakProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/keycloak.ts`,
  },
  slack: {
    title: "SlackProvider",
    description: "Reference doc for the `SlackProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/slack.ts`,
  },
  jumpcloud: {
    title: "JumpCloudProvider",
    description: "Reference doc for the `JumpCloudProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/jumpcloud.ts`,
  },
  spotify: {
    title: "SpotifyProvider",
    description: "Reference doc for the `SpotifyProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/spotify.ts`,
  },
  discord: {
    title: "DiscordProvider",
    description: "Reference doc for the `DiscordProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/discord.ts`,
  },
  cognito: {
    title: "CognitoProvider",
    description: "Reference doc for the `CognitoProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/cognito.ts`,
  },
  facebook: {
    title: "FacebookProvider",
    description: "Reference doc for the `FacebookProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/facebook.ts`,
  },
  twitch: {
    title: "TwitchProvider",
    description: "Reference doc for the `TwitchProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/twitch.ts`,
  },
  oidc: {
    title: "OidcProvider",
    description: "Reference doc for the `OidcProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/oidc.ts`,
  },
  oauth2: {
    title: "Oauth2Provider",
    description: "Reference doc for the `Oauth2Provider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/oauth2.ts`,
  },
  code: {
    title: "CodeProvider",
    description: "Reference doc for the `CodeProvider`.",
    editUrl: `${config.github}/blob/master/packages/openauth/src/provider/code.ts`,
  },
}

renderSubject()
renderClient()
renderIssuer()
providers.map(renderProvider)
storages.map(renderStorage)
uis.map(renderUI)
printWarnings()

function renderProvider(module: TypeDoc.DeclarationReflection) {
  console.debug(`renderProvider: ${module.name}`)

  const name = module.name.replace("provider/", "")
  const { title, editUrl, description } = FRONTMATTER[name] || {}
  saveFile(module.name, [
    renderHeader({
      title: title || name,
      moduleName: module.name,
      editUrl: editUrl || false,
      description: description || `A page for the ${name} provider.`,
    }),
    `<div class="tsdoc">`,
    renderAbout(renderComment(module)),
    renderFunctions(module),
    renderInterfaces(module),
    `</div>`,
  ])
}

function renderStorage(module: TypeDoc.DeclarationReflection) {
  console.debug(`renderStorage: ${module.name}`)

  const name = module.name.replace("storage/", "")
  const { title, editUrl, description } = FRONTMATTER[name] || {}
  saveFile(module.name, [
    renderHeader({
      title: title || name,
      moduleName: module.name,
      editUrl: editUrl || false,
      description: description || `A page for the ${name} storage.`,
    }),
    `<div class="tsdoc">`,
    renderAbout(renderComment(module)),
    renderFunctions(module),
    renderInterfaces(module),
    `</div>`,
  ])
}

function renderUI(module: TypeDoc.DeclarationReflection) {
  console.debug(`renderUI: ${module.name}`)

  const name = module.name.replace("ui/", "")
  const { title, editUrl, description } = FRONTMATTER[`${name}UI`] || {}
  saveFile(module.name, [
    renderHeader({
      title: title || name,
      moduleName: module.name,
      editUrl: editUrl || false,
      description: description || `A page for the ${name} UI.`,
    }),
    `<div class="tsdoc">`,
    renderAbout(renderComment(module)),
    renderVariables(module, { title: "Themes" }),
    renderFunctions(module),
    renderInterfaces(module),
    `</div>`,
  ])
}

function renderSubject() {
  console.debug(`renderSubject`)

  const module = subject
  const name = module.name
  const { title, editUrl, description } = FRONTMATTER[name] || {}
  saveFile(name, [
    renderHeader({
      title,
      editUrl,
      description,
      moduleName: module.name,
    }),
    `<div class="tsdoc">`,
    renderAbout(renderComment(module)),
    renderFunctions(module),
    renderInterfaces(module),
    `</div>`,
  ])
}

function renderClient() {
  console.debug(`renderClient`)

  const module = client
  const name = module.name
  const { title, editUrl, description } = FRONTMATTER[name] || {}
  saveFile(name, [
    renderHeader({
      title: title || name,
      moduleName: module.name,
      editUrl: editUrl || false,
      description: description || `A page for the client.`,
    }),
    `<div class="tsdoc">`,
    renderAbout(renderComment(module)),
    renderFunctions(module),
    renderInterfaces(module, {
      filter: (i) => i.name === "Client",
      depth: "h3",
    }),
    renderInterfaces(module, {
      filter: (i) => i.name !== "Client",
    }),
    `</div>`,
  ])
}

function renderIssuer() {
  console.debug(`renderIssuer`)

  const errors = error.getChildrenByKind(TypeDoc.ReflectionKind.Class)
  const name = issuer.name
  const { title, editUrl, description } = FRONTMATTER[name] || {}
  saveFile(name, [
    renderHeader({
      title,
      editUrl,
      description,
      moduleName: issuer.name,
    }),
    `<div class="tsdoc">`,
    renderAbout(renderComment(issuer)),
    renderFunctions(issuer),
    renderInterfaces(issuer),
    "## Errors",
    renderAbout(renderComment(error)),
    errors.map(renderClass),
    `</div>`,
  ])
}

function renderHeader(input: {
  moduleName: string
  title: string
  editUrl: string | boolean
  description: string
}) {
  const relativePath = path.relative(
    path.dirname(path.join(OUTPUT_DIR, `${input.moduleName}.mdx`)),
    "src/components/tsdoc",
  )
  return [
    `---`,
    `title: ${input.title}`,
    `editUrl: ${input.editUrl}`,
    `description: ${input.description}`,
    `---`,
    "",
    `import Segment from '${relativePath}/Segment.astro';`,
    `import Section from '${relativePath}/Section.astro';`,
    `import NestedTitle from '${relativePath}/NestedTitle.astro';`,
    `import InlineSection from '${relativePath}/InlineSection.astro';`,
    `import { Tabs, TabItem } from '@astrojs/starlight/components';`,
    "",
  ]
}

function renderAbout(content: Text) {
  console.debug(` ∟renderAbout`)
  return [`<Section type="about">`, content, `</Section>`, "---"]
}

function renderClass(c: TypeDoc.DeclarationReflection) {
  console.debug(`   ∟class: ${c.name}`)
  return [`### ${c.name}`, `<Segment>`, renderComment(c), `</Segment>`]
}

function renderVariables(
  module: TypeDoc.DeclarationReflection,
  options: {
    title: string
  },
) {
  console.debug(` ∟renderVariables`)
  const variables = module.getChildrenByKind(TypeDoc.ReflectionKind.Variable)
  return render(variables.length, [
    `## ${options.title}`,
    variables.map((v) => {
      console.debug(`   ∟variable: ${v.name}`)
      return [`### ${v.name}`, `<Segment>`, renderComment(v), `</Segment>`]
    }),
  ])
}

function renderFunctions(module: TypeDoc.DeclarationReflection) {
  console.debug(` ∟renderFunctions`)
  const functions = module.getChildrenByKind(TypeDoc.ReflectionKind.Function)
  return render(functions.length, [
    "## Methods",
    ...functions.map((f) => {
      console.debug(`   ∟function: ${f.name}`)
      return [
        `### ${f.name}`,
        `<Segment>`,
        `<Section type="signature">`,
        renderSignatureAsCode(f.signatures![0]),
        `</Section>`,
        render(f.signatures![0].parameters?.length, [
          `<Section type="parameters">`,
          `#### Parameters`,
          f.signatures![0].parameters!.map((p) => {
            return [
              `- <p><code class="key">${renderParameter(p)}</code> ${renderType(p.type!)}</p>`,
              renderComment(p),
            ]
          }),
          `</Section>`,
        ]),
        `<InlineSection>`,
        `**Returns** ${renderType(f.signatures![0].type!)}`,
        `</InlineSection>`,
        renderComment(f.signatures![0]),
        `</Segment>`,
      ]
    }),
  ])
}

function renderInterfaces(
  module: TypeDoc.DeclarationReflection,
  options?: {
    filter?: (i: TypeDoc.DeclarationReflection) => boolean
    depth?: "h2" | "h3"
  },
) {
  console.debug(` ∟renderInterfaces`)
  const depth = options?.depth ?? "h2"
  const interfaces = [
    ...module.getChildrenByKind(TypeDoc.ReflectionKind.Interface),
    ...module.getChildrenByKind(TypeDoc.ReflectionKind.TypeAlias),
  ]
    .filter(options?.filter ?? (() => true))
    .sort((a, b) => a.name.localeCompare(b.name))

  return interfaces.map((i) => {
    // render type alias as a type
    if (i.kindOf(TypeDoc.ReflectionKind.TypeAlias)) {
      return [
        `## ${i.name}`,
        `<Segment>`,
        `<Section type="parameters">`,
        `<InlineSection>`,
        `**Type** ${renderType(i.type!)}`,
        `</InlineSection>`,
        `</Section>`,
        renderComment(i),
        `</Segment>`,
      ]
    }
    // render interface as a type
    else {
      console.debug(`   ∟interface: ${i.name}`)
      const properties = i.getChildrenByKind(TypeDoc.ReflectionKind.Property)
      const methods = i.getChildrenByKind(TypeDoc.ReflectionKind.Method)
      return [
        `## ${i.name}`,
        `<Segment>`,
        render(depth === "h2", [
          `<Section type="parameters">`,
          properties.map((p) => [
            `- <p>[<code class="key">${renderProperty(p)}</code>](#${buildLinkHash(i.name, p.name)}) ${renderType(p.type!)}</p>`,
            flattenNestedTypes(p.type!, p.name).map(
              ({ depth, prefix, subType }) =>
                `${" ".repeat(depth * 2)}- <p>[<code class="key">${renderProperty(
                  subType,
                )}</code>](#${buildLinkHash(prefix, subType.name)}) ${renderType(subType.type!)}</p>`,
            ),
          ]),
          methods.map((m) => {
            return `- <p>[<code class="key">${renderProperty(m)}</code>](#${buildLinkHash(i.name, m.name)}) ${renderSignatureAsType(m.signatures![0])}</p>`
          }),
          `</Section>`,
        ]),
        renderComment(i),
        `</Segment>`,
        // Render nested types
        properties.flatMap((p) => [
          `<NestedTitle id="${buildLinkHash(i.name, p.name)}" Tag="h4" parent="${i.name}.">${renderProperty(p)}</NestedTitle>`,
          `<Segment>`,
          `<Section type="parameters">`,
          `<InlineSection>`,
          `**Type** ${renderType(p.type!)}`,
          `</InlineSection>`,
          `</Section>`,
          renderComment(p),
          `</Segment>`,
          flattenNestedTypes(p.type!, p.name).map(
            ({ depth, prefix, subType }) => [
              `<NestedTitle id="${buildLinkHash(prefix, subType.name)}" Tag="h5" parent="${i.name}.${prefix}.">${renderProperty(subType)}</NestedTitle>`,
              `<Segment>`,
              `<Section type="parameters">`,
              `<InlineSection>`,
              `**Type** ${renderType(subType.type!)}`,
              `</InlineSection>`,
              `</Section>`,
              renderComment(subType),
              `</Segment>`,
            ],
          ),
        ]),
        methods.flatMap((m) => [
          depth === "h2"
            ? `<NestedTitle id="${buildLinkHash(i.name, m.name)}" Tag="h4" parent="${i.name}.">${renderProperty(m)}</NestedTitle>`
            : `### ${m.name}`,
          `<Segment>`,
          `<Section type="parameters">`,
          `<InlineSection>`,
          `**Type** ${renderSignatureAsType(m.signatures![0])}`,
          `</InlineSection>`,
          `</Section>`,
          renderComment(m.signatures![0]),
          `</Segment>`,
        ]),
      ]
    }
  })
}

function renderComment(declaration: TypeDoc.Reflection) {
  if (!declaration.comment) return []

  return [
    declaration instanceof TypeDoc.DeclarationReflection &&
    declaration.defaultValue
      ? [
          ``,
          `<InlineSection>`,
          `**Default** ${renderType({
            type: "literal",
            value: declaration.defaultValue.replace(/"/g, ""),
          } as TypeDoc.LiteralType)}`,
          `</InlineSection>`,
        ]
      : [],
    declaration.comment.blockTags
      .filter((tag) => tag.tag === "@default")
      .map((tag) => {
        return [
          ``,
          `<InlineSection>`,
          // If default tag is just a value, render it as a type ie. false
          // Otherwise render it as a comment ie. No domains configured
          tag.content.length === 1 && tag.content[0].kind === "code"
            ? `**Default** ${renderType(
                new TypeDoc.IntrinsicType(
                  tag.content[0].text
                    .replace(/`/g, "")
                    .replace(/{/g, "&lcub;")
                    .replace(/}/g, "&rcub;"),
                ),
              )}`
            : `**Default** ${tag.content.map((c) => c.text)}`,
          `</InlineSection>`,
        ]
      }),
    declaration.comment.summary.map((s) => s.text).join(""),
    declaration.comment.blockTags
      .filter((tag) => tag.tag === "@example")
      .map((tag) => tag.content.map((c) => c.text)),
  ]
}

function renderSignatureAsCode(signature: TypeDoc.SignatureReflection) {
  const parameters = (signature.parameters ?? []).map(renderParameter)
  return ["```ts", `${signature.name}(${parameters})`, "```"]
}

function renderSignatureAsType(signature: TypeDoc.SignatureReflection) {
  const parameters = (signature.parameters ?? [])
    .map(
      (parameter) =>
        `${renderParameter(parameter)}: ${
          // If the type is an object, render it inline
          parameter.type?.type === "reflection" &&
          parameter.type.declaration.kind === TypeDoc.ReflectionKind.TypeLiteral
            ? renderObjectTypeInline(parameter.type)
            : renderType(parameter.type!)
        }`,
    )
    .join(", ")
  return `<code class="primitive">(${parameters}) => ${renderType(
    signature.type!,
  )}</code>`
}

function renderParameter(parameter: TypeDoc.ParameterReflection) {
  if (parameter.defaultValue && parameter.defaultValue !== "{}") {
    throw new Error(
      [
        `Unsupported default value "${parameter.defaultValue}" for name "${parameter.name}".`,
        ``,
        `Function signature parameters can be defined as optional in one of two ways:`,
        ` - flag.isOptional is set, ie. "(args?: FooArgs)"`,
        ` - defaultValue is set, ie. "(args: FooArgs = {})`,
        ``,
        `But in this case, the default value is not "{}". Hence not supported.`,
      ].join("\n"),
    )
  }

  return [
    parameter.type?.type === "tuple" ? "..." : "",
    parameter.name,
    parameter.flags.isOptional || parameter.defaultValue ? "?" : "",
  ].join("")
}

function renderProperty(property: TypeDoc.DeclarationReflection) {
  return `${property.name}${property.flags.isOptional ? "?" : ""}`
}

function renderType(type: TypeDoc.SomeType): Text {
  // Special handle hard-to-document types
  if (
    type.type === "reference" &&
    type.package === "@openauthjs/openauth" &&
    type.qualifiedName === "IssuerInput.Result"
  )
    return `<code class="type">${type.name}</code>`

  // Special handle hard-to-document types
  if (type.type === "indexedAccess") {
    if (
      type.indexType.type === "typeOperator" &&
      type.indexType.target.type === "reference" &&
      type.indexType.target.qualifiedName === "VerifyResult.T"
    )
      return `<code class="type">Subject</code>`
  }

  if (type.type === "intrinsic") return renderIntrisicType(type)
  if (type.type === "literal") return renderLiteralType(type)
  if (type.type === "templateLiteral") return renderTemplateLiteralType(type)
  if (type.type === "union") return renderUnionType(type)
  if (type.type === "array") return renderArrayType(type)
  if (type.type === "reference") {
    if (type.package === "typescript") return renderTypescriptType(type)
    if (type.package === "@openauthjs/openauth") return renderOpenAuthType(type)
    if (type.package === "@standard-schema/spec")
      return renderStandardSchemaType(type)
    return `<code class="type">${type.name}</code>`
  }
  if (
    type.type === "reflection" &&
    type.declaration.kind === TypeDoc.ReflectionKind.TypeLiteral
  ) {
    if (type.declaration.signatures) return renderCallbackType(type)
    return `<code class="primitive">Object</code>`
  }
  console.warn(`🟡️ WARNING: rendering "${type.type}" type as any`)
  return `<code class="primitive">any</code>`
}
function renderIntrisicType(type: TypeDoc.IntrinsicType) {
  return `<code class="primitive">${type.name}</code>`
}
function renderLiteralType(type: TypeDoc.LiteralType) {
  // Intrisic values: don't print in quotes
  // ie.
  // {
  //   "type": "literal",
  //   "value": false
  // }
  if (type.value === true || type.value === false) {
    return `<code class="primitive">${type.value}</code>`
  }
  // String value
  // ie.
  // {
  //   "type": "literal",
  //   "value": "arm64"
  // }
  const sanitized =
    typeof type.value === "string"
      ? type.value!.replace(/([*:])/g, "\\$1")
      : type.value
  return `<code class="symbol">&ldquo;</code><code class="primitive">${sanitized}</code><code class="symbol">&rdquo;</code>`
}
function renderTemplateLiteralType(type: TypeDoc.TemplateLiteralType) {
  // ie. memory: `${number} MB`
  // {
  //   "type": "templateLiteral",
  //   "head": "",
  //   "tail": [
  //     [
  //       {
  //         "type": "intrinsic",
  //         "name": "number"
  //       },
  //       " MB"
  //     ]
  //   ]
  // },
  if (
    typeof type.head !== "string" ||
    type.tail.length !== 1 ||
    type.tail[0].length !== 2 ||
    type.tail[0][0].type !== "intrinsic" ||
    typeof type.tail[0][1] !== "string"
  ) {
    console.error(type)
    throw new Error(`Unsupported templateLiteral type`)
  }
  return `<code class="symbol">&ldquo;</code><code class="primitive">${type.head}$\\{${type.tail[0][0].name}\\}${type.tail[0][1]}</code><code class="symbol">&rdquo;</code>`
}
function renderUnionType(type: TypeDoc.UnionType) {
  return type.types
    .map((t) => {
      // Handle discriminated unions
      if (
        t.type === "reflection" &&
        t.declaration.kind === TypeDoc.ReflectionKind.TypeLiteral &&
        t.declaration.children
      ) {
        return renderObjectTypeInline(t)
      }
      return renderType(t)
    })
    .join(`<code class="symbol"> | </code>`)
}
function renderArrayType(type: TypeDoc.ArrayType) {
  return type.elementType.type === "union"
    ? `<code class="symbol">(</code>${renderType(
        type.elementType,
      )}<code class="symbol">)[]</code>`
    : `${renderType(type.elementType)}<code class="symbol">[]</code>`
}
function renderCallbackType(type: TypeDoc.ReflectionType) {
  return renderSignatureAsType(type.declaration.signatures![0])
}
function renderObjectTypeInline(type: TypeDoc.ReflectionType): Text {
  return [
    `<code class="symbol">&lcub; </code>`,
    type.declaration
      .children!.map((c) =>
        [
          `<code class="key">${c.name}</code>`,
          `<code class="symbol">&colon; </code>`,
          // If rendering inline, also render children inline
          c.type?.type === "reflection" &&
          c.type.declaration.kind === TypeDoc.ReflectionKind.TypeLiteral
            ? renderObjectTypeInline(c.type)
            : renderType(c.type!),
        ].join(""),
      )
      .join(`<code class="symbol">, </code>`),
    `<code class="symbol"> &rcub;</code>`,
  ].join("")
}
function renderTypescriptType(type: TypeDoc.ReferenceType) {
  // ie. Partial<Foo> => just render Foo
  if (type.name === "Partial") return renderType(type.typeArguments![0])

  // ie. Record<string, string>
  return [
    `<code class="primitive">${type.name}</code>`,
    `<code class="symbol">&lt;</code>`,
    type.typeArguments?.map((t) => renderType(t)).join(", "),
    `<code class="symbol">&gt;</code>`,
  ].join("")
}
function renderOpenAuthType(type: TypeDoc.ReferenceType) {
  // Reference to a non-documented type, ie. FetchLike
  if (!type.reflection) return `<code class="type">${type.name}</code>`

  // Reference to a generic type
  // ie.
  // export function createSubjects<Schema extends SubjectSchema>(types: Schema): Schema {
  //   return { ...types }
  // }
  if (type.reflection.kind === TypeDoc.ReflectionKind.TypeParameter) {
    const t = (type.reflection as TypeDoc.TypeParameterReflection).type
    if (t) return renderType(t)
  }

  if (
    type.reflection.kind === TypeDoc.ReflectionKind.TypeAlias ||
    type.reflection.kind === TypeDoc.ReflectionKind.Interface ||
    type.reflection.kind === TypeDoc.ReflectionKind.Class
  ) {
    const t = type.reflection as TypeDoc.DeclarationReflection
    const fileName = t.sources?.[0]?.fileName
    if (fileName?.startsWith("packages/openauth/src/subject.ts"))
      return `[<code class="type">${t.name}</code>](/docs/subject#${t.name.toLowerCase()})`
    if (fileName?.startsWith("packages/openauth/src/error.ts"))
      return `[<code class="type">${t.name}</code>](/docs/issuer#${t.name.toLowerCase()})`
    if (fileName?.startsWith("packages/openauth/src/provider/")) {
      const provider = fileName.split("/").pop()?.split(".")[0]
      return `[<code class="type">${t.name}</code>](/docs/provider/${provider}#${t.name.toLowerCase()})`
    }
  }

  return `[<code class="type">${type.name}</code>](#${type.name.toLowerCase()})`
}
function renderStandardSchemaType(type: TypeDoc.ReferenceType) {
  return `[<code class="type">${type.name}</code>](https://github.com/standard-schema/standard-schema)`
}

function render(condition: any, content: Text) {
  return condition ? content : []
}

function buildLinkHash(namespace: string, name: string) {
  return `${namespace}.${name}`.toLowerCase()
}

function flattenNestedTypes(
  type: TypeDoc.SomeType,
  prefix: string,
  depth: number = 1,
): {
  subType: TypeDoc.DeclarationReflection
  prefix: string
  depth: number
}[] {
  if (type.type === "union") {
    return type.types.flatMap((t) => flattenNestedTypes(t, prefix, depth))
  }
  if (type.type === "array") {
    return flattenNestedTypes(type.elementType, `${prefix}[]`, depth)
  }
  if (type.type === "reference") {
    return (type.typeArguments ?? []).flatMap((t) =>
      type.package === "typescript" && type.name === "Record"
        ? flattenNestedTypes(t, `${prefix}[]`, depth)
        : flattenNestedTypes(t, prefix, depth),
    )
  }
  if (type.type === "reflection" && type.declaration.children?.length) {
    return type.declaration
      .children!.filter((c) => !c.comment?.modifierTags.has("@internal"))
      .filter((c) => !c.comment?.blockTags.find((t) => t.tag === "@deprecated"))
      .flatMap((subType) => [
        { prefix, subType, depth },
        ...(subType.kind === TypeDoc.ReflectionKind.Property
          ? flattenNestedTypes(
              subType.type!,
              `${prefix}.${subType.name}`,
              depth + 1,
            )
          : []),
        ...(subType.kind === TypeDoc.ReflectionKind.Accessor
          ? flattenNestedTypes(
              subType.getSignature?.type!,
              `${prefix}.${subType.name}`,
              depth + 1,
            )
          : []),
      ])
  }

  return []
}

/********************/
/** Other functions */
/********************/

function saveFile(moduleName: string, content: any[]) {
  const filePath = path.join(OUTPUT_DIR, `${moduleName}.mdx`)
  if (!fs.existsSync(path.dirname(filePath)))
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content.flat(Infinity).join("\n"))
}

function configureLogger() {
  if (process.env.DEBUG) {
    console.warn = (...args) => {
      warnings++
      console.log(...args)
    }
    return
  }

  console.debug = () => {}
  console.warn = () => {}
}

function printWarnings() {
  if (process.env.DEBUG) {
    console.log(`- - -\n${warnings} warnings`)
  }
}

async function build() {
  // Generate project reflection
  const app = await TypeDoc.Application.bootstrap({
    excludeInternal: true,
    // Ignore type errors caused by patching `Input<>`.
    skipErrorChecking: true,
    // Disable parsing @default tags as ```ts block code.
    jsDocCompatibility: {
      defaultTag: false,
    },

    entryPoints: [
      "../packages/openauth/src/provider/code.ts",
      "../packages/openauth/src/provider/apple.ts",
      "../packages/openauth/src/provider/google.ts",
      "../packages/openauth/src/provider/github.ts",
      "../packages/openauth/src/provider/password.ts",
      "../packages/openauth/src/provider/oauth2.ts",
      "../packages/openauth/src/provider/oidc.ts",
      "../packages/openauth/src/provider/slack.ts",
      "../packages/openauth/src/provider/spotify.ts",
      "../packages/openauth/src/provider/twitch.ts",
      "../packages/openauth/src/provider/yahoo.ts",
      "../packages/openauth/src/provider/microsoft.ts",
      "../packages/openauth/src/provider/keycloak.ts",
      "../packages/openauth/src/provider/jumpcloud.ts",
      "../packages/openauth/src/provider/facebook.ts",
      "../packages/openauth/src/provider/discord.ts",
      "../packages/openauth/src/provider/cognito.ts",
      "../packages/openauth/src/provider/x.ts",
      "../packages/openauth/src/subject.ts",
      "../packages/openauth/src/ui/theme.ts",
      "../packages/openauth/src/ui/code.tsx",
      "../packages/openauth/src/ui/select.tsx",
      "../packages/openauth/src/ui/password.tsx",
      "../packages/openauth/src/client.ts",
      "../packages/openauth/src/issuer.ts",
      "../packages/openauth/src/storage/memory.ts",
      "../packages/openauth/src/storage/dynamo.ts",
      "../packages/openauth/src/storage/cloudflare.ts",
      "../packages/openauth/src/error.ts",
    ],
    tsconfig: "../packages/openauth/tsconfig.json",
  })

  const project = await app.convert()
  if (!project) throw new Error("Failed to convert project")

  // Generate JSON (generated for debugging purposes)
  await app.generateJson(project, "output/doc.json")

  return project
}

function print(type: TypeDoc.SomeType) {
  // @ts-ignore
  delete type._project
  console.log(type)
}
