# @openauthjs/openauth

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
