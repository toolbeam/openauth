import { Resource } from "sst";
import { CodeAdapter } from "../../core/src/adapter/code.js";
import { aws } from "../../core/src/authorizer.js";
import { authorizer } from "../../core/src/index.js";
import { DynamoStorage } from "../../core/src/storage/dynamo.js";
import { CodeEnter, CodeStart } from "../../core/src/ui/code.js";
import { subjects } from "../subjects.js";

export const handler = aws(
  authorizer({
    subjects,
    storage: DynamoStorage({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.AWS_SESSION_TOKEN,
      region: "us-east-2",
      table: Resource.AuthTable.name,
      pk: "PK",
      sk: "SK",
    }),
    ttl: {
      access: 60 * 5,
    },
    providers: {
      code: CodeAdapter({
        length: 6,
        onStart: async (req) => {
          return new Response(
            CodeStart({
              mode: "email",
            }),
            {
              headers: {
                "Content-Type": "text/html",
              },
            },
          );
        },
        onCodeRequest: async (code, claims, req) =>
          new Response(CodeEnter({ mode: "email", debugCode: code, claims }), {
            headers: {
              "Content-Type": "text/html",
            },
          }),
        onCodeInvalid: async (_, claims) => {
          return new Response(
            CodeEnter({
              mode: "email",
              error: "Invalid code, try again",
              claims,
            }),
            {
              headers: {
                "Content-Type": "text/html",
              },
            },
          );
        },
      }),
    },
    callbacks: {
      auth: {
        allowClient: async () => true,
        success: async (ctx, value) => {
          console.log("value", value);
          return ctx.session("user", {
            email: value.claims.email,
          });
        },
      },
    },
  }),
);
