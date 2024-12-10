import { login } from "~/auth";
import type { Route } from "./+types/login";

export function loader({ request }: Route.LoaderArgs) {
  return login(request)
}
