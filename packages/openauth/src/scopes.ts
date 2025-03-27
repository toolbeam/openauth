export function parseScopes(scope: string | null | undefined) {
  return scope?.split(" ").filter((s) => s)
}

export function validateScopes(tokenReq?: string | null, authorizeReq?: string[]) {
  if (!authorizeReq?.length || tokenReq === null || tokenReq === undefined) {
    return authorizeReq
  }
  return [...new Set(parseScopes(tokenReq)).intersection(new Set(authorizeReq))]
}
