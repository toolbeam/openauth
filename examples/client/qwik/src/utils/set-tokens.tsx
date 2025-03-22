import { type Cookie } from "@builder.io/qwik-city";

export default function (cookie: Cookie, access: string, refresh: string) {
    cookie.set("refresh_token", refresh, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 34560000,
    });
    cookie.set("access_token", access, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 34560000,
    });
}