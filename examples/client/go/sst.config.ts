/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "openauth",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",

      providers: {
        aws: {
          region: "us-east-1",
        },
      },
    }
  },
  async run() {
    const auth = new sst.aws.Auth("Auth", {
      issuer: "./issuer.handler",
    })

    const apiGo = new sst.aws.Function("ApiGo", {
      url: true,
      runtime: "go",
      handler: "./src",
      link: [auth],
    })
  },
})
