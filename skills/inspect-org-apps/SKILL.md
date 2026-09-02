---
name: inspect-org-apps
description: List and inspect AppReviewBot connected apps and rating summaries for the authenticated organization.
---

# Inspect org apps

## When to use

- User asks which apps are connected, monitored, or linked in AppReviewBot
- Need an `app_id` before fetching reviews or analytics

## Workflow

1. Call `list_apps` (optional `limit`).
2. For a specific app, call `get_app_details` with `app_id` (store ID, subscription UUID, or app name).
3. Summarize name, store, ratings, and any gaps (missing apps, empty list).

## Guardrails

- Do not invent apps that were not returned by MCP.
- If unauthorized, tell the user to **Connect** the **appreviewbot** MCP server (OAuth) in Cursor Settings.
