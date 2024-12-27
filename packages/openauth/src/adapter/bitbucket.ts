import { Oauth2Adapter, Oauth2WrappedConfig } from "./oauth2.js"

/**
 * Represents the various scopes that can be used for Bitbucket API access.
 * 
 * A descriptor lacking the scopes element is implicitly assumed to require all scopes and as a result, Bitbucket will require end users authorizing/installing the add-on to explicitly accept all scopes.
 * 
 * - `project`: Read access to projects.
 * - `project:write`: Write access to projects.
 * - `project:admin`: Admin access to projects.
 * - `repository`: Read access to repositories.
 * - `repository:write`: Write access to repositories.
 * - `repository:admin`: Admin access to repositories.
 * - `repository:delete`: Delete access to repositories.
 * - `pullrequest`: Read access to pull requests.
 * - `pullrequest:write`: Write access to pull requests.
 * - `issue`: Read access to issues.
 * - `issue:write`: Write access to issues.
 * - `wiki`: Access to wikis.
 * - `webhook`: Access to webhooks.
 * - `snippet`: Read access to snippets.
 * - `snippet:write`: Write access to snippets.
 * - `email`: Access to email addresses.
 * - `account`: Read access to account information.
 * - `account:write`: Write access to account information.
 * - `pipeline`: Read access to pipelines.
 * - `pipeline:write`: Write access to pipelines.
 * - `pipeline:variable`: Access to pipeline variables.
 * - `runner`: Read access to runners.
 * - `runner:write`: Write access to runners.
 * 
 * @see {@link https://developer.atlassian.com/cloud/bitbucket/rest/intro/#authentication}
 */
type Scope = 
    | "project"
    | "project:write"
    | "project:admin"
    | "repository"
    | "repository:write"
    | "repository:admin"
    | "repository:delete"
    | "pullrequest"
    | "pullrequest:write"
    | "issue"
    | "issue:write"
    | "wiki"
    | "webhook"
    | "snippet"
    | "snippet:write"
    | "email"
    | "account"
    | "account:write"
    | "pipeline"
    | "pipeline:write"
    | "pipeline:variable"
    | "runner"
    | "runner:write"

/**
 * Configuration interface for Bitbucket OAuth2 integration.
 * 
 * @extends Oauth2WrappedConfig
 * 
 * @property {Scope[]} scopes - An array of scopes that specify the permissions requested from the user.
 */
export interface BitbucketConfig extends Oauth2WrappedConfig {
    scopes: Scope[]
}

/**
 * Creates an OAuth2 adapter configured for Bitbucket.
 *
 * This function configures an OAuth2 adapter specifically for Bitbucket by
 * providing the necessary authorization and token endpoints.
 * 
 * @see {@link https://developer.atlassian.com/cloud/bitbucket/rest/intro/#authentication}
 */
export function BitbucketAdapter(config: BitbucketConfig) {
  return Oauth2Adapter({
    ...config,
    type: "bitbucket",
    endpoint: {
      authorization: "https://bitbucket.org/site/oauth2/authorize",
      token: "https://bitbucket.org/site/oauth2/access_token",
    },
  })
}