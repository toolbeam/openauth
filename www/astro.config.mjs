import theme from "toolbeam-docs-theme"
import starlight from "@astrojs/starlight"
import { defineConfig } from "astro/config"
import { rehypeHeadingIds } from "@astrojs/markdown-remark"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import config from "./config"

const url = "https://openauth.js.org"

// https://astro.build/config
export default defineConfig({
  site: url,
  trailingSlash: "always",
  devToolbar: {
    enabled: false,
  },
  integrations: [
    starlight({
      plugins: [theme()],
      title: "OpenAuth",
      description: "Universal, standards-based auth provider.",
      head: [
        {
          tag: "link",
          attrs: {
            rel: "icon",
            href: "/favicon.ico",
            sizes: "48x48",
          },
        },
        // Add light/dark mode favicon
        {
          tag: "link",
          attrs: {
            rel: "icon",
            href: "/favicon.svg",
            media: "(prefers-color-scheme: light)",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "icon",
            href: "/favicon-dark.svg",
            media: "(prefers-color-scheme: dark)",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: `${url}/social-share.png`,
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "twitter:image",
            content: `${url}/social-share.png`,
          },
        },
      ],
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      social: {
        github: config.github,
        discord: config.discord,
      },
      lastUpdated: true,
      editLink: {
        baseUrl: `${config.github}/edit/master/www/`,
      },
      components: {
        Hero: "./src/components/Hero.astro",
      },
      customCss: ["./src/custom.css", "./src/styles/lander.css"],
      sidebar: [
        { label: "Intro", slug: "docs" },
        {
          label: "Quick Start",
          items: [
            { label: "Standalone", slug: "docs/start/standalone" },
            { label: "SST", slug: "docs/start/sst" },
          ],
        },
        {
          label: "Core",
          items: ["docs/client", "docs/issuer", "docs/subject"],
        },
        {
          label: "Providers",
          items: [
            { label: "Code", slug: "docs/provider/code" },
            { label: "OIDC", slug: "docs/provider/oidc" },
            { label: "OAuth", slug: "docs/provider/oauth2" },
            { label: "Apple", slug: "docs/provider/apple" },
            { label: "X.com", slug: "docs/provider/x" },
            { label: "Slack", slug: "docs/provider/slack" },
            { label: "Yahoo", slug: "docs/provider/yahoo" },
            { label: "Google", slug: "docs/provider/google" },
            { label: "Github", slug: "docs/provider/github" },
            { label: "Twitch", slug: "docs/provider/twitch" },
            { label: "Spotify", slug: "docs/provider/spotify" },
            { label: "Cognito", slug: "docs/provider/cognito" },
            { label: "Discord", slug: "docs/provider/discord" },
            { label: "Facebook", slug: "docs/provider/facebook" },
            { label: "Keycloak", slug: "docs/provider/keycloak" },
            { label: "Password", slug: "docs/provider/password" },
            { label: "Microsoft", slug: "docs/provider/microsoft" },
            { label: "JumpCloud", slug: "docs/provider/jumpcloud" },
          ],
        },
        {
          label: "UI",
          items: [
            "docs/ui/theme",
            "docs/ui/select",
            "docs/ui/code",
            "docs/ui/password",
          ],
        },
        {
          label: "Storage",
          items: [
            "docs/storage/memory",
            "docs/storage/dynamo",
            "docs/storage/cloudflare",
            "docs/storage/unstorage",
          ],
        },
      ],
    }),
  ],
  markdown: {
    rehypePlugins: [
      rehypeHeadingIds,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
    ],
  },
})
