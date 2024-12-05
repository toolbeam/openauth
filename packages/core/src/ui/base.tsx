import { PropsWithChildren } from "hono/jsx";
import css from "./ui.css" assert { type: "text" };
import { getTheme } from "./theme.js";

export function Layout(
  props: PropsWithChildren<{
    size?: "small";
  }>,
) {
  const theme = getTheme();
  function get(key: "primary" | "background" | "logo", mode: "light" | "dark") {
    if (!theme) return;
    if (!theme[key]) return;
    if (typeof theme[key] === "string") return theme[key];

    return theme[key][mode] as string | undefined;
  }

  const radius = (() => {
    if (theme?.radius === "none") return "0";
    if (theme?.radius === "sm") return "1";
    if (theme?.radius === "md") return "1.25";
    if (theme?.radius === "lg") return "1.5";
    if (theme?.radius === "full") return "1000000000001";
    return "1";
  })();

  return (
    <html
      style={{
        "--color-background-light": get("background", "light"),
        "--color-background-dark": get("background", "dark"),
        "--color-primary-light": get("primary", "light"),
        "--color-primary-dark": get("primary", "dark"),
        "--font-family": theme?.font?.family,
        "--font-scale": theme?.font?.scale,
        "--border-radius": radius,
      }}
    >
      <head>
        <title>{theme?.title || "OpenAuthJS"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href={theme?.favicon} />
        <style dangerouslySetInnerHTML={{ __html: css }} />
        {theme?.css && (
          <style dangerouslySetInnerHTML={{ __html: theme.css }} />
        )}
      </head>
      <body>
        <div data-component="root">
          <div data-component="center" data-size={props.size}>
            <img
              data-component="logo"
              src={get("logo", "light")}
              data-mode="light"
            />
            <img
              data-component="logo"
              src={get("logo", "dark")}
              data-mode="dark"
            />
            {props.children}
          </div>
        </div>
      </body>
    </html>
  );
}
