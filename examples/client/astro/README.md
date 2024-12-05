# OpenAuth Astro Client

The files to note are
- `src/auth.ts` - creates the client that is used to interact with the auth server
- `src/middleware.ts` - middleware that runs to verify access tokens, refresh them if out of date, and redirect the user to the auth server if they are not logged in
- `src/pages/callback.ts` - the callback endpoint that receives the auth code and exchanges it for an access/refresh token
