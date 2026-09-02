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
- **`reply-to-review`** — draft and, after explicit confirmation, publish a developer reply to a review.
- **`debug-review-alerts`** — diagnose why review alerts may not be arriving in a connected destination by inspecting connected apps and review activity.
- **`create-cursor-agent`** — scaffold a new Cursor plugin subagent for this repo (agents/skills/rules layering, validation).

### Rule

- **`appreviewbot-mcp`** (`rules/appreviewbot-mcp.mdc`, always applies) — guardrails for using the AppReviewBot MCP tools safely: prefer real tool calls over guessing, resolve `app_id` via `list_apps` first, and always confirm before publishing a review reply.

### Agent

- **`appreviewbot-review-analyst`** (`agents/appreviewbot-review-analyst.md`) — a subagent persona that summarizes ratings, themes, and unanswered reviews for connected apps using only MCP tool output.

## Installation

### Option A — Import folder in Cursor UI (recommended)

1. Clone this repo: `git clone https://github.com/AppReviewBot/cursor-plugin.git`
2. In Cursor: **Customize → Plugins → Add marketplace / Import local repo**
3. Select the cloned folder
4. Enable **Include third-party Plugins, Skills, and other configs**
5. **Developer: Reload Window**
6. Install **AppReviewBot** → **Connect** (OAuth)

Requires `.cursor-plugin/marketplace.json` (included in this repo).

### Option B — Cursor Marketplace

Once published, install directly from the Cursor Marketplace listing (search "AppReviewBot").

### Option C — Copy into your local Cursor plugins dir

```bash
git clone https://github.com/AppReviewBot/cursor-plugin.git
cd cursor-plugin
pnpm install
pnpm install:local
```

Re-run `pnpm install:local` after editing skills/rules/mcp.json — it copies
`.cursor-plugin`, `agents`, `assets`, `mcp.json`, `rules`, and `skills` into
`~/.cursor/plugins/local/appreviewbot` (Cursor rejects symlinks whose target is
outside that directory, so the script copies rather than links).

## Configuring the MCP connection

`mcp.json` points at `https://dash.appreviewbot.com/api/mcp` with no static
credentials — Cursor performs OAuth dynamic client registration against that
endpoint the same way it does for first-party plugins like Google Drive or
Calendar, so there's no client ID or secret to configure in the plugin itself:

1. Install the plugin and **Reload Window**
2. **Settings → MCP** → **appreviewbot** → **Connect**
3. Sign in to AppReviewBot and approve scopes (`mcp:read`, `mcp:write`)

If dynamic client registration is disabled on a given deployment, pre-register
a client via `POST /api/oauth/register` against the same host, passing the
Cursor redirect URI (`cursor://anysphere.cursor-mcp/oauth/callback`, etc.), then
configure that client in Cursor's MCP settings.

### Pointing at a different MCP host (local development)

Edit the `url` in `mcp.json` (e.g. to `http://localhost:8700/api/mcp` for a
local AppReviewBot dashboard instance), then re-run `pnpm install:local` if
you're using Option C above.

## Development

```bash
git clone https://github.com/AppReviewBot/cursor-plugin.git
cd cursor-plugin
pnpm install
pnpm validate
pnpm test
```

`pnpm validate` and `pnpm test` both run the same tested implementation
(`src/validate-plugin.ts`) — `validate` via a thin `tsx` CLI entry point
(`src/validate-cli.ts`), `test` via Vitest — checking plugin manifest shape,
`mcp.json` correctness, and that every skill/rule/agent file has the right
frontmatter.

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
- If dynamic client registration is disabled on the target deployment,
  pre-register that exact redirect URI with `POST /api/oauth/register` first.

### Auth troubleshooting

`pnpm check:auth` (`scripts/check-cursor-mcp-auth.mjs`) inspects Cursor's local
MCP auth/tool-cache state under `~/.cursor/projects/**` (no secrets are
printed) — useful if Cursor shows tools as cached but an agent still reports
`needsAuth`.

## Publishing to the Cursor Marketplace

1. Keep `pnpm validate` and `pnpm test` green
2. Submit this repo's GitHub URL at https://cursor.com/marketplace/publish

## License

MIT — see [LICENSE](LICENSE).
