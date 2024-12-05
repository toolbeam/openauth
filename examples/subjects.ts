import { object, string } from "valibot";
import { createSubjects } from "@openauthjs/core";

export const subjects = createSubjects({
  user: object({
    email: string(),
  }),
});
