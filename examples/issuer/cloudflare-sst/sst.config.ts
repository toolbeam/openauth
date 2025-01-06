/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "openauth-example-cloudflare",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "cloudflare",
    }
  },
  async run() {
    // cloudflare
    const kv = new sst.cloudflare.Kv("CloudflareAuthKV")
    const auth = new sst.cloudflare.Worker("CloudflareAuth", {
      handler: "./issuer.ts",
      link: [kv],
      url: true,
    })

    return {
      url: auth.url,
    }
  },
})
