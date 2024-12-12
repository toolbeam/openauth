export { createSubjects } from "./session.js"
export { authorizer } from "./authorizer.js"
export {
  /**
   * @deprecated
   * Use `import { createClient } from "@openauthjs/openauth/client"` instead - it will tree shake better
   */
  createClient,
} from "./client.js"
