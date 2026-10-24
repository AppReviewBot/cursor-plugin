#!/usr/bin/env node
/**
 * Manual OAuth PKCE test for Cursor-style MCP clients (usage: see README "Manual
 * OAuth PKCE check"). Verifies authorize -> token -> list_apps; Cursor itself
 * stores real tokens in its own secure storage after Connect, never here.
 */
import { createHash, randomBytes } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseOAuthCallback, readOAuthResponse, summarizeOAuthToken } from "./oauth-pkce-security.mjs"

const mcpUrl = process.env.APPREVIEWBOT_MCP_URL || "https://dash.appreviewbot.com/api/mcp"
const issuerUrl = mcpUrl.replace(/\/api\/mcp\/?$/, "")
const callbackHost = process.env.OAUTH_CALLBACK_HOST || "localhost"
const callbackPort = Number(process.env.OAUTH_CALLBACK_PORT || 8787)
const callbackPath = "/callback"
// Single source of truth: this must match the pre-registered redirect URI
// (see README.md "Manual OAuth PKCE check") exactly.
const redirectUri = `http://${callbackHost}:${callbackPort}${callbackPath}`
const outFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".oauth-test-result.json")

function base64Url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function pkcePair() {
  const verifier = base64Url(randomBytes(32))
  const challenge = base64Url(createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

async function registerClient() {
  const res = await fetch(`${issuerUrl}/api/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "cursor-plugin-oauth-test",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      scope: "openid profile mcp:read mcp:write"
    })
  })
  const body = await readOAuthResponse(res, "register")
  return body.client_id
}

function waitForCallback(expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const result = parseOAuthCallback(req.url, { redirectUri, callbackPath, expectedState })
      res.writeHead(result.status, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      })
      res.end(result.body)
      if (!result.done) return
      server.close()
      if (result.error) reject(new Error(result.error))
      else resolve(result.code)
    })
    server.listen(callbackPort, callbackHost, () => {})
    server.on("error", reject)
  })
}

async function exchangeToken({ clientId, code, verifier }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    resource: mcpUrl.replace(/\/+$/, "")
  })
  const res = await fetch(`${issuerUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  })
  return readOAuthResponse(res, "token")
}

async function callListApps(accessToken) {
  const init = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "oauth-pkce-test", version: "1.0.0" }
      }
    })
  })
  if (init.status === 401) throw new Error("initialize unauthorized after token exchange")

  const tools = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_apps", arguments: {} }
    })
  })
  const text = await tools.text()
  return { status: tools.status, text: text.slice(0, 2000) }
}

async function main() {
  const { verifier, challenge } = pkcePair()
  const state = base64Url(randomBytes(16))
  console.log(`Issuer: ${issuerUrl}`)
  console.log(`MCP:    ${mcpUrl}`)

  const clientId = process.env.OAUTH_CLIENT_ID || (await registerClient())
  console.log(`Client: ${clientId}`)

  const authUrl = new URL(`${issuerUrl}/api/oauth/authorize`)
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("scope", "openid profile mcp:read mcp:write")
  authUrl.searchParams.set("state", state)
  authUrl.searchParams.set("code_challenge", challenge)
  authUrl.searchParams.set("code_challenge_method", "S256")
  authUrl.searchParams.set("resource", mcpUrl.replace(/\/+$/, ""))

  console.log("\nOpen this URL in a browser (log into AppReviewBot if prompted):\n")
  console.log(authUrl.toString())
  console.log(`\nWaiting for callback on ${redirectUri} …`)

  const code = await waitForCallback(state)
  console.log("Got authorization code, exchanging token…")

  const token = await exchangeToken({ clientId, code, verifier })
  console.log("Token response:", summarizeOAuthToken(token))

  const listApps = await callListApps(token.access_token)
  console.log("list_apps:", listApps.status, listApps.text.slice(0, 500))

  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        tested_at: new Date().toISOString(),
        issuerUrl,
        mcpUrl,
        clientId,
        token_type: token.token_type,
        expires_in: token.expires_in,
        scope: token.scope,
        access_token_saved: Boolean(token.access_token),
        refresh_token_saved: Boolean(token.refresh_token),
        list_apps_status: listApps.status
      },
      null,
      2
    )
  )
  console.log(`\nSaved result (no secrets): ${outFile}`)
  console.log(
    "\nNote: Cursor stores tokens in its own vault after Connect — not in mcp-auth.json (that file only holds client_id)."
  )
}

main().catch(err => {
  console.error("OAuth test failed:", err.message)
  process.exit(1)
})

