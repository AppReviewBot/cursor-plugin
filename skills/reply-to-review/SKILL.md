---
name: reply-to-review
description: Draft and optionally publish a developer reply to an app store review through AppReviewBot MCP.
---

# Reply to review

## When to use

- User wants to answer a specific App Store or Google Play review

## Workflow

1. Load the review with `get_review_details` (or find it via `get_unanswered_reviews` / `search_app_reviews`).
2. Draft a reply that is polite, specific, and store-policy safe.
3. Call `reply_to_review` with `preview: true` first and show the preview.
4. Only after explicit confirmation, call again with `preview: false` to publish.

## Guardrails

- Never publish without clear user confirmation.
- If write fails, tell the user to **Connect** the **appreviewbot** OAuth MCP server and ensure `mcp:write` was granted.
- Do not overwrite an existing reply; if one exists, stop and report it.
