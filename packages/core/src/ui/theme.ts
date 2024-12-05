export interface Theme {
  title?: string;
  favicon?: string;
  radius?: "none" | "sm" | "md" | "lg" | "full";
  primary:
    | string
    | {
        dark: string;
        light: string;
      };
  background?:
    | string
    | {
        dark: string;
        light: string;
      };
  logo?:
    | string
    | {
        dark: string;
        light: string;
      };
  font?: {
    family?: string;
    scale?: string;
  };
  css?: string;
}

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
};

export const THEME_SST: Theme = {
  title: "SST",
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
};

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
    @import url('https://fonts.googleapis.com/css2?family=Varela Round:wght@100;200;300;400;500;600;700;800;900&display=swap');
  `,
};

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
};

// i really don't wanna use async local storage for this so get over it

let theme: Theme = THEME_SST;

export function setTheme(value: Theme) {
  theme = value;
}

export function getTheme() {
  return theme;
}
