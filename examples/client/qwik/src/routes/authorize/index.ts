import type { RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async ({ redirect, sharedMap, url }) => {
    const client = sharedMap.get("@client");

    const { url: authRedirectUrl } = await client.authorize(
        `${url.origin}/callback`,
        "code",
    );

    throw redirect(302, new URL(authRedirectUrl).toString());
};
