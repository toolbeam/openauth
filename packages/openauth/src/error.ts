export class OauthError extends Error {
  constructor(
    public error:
      | "invalid_request"
      | "invalid_grant"
      | "unauthorized_client"
      | "access_denied"
      | "unsupported_grant_type"
      | "server_error"
      | "temporarily_unavailable",
    public description: string,
    public cause?: unknown,
  ) {
    super(error + " - " + description)
  }
}

export class MissingProviderError extends OauthError {
  constructor() {
    super(
      "invalid_request",
      "Must specify `provider` query parameter if `select` callback on authorizer is not specified",
    )
  }
}

export class MissingParameterError extends OauthError {
  constructor(public parameter: string) {
    super("invalid_request", "Missing parameter: " + parameter)
  }
}

export class UnauthorizedClientError extends OauthError {
  constructor(
    public clientID: string,
    redirectURI: string,
  ) {
    super(
      "unauthorized_client",
      `Client ${clientID} is not authorized to use this redirect_uri: ${redirectURI}`,
    )
  }
}

export class UnknownStateError extends Error {
  public cause?: unknown
  constructor(cause?: unknown) {
    super(
      "The browser was in an unknown state. This could be because certain cookies expired or the browser was switched in the middle of an authentication flow",
    )
    this.cause = cause
  }
}

export class InvalidSubjectError extends Error {
  public cause?: unknown
  constructor(cause?: unknown) {
    super("Invalid subject")
    this.cause = cause
  }
}

export class InvalidRefreshTokenError extends Error {
  public cause?: unknown
  constructor(cause?: unknown) {
    super("Invalid refresh token")
    this.cause = cause
  }
}

export class InvalidAccessTokenError extends Error {
  public cause?: unknown
  constructor(cause?: unknown) {
    super("Invalid access token")
    this.cause = cause
  }
}

export class InvalidAuthorizationCodeError extends Error {
  public cause?: unknown
  constructor(cause?: unknown) {
    super("Invalid authorization code")
    this.cause = cause
  }
}
