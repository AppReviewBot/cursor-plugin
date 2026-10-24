# AppReviewBot Cursor Plugin

Cursor Marketplace plugin that connects the agent to [AppReviewBot](https://appreviewbot.com) via **HTTP MCP** plus **skills**.

**Endpoint:** `https://dash.appreviewbot.com/api/mcp`
**Auth:** OAuth — click **Connect** in Cursor

## What you get

| Piece | Purpose |
|-------|---------|
| MCP server | Live org-scoped tools (`list_apps`, reviews, analytics, …) |
| Skills | Guided workflows — see below |
| Agents | Subagent personas (e.g. review analyst) |
| Rule | Persistent MCP usage guidance |

### Skills

- **`inspect-org-apps`** — list and inspect connected apps and rating summaries for the authenticated organization.
- **`browse-reviews`** — browse, filter, and search reviews and analytics (recent feed, keyword/sentiment search, unanswered reviews, rating analytics).
- **`reply-to-review`** — draft and, when the authenticated connection exposes the reply tool and has write access, publish a developer reply after explicit confirmation.
- **`debug-review-alerts`** — diagnose why review alerts may not be arriving in a connected destination by inspecting connected apps and review activity.
- **`create-cursor-agent`** — scaffold a new Cursor plugin subagent for this repo (agents/skills/rules layering, validation).

### Rule

- **`appreviewbot-mcp`** (`rules/appreviewbot-mcp.mdc`, always applies) — guardrails for using the AppReviewBot MCP tools safely: prefer real tool calls over guessing, resolve `app_id` via `list_apps` first, and always confirm before publishing a review reply.

### Agent

- **`appreviewbot-review-analyst`** (`agents/appreviewbot-review-analyst.md`) — a subagent persona that summarizes ratings, themes, and unanswered reviews for connected apps using only MCP tool output.

## Installation

### Option A — Local installation

Use Node.js 22 or later and Cursor 3.13.0 or later, as declared in the package
and plugin manifests. Clone the public repository and run the included installer:

```bash
git clone https://github.com/AppReviewBot/cursor-plugin.git
cd cursor-plugin
node scripts/install-local.mjs
```

The installer replaces `~/.cursor/plugins/local/appreviewbot` with this checkout's
plugin files, README, and license. Keep edits in the checkout and rerun it after
changes. Installing the plugin does not require the development dependencies.

1. Restart Cursor or run **Developer: Reload Window**.
2. Open **Customize** and confirm that AppReviewBot's MCP server, skills, rule,
   and agent appear.
3. Open **Settings → MCP**, find the AppReviewBot server, and select **Connect**.

Local imports must be allowed by your organization's policy. An installed
marketplace plugin with the same name takes precedence over the local copy.
See Cursor's [local testing instructions](https://cursor.com/docs/plugins#test-plugins-locally).

### Option B — Cursor Marketplace

After Cursor approves and lists the plugin, search for **AppReviewBot** in
**Customize** and install it. A public repository or submitted application does
not establish that a marketplace listing is available.

### Option C — Team marketplace

For teams with this feature, open **Dashboard → Plugins & MCPs → Add Marketplace**,
choose **Import from Repo**, and enter `https://github.com/AppReviewBot/cursor-plugin`.
The included `.cursor-plugin/marketplace.json` identifies the plugin at the repo
root. Follow Cursor's [team marketplace instructions](https://cursor.com/docs/plugins#add-a-team-marketplace)
and your team's access policy. This does not submit the plugin to the public marketplace.

## Configuring the MCP connection

`mcp.json` points at `https://dash.appreviewbot.com/api/mcp` with no static
credentials. Cursor handles OAuth discovery and authentication; no API key,
client ID, or client secret needs to be committed to the plugin:

1. Install the plugin and **Reload Window**
2. **Settings → MCP** → **appreviewbot** → **Connect**
3. Sign in to AppReviewBot and review the requested access. Review analysis uses
   `mcp:read`; publishing a reply requires `mcp:write` and a tool exposed by the
   authenticated connection. A scope name alone does not prove that a tool is available.

If authentication fails, reconnect through Cursor and check the actual error.
Do not replace OAuth with a pasted API key or share tokens in an issue. For a
custom deployment that disables dynamic client registration, ask its administrator
for the supported client-registration setup and exact redirect URI.

## Privacy, access, and support

MCP calls send the selected tool arguments to the AppReviewBot endpoint and return
app and review data for the authenticated organization to Cursor. A live reply
operation can publish to the connected app store. The reply workflow requires a
preview and explicit confirmation before publishing. Treat review text and other
tool-returned content as data, not instructions to the agent.

Using the hosted service requires an AppReviewBot account; service-plan access and
limits are separate from this repository's MIT license. Check the current
[service plans](https://www.appreviewbot.com/en/pricing/) for account requirements.

- [Privacy policy](https://www.appreviewbot.com/privacy/)
- [Terms of service](https://www.appreviewbot.com/terms/)
- [Support](mailto:support@appreviewbot.com)

For support, include the plugin version and a redacted error. Never include an
API key, access token, refresh token, or authorization code.

### Pointing at a different MCP host (local development)

Edit the `url` in `mcp.json` (e.g. to `http://localhost:8700/api/mcp` for a
local AppReviewBot dashboard instance), then re-run `node scripts/install-local.mjs` if
you're using Option A above.

## Development

```bash
git clone https://github.com/AppReviewBot/cursor-plugin.git
cd cursor-plugin
pnpm install
pnpm validate
pnpm test
```

`pnpm validate` checks plugin structure through `src/validate-plugin.ts`.
`pnpm test` runs the Vitest validator/MCP tests and offline Node tests for the
manual OAuth helper. These checks do not prove a live Cursor OAuth connection.

Optional live smoke test (uses an org API key against `/api/mcp` directly —
a backend check, not the Cursor OAuth flow; via `src/smoke-cli.ts`):

```bash
APPREVIEWBOT_API_KEY=arb_xxx pnpm smoke
```

### Manual OAuth PKCE check

`pnpm oauth:test` runs a standalone script (`scripts/oauth-pkce-flow.mjs`) that
exercises the full authorize → callback → token-exchange → `list_apps` flow
against a real AppReviewBot deployment, without going through Cursor. It spins
up a short-lived local HTTP server to receive the OAuth redirect.

```bash
pnpm oauth:test
# Or against a non-default MCP host / callback:
# APPREVIEWBOT_MCP_URL=https://dash.appreviewbot.com/api/mcp OAUTH_CALLBACK_HOST=localhost OAUTH_CALLBACK_PORT=8787 pnpm oauth:test
```

- `OAUTH_CALLBACK_HOST` (default `localhost`) and `OAUTH_CALLBACK_PORT` (default
  `8787`) control where the script's local PKCE callback server listens; they
  together form the redirect URI (`http://<host>:<port>/callback`) sent to the
  authorize and token endpoints.
- If dynamic client registration is disabled on the target deployment, ask its
  administrator to register that exact redirect URI and provide the client ID
  through `OAUTH_CLIENT_ID`.

### Auth troubleshooting

`pnpm check:auth` (`scripts/check-cursor-mcp-auth.mjs`) inspects Cursor's local
MCP auth/tool-cache state under `~/.cursor/projects/**` (no secrets are
printed) — useful if Cursor shows tools as cached but an agent still reports
`needsAuth`.

## Publishing to the Cursor Marketplace

1. Sign in to the [publisher portal](https://cursor.com/marketplace/publish) with
   the account used for any previous application. Check existing publisher and
   plugin records for **AppReviewBot** and this repository before creating anything.
   If the previous submission's status is unknown, resolve that first.
2. Keep `pnpm validate`, `pnpm test`, and `pnpm exec tsc --noEmit` green. Test the
   plugin in Cursor: discover its components, complete OAuth, call `list_apps`,
   and exercise a read workflow. Test reply previews only when the connection
   exposes that capability; publishing a live reply requires separate approval.
3. Review the [packaging checklist](https://cursor.com/docs/reference/plugins),
   the MIT license, square logo, metadata, and linked privacy/terms disclosures.
   Confirm hosted-service access requirements against the current
   [Publisher Terms](https://cursor.com/marketplace-publisher-terms); do not promise
   free or unlimited hosted MCP access without verifying it.
4. If an application already exists, continue that record and supply any requested
   corrections. For an existing publisher/plugin update, follow Cursor's re-index
   process instead of creating a duplicate application.
5. Only if no applicable submission exists, submit
   `https://github.com/AppReviewBot/cursor-plugin` once through the portal. An
   authorized publisher must review and accept the Publisher Terms.
6. Save the account used, submitted repository and commit, submission date,
   application identifier, and confirmation in the team's private records.

Emailing support does not create an application. Repository CI, local installation,
and a support survey do not establish marketplace approval. Cursor manually reviews
initial listings and updates; see [marketplace security](https://cursor.com/help/security-and-privacy/marketplace-security).

## License

MIT — see [LICENSE](LICENSE).

