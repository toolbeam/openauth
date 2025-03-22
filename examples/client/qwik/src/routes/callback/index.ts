import type { RequestHandler } from "@builder.io/qwik-city";
import setTokens from "../../utils/set-tokens";

export const onGet: RequestHandler = async ({
    cookie,
    query,
    url,
    redirect,
    sharedMap,
}) => {
    const client = sharedMap.get("@client");
    const code = query.get("code");

    if (client && code) {
        const exchanged = await client.exchange(code, `${url.origin}/callback`);
        if (exchanged.err) throw new Error("Invalid code");

        setTokens(cookie, exchanged.tokens.access, exchanged.tokens.refresh);
        throw redirect(302, `${url.origin}/admin`);
    }
};
