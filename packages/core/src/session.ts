import type { v1 } from "@standard-schema/spec";
import { Prettify } from "./util.js";

export type SubjectSchema = Record<string, v1.StandardSchema>;

export type SubjectPayload<T extends SubjectSchema> = Prettify<
  {
    [type in keyof T & string]: {
      type: type;
      properties: v1.InferOutput<T[type]>;
    };
  }[keyof T & string]
>;

export function createSubjects<Schema extends SubjectSchema = {}>(
  types: Schema
) {
  return {
    ...types,
  } as Schema;
}
