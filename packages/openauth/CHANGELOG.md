# @openauthjs/openauth

## 0.4.4

### Patch Changes

- 872a4cf: update google icon to comply with branding guidelines
- 4214416: allow auth style autodetection
- e89f282: add linkedin adapter

## 0.4.3

### Patch Changes

- ec8ca65: include expires_in for refresh response

## 0.4.2

### Patch Changes

- a03e510: fix for fetch timeout, wrap everything in lazy

## 0.4.1

### Patch Changes

- 33959c3: better logging on oidc wellknown errors

## 0.4.0

### Minor Changes

- 4e38fa6: feat: Return expires_in from /token endpoint
- fcaafcf: Return signing alg from jwks.json endpoint

### Patch Changes

- 9e3c2ac: Call password validation callback on password reset
- dc40b02: Fix providers client id case from `clientId` to `clientID`

## 0.3.9

### Patch Changes

- 40f6033: enable logger by default
- 3ce40fd: log dynamo error cause

## 0.3.8

### Patch Changes

- c75005b: retry failed dynamo calls

## 0.3.7

### Patch Changes

- 9036544: Add PKCE option to Oauth2Provider
- 8f214e3: Import only hono type in util.ts
- 4cd9e96: add provider logos for apple, x, facebook, microsoft and slack
- 3e3c9e6: Add password validation callback
- f46946c: Add use: sig to jwks.
- 7d39e76: Add way to modify the dynamo ttl attribute name
- 754d776: Supports forwarded protocol and forwarded port in the relative URL
- 1b5525b: add ability to resend verification code during registration

## 0.3.6

### Patch Changes

- f7bd440: Adding a new default openauth theme

## 0.3.5

### Patch Changes

- b22fb30: fix: enable CORS on well-known routes

## 0.3.4

### Patch Changes

- 34ca2b0: remove catch all route so hono instance can be extended

## 0.3.3

### Patch Changes

- 9712422: fix: add charset meta tag to ui/base.tsx
- 92e7170: Adds support for refresh token reuse interval and reuse detection

  Also fixes an issue with token invalidation, where removing keys while scanning
  may cause some refresh tokens to be skipped (depending on storage provider.)

## 0.3.2

### Patch Changes

- 03da3e0: fix issue with oidc adapter

## 0.3.1

### Patch Changes

- 8764ed4: support specify custom subject

## 0.3.0

### Minor Changes

- b2af22a: renamed authorizer -> issuer and adapter -> provider

  this should be a superficial change, but it's a breaking change

  previously you imported adapters like this:

  ```js
  import { PasswordAdapter } from "@openauth/openauth/adapter/password"
  ```

  update it to this:

  ```js
  import { PasswordProvider } from "@openauth/openauth/provider/password"
  ```

  for the authorizer, you import it like this:

  ```js
  import { authorizer } from "@openauth/openauth"
  ```

  update it to this:

  ```js
  import { issuer } from "@openauth/openauth"
  ```

  also subjects should be imported deeply like this:

  ```js
  import { createSubjects } from "@openauth/openauth"
  ```

  update it to this:

  ```js
  import { createSubjects } from "@openauth/openauth/subject"
  ```

## 0.2.7

### Patch Changes

- 3004802: refactor: export `AuthorizationState` for better reusability
- 2975608: switching signing key algorithm to es256. generate seperate keys for symmetrical encryption. old keys will automatically be marked expired and not used
- c92604b: Adds support for a custom DynamoDB endpoint which enables use of a amazon/dynamodb-local container.

  Usabe example:

  ```ts
    storage: DynamoStorage({
      table: 'openauth-users',
      endpoint: 'http://localhost:8000',
    }),
  ```

## 0.2.6

### Patch Changes

- ca0df5d: ui: support phone mode for code ui
- d8d1580: Add slack adapter to the list of available adapters.
- ce44ed6: fix for password adapter not redirecting to the right place after change password flow
- 4940bef: fix: add `node:` prefix for built-in modules

## 0.2.5

### Patch Changes

- 8d6a243: fix: eliminate OTP bias and timing attack vulnerability
- 873d1af: support specifying granular ttl for access/refresh token

## 0.2.4

### Patch Changes

- 8b5f490: feat: Add copy customization to Code UI component

## 0.2.3

### Patch Changes

- 80238de: return aud field when verifying token

## 0.2.2

### Patch Changes

- 6da8647: fix copy for code resend

## 0.2.1

### Patch Changes

- 83125f1: Remove predefined scopes from Spotify adapter to allow user-defined scopes

## 0.2.0

### Minor Changes

- 8c3f050: BREAKING CHANGE: `client.exchange` and `client.authorize` signatures have changed.

  `client.exchange` will now return an `{ err, tokens }` object. check `if (result.err)` for errors.
  `client.authorize` now accepts `pkce: true` as an option. it is now async and returns a promise with `{ challenge, url}`. the `challenge` contains the `state` and `verifier` if using `pkce`

  all exchanges have been updated to reflect this if you would like to reference

### Patch Changes

- 0f93def: refactor: update storage adapters to use Date for expiry

## 0.1.2

### Patch Changes

- 584728f: Add common ColorScheme
- 41acdc2: ui: missing copy in password.tsx
- 2aa531b: Add GitHub Actions workflow for running tests

## 0.1.1

### Patch Changes

- 04cd031: if only single provider is configured, skip provider selection

## 0.1.0

### Minor Changes

- 3c8cdf8: BREAKING CHANGE:

  The api for `client` has changed. It no longer throws errors and instead returns an `err` field that you must check or ignore.

  All the examples have been updated to reflect this change.

## 0.0.26

### Patch Changes

- 5dd6aa4: feature: add twitter adapter

## 0.0.25

### Patch Changes

- 7e3fa38: feat(cognito): add CognitoAdapter
- f496e3a: Set input autocomplete attribute in password UI

## 0.0.24

### Patch Changes

- f695881: feature: added apple adapter

## 0.0.23

### Patch Changes

- a585875: remove console.log
- 079c514: feat: add JumpCloud

## 0.0.22

### Patch Changes

- d3391f4: do not import createClient from root - it causes some bundlers to include too much code

## 0.0.21

### Patch Changes

- acc2c5f: add tests for memory adapter and fixed issues with ttl
- 7630c87: added facebook, discord, and keycloak adapter

## 0.0.20

### Patch Changes

- 1a0ff69: fix for theme not being applied

## 0.0.19

### Patch Changes

- 0864481: allow configuring storage through environment

## 0.0.18

### Patch Changes

- bbf90c5: fix type issues when using ui components

## 0.0.17

### Patch Changes

- f43e320: test
- c10dfdd: test
- c10dfdd: test
- c10dfdd: test
- 2d81677: test changeset

## 0.0.16

### Patch Changes

- 515635f: rename package
