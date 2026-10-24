import assert from "node:assert/strict"
import { test } from "node:test"
import { parseOAuthCallback, readOAuthResponse, summarizeOAuthToken } from "./oauth-pkce-security.mjs"

const options = {
  redirectUri: "http://localhost:8787/callback",
  callbackPath: "/callback",
  expectedState: "this-flow-only"
}

test("a matching state accepts the authorization code without reflecting it in the response", () => {
  const result = parseOAuthCallback("/callback?state=this-flow-only&code=private-code", options)
  assert.equal(result.status, 200)
  assert.equal(result.done, true)
  assert.equal(result.code, "private-code")
  assert.equal(result.error, undefined)
  assert.ok(!result.body.includes("private-code"))
})

for (const [name, query] of [
  ["missing state", "code=private-code"],
  ["empty state", "state=&code=private-code"],
  ["wrong state", "state=another-flow&code=private-code"],
  ["duplicate matching states", "state=this-flow-only&state=this-flow-only&code=private-code"],
  ["duplicate mixed states", "state=this-flow-only&state=another-flow&code=private-code"],
  ["invalid state with an error", "state=another-flow&error=private-error"]
]) {
  test(`${name} cannot consume a code or terminate the active flow`, () => {
    const result = parseOAuthCallback(`/callback?${query}`, options)
    assert.equal(result.status, 400)
    assert.equal(result.done, false)
    assert.equal(result.code, undefined)
    assert.equal(result.error, undefined)
    assert.ok(!result.body.includes("private-code"))
    assert.ok(!result.body.includes("private-error"))
  })
}

for (const path of ["/callback-extra", "/callback/child", "/callback/", "/unrelated"]) {
  test(`callback path ${path} does not match /callback`, () => {
    const result = parseOAuthCallback(`${path}?state=this-flow-only&code=private-code`, options)
    assert.equal(result.status, 404)
    assert.equal(result.done, false)
    assert.equal(result.code, undefined)
  })
}

test("a valid-state OAuth error is reported without reflecting HTML or query data", () => {
  const payload = "<script>alert('private-token')</script>"
  const result = parseOAuthCallback(
    `/callback?state=this-flow-only&error=${encodeURIComponent(payload)}&error_description=private-details`,
    options
  )
  assert.equal(result.status, 400)
  assert.equal(result.done, true)
  assert.equal(result.code, undefined)
  assert.equal(result.error, "OAuth authorization failed")
  assert.doesNotMatch(JSON.stringify(result), /<script>|private-token|private-details/)
})

for (const query of ["", "&code=", "&code=one&code=two"]) {
  test(`a valid-state callback rejects missing or ambiguous code (${query || "absent"})`, () => {
    const result = parseOAuthCallback(`/callback?state=this-flow-only${query}`, options)
    assert.equal(result.status, 400)
    assert.equal(result.done, true)
    assert.equal(result.code, undefined)
    assert.equal(result.error, "Missing or ambiguous authorization code")
  })
}

test("token diagnostics reveal presence, never tokens or token prefixes", () => {
  const accessToken = "very-secret-access-token"
  const refreshToken = "very-secret-refresh-token"
  const summary = summarizeOAuthToken({
    token_type: "Bearer",
    expires_in: 3600,
    scope: "mcp:read",
    access_token: accessToken,
    refresh_token: refreshToken
  })
  assert.equal(summary.access_token, "present")
  assert.equal(summary.refresh_token, "present")
  assert.equal(summary.scope, "mcp:read")
  assert.doesNotMatch(JSON.stringify(summary), /very-secret|access_token_prefix/)
  assert.equal(summarizeOAuthToken({}).access_token, "missing")
})

for (const operation of ["register", "token"]) {
  test(`${operation} HTTP errors never read or expose endpoint response bodies`, async () => {
    let bodyRead = false
    const response = {
      ok: false,
      status: 400,
      async json() {
        bodyRead = true
        return { access_token: "very-secret-access-token", error: "private-server-details" }
      }
    }
    await assert.rejects(readOAuthResponse(response, operation), {
      message: `${operation} failed with HTTP 400`
    })
    assert.equal(bodyRead, false)
  })

  test(`${operation} JSON parse failures cannot expose response snippets`, async () => {
    const response = {
      ok: true,
      status: 200,
      async json() {
        throw new SyntaxError('Unexpected token in "very-secret-access-token"')
      }
    }
    await assert.rejects(readOAuthResponse(response, operation), {
      message: `${operation} returned invalid JSON`
    })
  })
}

test("successful OAuth response data is retained for the caller's token exchange", async () => {
  const body = { access_token: "very-secret-access-token", token_type: "Bearer" }
  const result = await readOAuthResponse({ ok: true, json: async () => body }, "token")
  assert.equal(result, body)
})
