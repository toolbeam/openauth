import type { RequestHandler } from "@builder.io/qwik-city";
import { createClient } from "@openauthjs/openauth/client";
export { subjects } from "../../../../subjects"
import setTokens from "../utils/set-tokens";

export const onRequest: RequestHandler = async ({
    next,
    url,
    redirect,
    cookie,
    platform,
    sharedMap,
}) => {
    const client = createClient({
        clientID: "qwik-client",
        // enables worker to worker communication if issuer is also a worker
        fetch: (input, init) => platform.env.OPENAUTH_ISSUER_WORKER.fetch(input, init),
        issuer: platform.env.OPENAUTH_ISSUER_URL
    });

    sharedMap.set("@client", client);

    // -- Guard on admin routes
    if (url.pathname.startsWith("/admin")) {
        const authorizeUrl = `${url.origin}/authorize`;
        const accessToken = cookie.get("access_token");

        if (accessToken) {
            const refreshToken = cookie.get("refresh_token");
            const verified = await client.verify(subjects, accessToken.value, {
                refresh: refreshToken?.value,
            });

            if (!verified.err) {
                if (verified.tokens) {
                    setTokens(cookie, verified.tokens.access, verified.tokens.refresh);
                }
                sharedMap.set("@session", verified);
                return next();
            }
            throw redirect(302, authorizeUrl);
        }
        throw redirect(302, authorizeUrl);
    }
    await next();
};
