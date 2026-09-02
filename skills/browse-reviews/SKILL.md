---
name: browse-reviews
description: Browse, filter, and search AppReviewBot app store reviews and analytics via MCP tools.
---

# Browse reviews

## When to use

- User wants recent reviews, unanswered reviews, keyword search, or rating analytics

## Workflow

1. Resolve the app with `list_apps` / `get_app_details` if `app_id` is unclear.
2. Choose the tool:
   - Recent feed by stars/store → `get_recent_reviews`
   - Keyword or sentiment topics → `search_app_reviews`
   - No developer reply yet → `get_unanswered_reviews`
   - Ratings / volume / sentiment summary → `get_review_analytics`
   - Single review deep dive → `get_review_details`
3. Present concise findings; offer follow-ups (draft reply, deeper search).

## Guardrails

- Do not use `get_recent_reviews` for text search — that is `search_app_reviews`.
- Keep quotes short; cite review IDs when suggesting replies.
