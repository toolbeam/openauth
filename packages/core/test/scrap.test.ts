import { expect, test } from "bun:test";
import { authorizer } from "../src/authorizer.js";
import { MemoryStorage } from "../src/storage/memory.js";
import { createClient, createSubjects } from "../src/index.js";
import { object, string } from "valibot";

const subjects = createSubjects({
  user: object({
    userID: string(),
  }),
});

const auth = authorizer({
  storage: MemoryStorage(),
  subjects,
  allow: async () => true,
  success: async (ctx) => {
    return ctx.subject("user", {
      userID: "123",
    });
  },
  ttl: {
    access: 1,
  },
  providers: {
    dummy: {
      type: "dummy",
      init(route, ctx) {
        route.get("/authorize", async (c) => {
          return ctx.success(c, {
            email: "foo@bar.com",
          });
        });
      },
    },
  },
});

test("code flow", async () => {
  const client = createClient({
    issuer: "https://auth.example.com",
    clientID: "123",
    fetch: (a, b) => Promise.resolve(auth.request(a, b)),
  });
  const [verifier, authorization] = await client.pkce(
    "https://client.example.com/callback",
  );
  let response = await auth.request(authorization);
  expect(response.status).toBe(302);
  response = await auth.request(response.headers.get("location")!, {
    headers: {
      cookie: response.headers.get("set-cookie")!,
    },
  });
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location")!);
  const code = location.searchParams.get("code");
  expect(code).not.toBeNull();
  const tokens = await client.exchange(
    code!,
    "https://client.example.com/callback",
    verifier,
  );
  expect(tokens.access).toBeTruthy();
  expect(tokens.refresh).toBeTruthy();
  const verified = await client.verify(subjects, tokens.access);
  expect(verified.subject.type).toBe("user");
  if (verified.subject.type !== "user") throw new Error("Invalid subject");
  expect(verified.subject.properties.userID).toBe("123");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  expect(client.verify(subjects, tokens.access)).rejects.toThrow();
  const next = await client.verify(subjects, tokens.access, {
    refresh: tokens.refresh,
  });
  expect(next.access).toBeDefined();
  expect(next.refresh).toBeDefined();
  expect(next.access).not.toEqual(tokens.access);
  expect(next.refresh).not.toEqual(tokens.refresh);
  await client.verify(subjects, next.access!);
});
