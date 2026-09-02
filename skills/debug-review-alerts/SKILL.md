---
name: debug-review-alerts
description: Diagnose why AppReviewBot may not be delivering review alerts by inspecting connected apps and review activity.
---

# Debug review alerts

## When to use

- User says reviews are not arriving in Slack/Discord/Teams/email
- Support-style “is monitoring working?” questions

## Workflow

1. Call `list_apps` — confirm the expected app is connected.
2. Call `get_app_details` for that app — note store and rating summary.
3. Call `get_recent_reviews` (small limit) — confirm reviews exist in ARB.
4. Call `get_review_analytics` for `7d` — check whether volume looks healthy.
5. Report findings as a checklist:
   - App connected?
   - Reviews present in ARB?
   - Recent volume flat or empty?
6. If data looks fine in ARB, tell the user the next step is destination health in the dashboard (this MCP surface is app/review focused, not destination admin).

## Guardrails

- Stay evidence-based from MCP tool output.
- Do not claim destination webhook delivery status without dashboard/admin tools.
