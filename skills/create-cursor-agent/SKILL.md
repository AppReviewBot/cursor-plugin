---
name: create-cursor-agent
description: Scaffold a Cursor plugin subagent (agents/*.md), wire it to MCP tools and skills, and validate local install. Use when adding or editing Cursor agents inside the AppReviewBot cursor plugin.
---

# Create a Cursor agent (AppReviewBot plugin)

## When to use

- Add a specialized subagent to this plugin
- User asks for a Cursor agent for reviews, support triage, or MCP workflows
- Extend the AppReviewBot Cursor plugin beyond skills/rules

## Cursor primitives (pick the right layer)

| Layer | Folder | Purpose |
|-------|--------|---------|
| **MCP** | `mcp.json` | Live API (`list_apps`, reviews, analytics) |
| **Skill** | `skills/*/SKILL.md` | Multi-step playbook the main agent follows |
| **Agent** | `agents/*.md` | Specialized subagent with its own system prompt |
| **Rule** | `rules/*.mdc` | Always-on guardrails |

Add an **agent** when you want a dedicated persona/subagent (e.g. review analyst, support triage), not just a workflow skill.

## Scaffold an agent

1. Create `agents/<kebab-name>.md` with frontmatter:

```markdown
---
name: review-analyst
description: Analyze AppReviewBot app store reviews and summarize themes for product teams.
---

# Review analyst

You are an AppReviewBot review analyst. Always use MCP tools — never invent apps or reviews.

## Workflow
1. `list_apps` → pick `app_id`
2. `get_review_analytics` for 7d/30d context
3. `search_app_reviews` or `get_recent_reviews` for evidence
4. Summarize themes, severity, and suggested actions

## Guardrails
- Org-scoped data only (authenticated API key)
- Cite review IDs when quoting
- Do not publish replies unless user explicitly asks (`reply_to_review`)
```

2. **Do not** add `agents` to `plugin.json` unless using a custom path — Cursor auto-discovers `agents/`.

3. Run validation:

```bash
pnpm validate && pnpm test
pnpm install:local   # or re-import folder in Cursor UI
```

4. Reload Cursor → verify agent appears under plugin components.

## Auth reminder

- **OAuth:** Settings → MCP → **appreviewbot** → **Connect**
- Raw key only — no `Bearer ` prefix
- `Token verification failed` in logs = key missing or not starting with `arb_`

## References

- Full setup and validation docs: this repo's [README.md](../../README.md)
- MCP tool behavior: inspect `tools/list` on the live endpoint (`https://dash.appreviewbot.com/api/mcp`), or run `pnpm smoke` against it
