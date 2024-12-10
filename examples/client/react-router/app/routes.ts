import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route('callback', 'routes/auth/callback.ts'),
  route('login', 'routes/auth/login.ts'),
  route('logout', 'routes/auth/logout.ts')
] satisfies RouteConfig;
