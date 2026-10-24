# Changelog

## [Unreleased]

## [1.0.3] - 2026-10-24

### Fixed
- Validate the manual OAuth helper's callback path and state before accepting a
  code or error, return plain-text responses, and omit tokens and raw OAuth
  registration/token response bodies from diagnostics. This helper is separate
  from Cursor's OAuth runtime.
- Replace stale API-key instructions with OAuth scope and tool-availability guidance.
- Include the README and MIT license in local installs.

### Changed
- Update local and team installation instructions and add privacy, terms, support,
  and duplicate-safe publisher submission guidance.
- Require reply previews and confirmation consistently; treat review text as
  untrusted data rather than instructions.

### Added
- Offline regression coverage for the manual OAuth helper.

## Repository extraction - 2026-09-02

### Changed
- Project moved to its own public repository, `AppReviewBot/cursor-plugin`
  (previously developed in-tree in the private AppReviewBot monorepo).

## [1.0.2] - 2026-09-02

### Changed
- OAuth PKCE test script callback host is now configurable (`OAUTH_CALLBACK_HOST`,
  default `localhost`) and derives one redirect URI shared by authorize, token
  exchange, and docs — fixes a `127.0.0.1` vs `localhost` mismatch with the
  pre-registered redirect URI in the docs guide.
- `pnpm validate` / `pnpm smoke` now run the tested `src/validate-plugin.ts` and
  `src/mcp-smoke.ts` (via new `src/validate-cli.ts` / `src/smoke-cli.ts` entry
  points) instead of untested duplicate `scripts/*.mjs` implementations, which
  are removed.
- Fixed a false-positive `mcp.json` warning: a bare `{ type: "http", url }` MCP
  server entry (no `auth`, no `Authorization` header) is the correct
  OAuth-discovery shape and no longer warns; a static (non-`${VAR}`)
  Authorization header is now an error.
- Added `pnpm.onlyBuiltDependencies: ["esbuild"]` so a fresh
  `pnpm install --ignore-workspace` doesn't fail with `ERR_PNPM_IGNORED_BUILDS`.

### Added
- CI workflow (`.github/workflows/ci.yml`) for automated testing and validation.

## [1.0.1] - 2026-08-22

### Changed
- OAuth-only plugin: Connect via Cursor MCP (no API key plugin variable)
- Point MCP at `https://dash.appreviewbot.com/api/mcp` with discovery-based auth

### Added
- Agent: `appreviewbot-review-analyst`
- Skill: `create-cursor-agent`
- Scripts: `oauth:test`, `check:auth`

## [1.0.0] - 2026-08-22

- Initial Cursor plugin scaffold
- Skills: inspect-org-apps, browse-reviews, reply-to-review, debug-review-alerts
- Rule: AppReviewBot MCP usage guidance
- Local install + structure validation + MCP smoke helpers

