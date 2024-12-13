This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Make sure your OpenAuth server is running at `http://localhost:3000`.

Then start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser and click **Login with OpenAuth** to start the auth flow.

## Files

- [`app/auth.ts`](app/auth.ts): OpenAuth client and helper to set tokens in cookies.
- [`app/actions.ts`](app/actions.ts): Actions to get current logged in user, and to login and logout.
- [`app/api/callback/route.ts`](app/api/callback/route.ts): Callback route for OpenAuth.
- [`app/page.tsx`](app/page.tsx): Shows login and logout buttons and the current user.
