---
name: reply-to-review
description: Draft and optionally publish a developer reply to an app store review through AppReviewBot MCP.
---

# Reply to review

## When to use

- User wants to answer a specific App Store or Google Play review

## Workflow

1. Confirm that the authenticated connection exposes `reply_to_review`. If not,
   draft text only and explain that this connection cannot publish it.
2. Load the review with `get_review_details` (or find it via `get_unanswered_reviews` / `search_app_reviews`).
3. Draft a reply that is polite, specific, and store-policy safe.
4. Call `reply_to_review` with `preview: true` first and show the preview.
5. Only after explicit confirmation, call again with `preview: false` to publish.

## Guardrails

- Never publish without clear user confirmation.
- If authorization fails, check the returned error and granted scopes. Reconnect
  through OAuth only when needed; `mcp:write` alone does not guarantee tool availability.
- Do not overwrite an existing reply; if one exists, stop and report it.

