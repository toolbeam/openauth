/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "openauth-examples",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "cloudflare",
      providers: { random: "4.16.7", tls: "5.0.9", aws: "6.60.0" },
    };
  },
  async run() {
    // cloudflare
    const kv = new sst.cloudflare.Kv("CloudflareAuthKV");
    const auth = new sst.cloudflare.Worker("CloudflareAuth", {
      handler: "./src/authorizer/cloudflare/authorizer.ts",
      domain: "auth.sst.cheap",
      link: [kv],
      url: true,
    });
    new sst.cloudflare.Worker("CloudflareApi", {
      handler: "./src/client/cloudflare/api.ts",
      url: true,
      link: [auth],
      domain: "api.sst.cheap",
      environment: {
        OPENAUTH_ISSUER: auth.url.apply((v) => v!),
      },
    });

    // lambda
    const table = new sst.aws.Dynamo("LambdaAuthTable", {
      fields: {
        pk: "string",
        sk: "string",
      },
      ttl: "expiry",
      primaryIndex: {
        hashKey: "pk",
        rangeKey: "sk",
      },
    });
    const lambdaAuth = new sst.aws.Function("LambdaAuth", {
      handler: "./src/lambda/authorizer.handler",
      url: true,
      link: [table],
    });

    new sst.aws.Function("LambdaApi", {
      handler: "./src/lambda/api.handler",
      url: true,
      environment: {
        OPENAUTH_ISSUER: lambdaAuth.url.apply((v) => v!.replace(/\/$/, "")),
      },
    });
  },
});
