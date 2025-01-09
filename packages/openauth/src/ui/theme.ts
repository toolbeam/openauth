/**
 * Use one of the built-in themes.
 *
 * @example
 *
 * ```ts
 * import { THEME_SST } from "@openauthjs/openauth/ui/theme"
 *
 * export default issuer({
 *   theme: THEME_SST,
 *   // ...
 * })
 * ```
 *
 * Or define your own.
 *
 * ```ts
 * import type { Theme } from "@openauthjs/openauth/ui/theme"
 *
 * const MY_THEME: Theme = {
 *   title: "Acne",
 *   radius: "none",
 *   favicon: "https://www.example.com/favicon.svg",
 *   // ...
 * }
 *
 * export default issuer({
 *   theme: MY_THEME,
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */

/**
 * A type to define values for light and dark mode.
 *
 * @example
 * ```ts
 * {
 *   light: "#FFF",
 *   dark: "#000"
 * }
 * ```
 */
export interface ColorScheme {
  /**
   * The value for dark mode.
   */
  dark: string
  /**
   * The value for light mode.
   */
  light: string
}

/**
 * A type to define your custom theme.
 */
export interface Theme {
  /**
   * The name of your app. Also used as the title of the page.
   *
   * @example
   * ```ts
   * {
   *   title: "Acne"
   * }
   * ```
   */
  title?: string
  /**
   * A URL to the favicon of your app.
   *
   * @example
   * ```ts
   * {
   *   favicon: "https://www.example.com/favicon.svg"
   * }
   * ```
   */
  favicon?: string
  /**
   * The border radius of the UI elements.
   *
   * @example
   * ```ts
   * {
   *   radius: "none"
   * }
   * ```
   */
  radius?: "none" | "sm" | "md" | "lg" | "full"
  /**
   * The primary color of the theme.
   *
   * Takes a color or both light and dark colors.
   *
   * @example
   * ```ts
   * {
   *   primary: "#FF5E00"
   * }
   * ```
   */
  primary: string | ColorScheme
  /**
   * The background color of the theme.
   *
   * Takes a color or both light and dark colors.
   *
   * @example
   * ```ts
   * {
   *   background: "#FFF"
   * }
   * ```
   */
  background?: string | ColorScheme
  /**
   * A URL to the logo of your app.
   *
   * Takes a single image or both light and dark mode versions.
   *
   * @example
   * ```ts
   * {
   *   logo: "https://www.example.com/logo.svg"
   * }
   * ```
   */
  logo?: string | ColorScheme
  /**
   * The font family and scale of the theme.
   */
  font?: {
    /**
     * The font family of the theme.
     *
     * @example
     * ```ts
     * {
     *   font: {
     *     family: "Geist Mono, monospace"
     *   }
     * }
     * ```
     */
    family?: string
    /**
     * The font scale of the theme. Can be used to increase or decrease the font sizes across
     * the UI.
     *
     * @default "1"
     * @example
     * ```ts
     * {
     *   font: {
     *     scale: "1.25"
     *   }
     * }
     * ```
     */
    scale?: string
  }
  /**
   * Custom CSS that's added to the page in a `<style>` tag.
   *
   * This can be used to import custom fonts.
   *
   * @example
   * ```ts
   * {
   *   css: `@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@100;200;300;400;500;600;700;800;900&display=swap');`
   * }
   * ```
   */
  css?: string
}

/**
 * Built-in theme based on [Terminal](https://terminal.shop).
 */
export const THEME_TERMINAL: Theme = {
  title: "terminal",
  radius: "none",
  favicon: "https://www.terminal.shop/favicon.svg",
  logo: {
    dark: "https://www.terminal.shop/images/logo-white.svg",
    light: "https://www.terminal.shop/images/logo-black.svg",
  },
  primary: "#ff5e00",
  background: {
    dark: "rgb(0, 0, 0)",
    light: "rgb(255, 255, 255)",
  },
  font: {
    family: "Geist Mono, monospace",
  },
  css: `
    @import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100;200;300;400;500;600;700;800;900&display=swap');
  `,
}

/**
 * Built-in theme based on [SST](https://sst.dev).
 */
export const THEME_SST: Theme = {
  title: "SST",
  favicon: "https://sst.dev/favicon.svg",
  logo: {
    dark: "https://sst.dev/favicon.svg",
    light: "https://sst.dev/favicon.svg",
  },
  background: {
    dark: "#1a1a2d",
    light: "rgb(255, 255, 255)",
  },
  primary: "#f3663f",
  font: {
    family: "Rubik, sans-serif",
  },
  css: `
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@100;200;300;400;500;600;700;800;900&display=swap');
  `,
}

/**
 * Built-in theme based on [Supabase](https://supabase.com).
 */
export const THEME_SUPABASE: Theme = {
  title: "Supabase",
  logo: {
    dark: "https://supabase.com/dashboard/_next/image?url=%2Fdashboard%2Fimg%2Fsupabase-dark.svg&w=128&q=75",
    light:
      "https://supabase.com/dashboard/_next/image?url=%2Fdashboard%2Fimg%2Fsupabase-light.svg&w=128&q=75",
  },
  background: {
    dark: "#171717",
    light: "#f8f8f8",
  },
  primary: {
    dark: "#006239",
    light: "#72e3ad",
  },
  font: {
    family: "Varela Round, sans-serif",
  },
  css: `
    @import url('https://fonts.googleapis.com/css2?family=Varela+Round:wght@100;200;300;400;500;600;700;800;900&display=swap');
  `,
}

/**
 * Built-in theme based on [Vercel](https://vercel.com).
 */
export const THEME_VERCEL: Theme = {
  title: "Vercel",
  logo: {
    dark: "https://vercel.com/mktng/_next/static/media/vercel-logotype-dark.e8c0a742.svg",
    light:
      "https://vercel.com/mktng/_next/static/media/vercel-logotype-light.700a8d26.svg",
  },
  background: {
    dark: "black",
    light: "white",
  },
  primary: {
    dark: "white",
    light: "black",
  },
  font: {
    family: "Geist, sans-serif",
  },
  css: `
    @import url('https://fonts.googleapis.com/css2?family=Geist:wght@100;200;300;400;500;600;700;800;900&display=swap');
  `,
}

// i really don't wanna use async local storage for this so get over it

/**
 * @internal
 */
export function setTheme(value: Theme) {
  // @ts-ignore
  globalThis.OPENAUTH_THEME = value
}

/**
 * @internal
 */
export function getTheme() {
  // @ts-ignore
  return globalThis.OPENAUTH_THEME || THEME_SST
}
