import type { SubjectPayload } from "@openauthjs/core/session";
import { subjects } from "./auth";

declare global {
  declare namespace App {
    interface Locals {
      subject?: SubjectPayload<typeof subjects>;
    }
  }
}
