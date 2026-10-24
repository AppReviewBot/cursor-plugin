import { timingSafeEqual } from "node:crypto"

function stateMatches(actual, expected) {
  if (typeof expected !== "string" || !expected) return false
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

/** Parse a loopback callback without reflecting query values or accepting an unrelated request. */
export function parseOAuthCallback(requestUrl, { redirectUri, callbackPath, expectedState }) {
  let url
  try {
    url = new URL(requestUrl ?? "", redirectUri)
  } catch {
    return { status: 400, body: "Invalid callback request.", done: false }
  }
  if (url.pathname !== callbackPath) {
    return { status: 404, body: "Not found.", done: false }
  }

  const states = url.searchParams.getAll("state")
  if (states.length !== 1 || !stateMatches(states[0], expectedState)) {
    return { status: 400, body: "Invalid OAuth state.", done: false }
  }

  // Only the callback for this flow may complete it or expose an authorization code.
  if (url.searchParams.has("error")) {
    return {
      status: 400,
      body: "OAuth authorization failed. You can close this tab.",
      done: true,
      error: "OAuth authorization failed"
    }
  }

  const codes = url.searchParams.getAll("code")
  if (codes.length !== 1 || !codes[0]) {
    return {
      status: 400,
      body: "Missing or ambiguous authorization code. You can close this tab.",
      done: true,
      error: "Missing or ambiguous authorization code"
    }
  }

  return {
    status: 200,
    body: "OAuth callback received. Token exchange is running; you can close this tab.",
    done: true,
    code: codes[0]
  }
}

/** OAuth error bodies and JSON parser errors can contain credentials; keep them out of diagnostics. */
export async function readOAuthResponse(response, operation) {
  if (!response.ok) throw new Error(`${operation} failed with HTTP ${response.status}`)
  try {
    return await response.json()
  } catch {
    throw new Error(`${operation} returned invalid JSON`)
  }
}

export function summarizeOAuthToken(token) {
  return {
    token_type: token.token_type,
    expires_in: token.expires_in,
    scope: token.scope,
    access_token: token.access_token ? "present" : "missing",
    refresh_token: token.refresh_token ? "present" : "missing"
  }
}
