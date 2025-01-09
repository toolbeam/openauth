/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "openauth-example-lambda",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    }
  },
  async run() {
    const auth = new sst.aws.Auth("Auth", {
      issuer: "./issuer.handler",
    })
  },
})
