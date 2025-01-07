import type { SubjectPayload } from "@openauthjs/openauth/subject"
import { subjects } from "./auth"

declare global {
  declare namespace App {
    interface Locals {
      subject?: SubjectPayload<typeof subjects>
    }
  }
}
