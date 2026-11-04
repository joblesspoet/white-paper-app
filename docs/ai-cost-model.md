# AI service cost model

These are planning estimates, not quotes. Provider prices and model names change, so validate current pricing before launch. The safe architecture is provider-agnostic and records actual usage per job.

## Assumptions

Example monthly active usage:

- 1,000 monthly active users.
- 20% use AI each month: 200 AI users.
- Average AI user: 20 board actions/month.
- 4,000 text actions/month total.
- Average action input: 3,000 tokens; output: 700 tokens.
- 1,000 voice minutes/month.
- 500 image/OCR jobs/month.

Formula:

```text
monthly_cost = (input_tokens / 1,000,000 × input_price)
             + (output_tokens / 1,000,000 × output_price)
             + transcription_minutes × minute_price
             + image_jobs × image_job_price
             + fixed infrastructure
```

## Feature cost drivers

| Feature | Suggested first implementation | Main cost driver | Cost-control strategy |
|---|---|---|---|
| Summarize | Small/mini text model | Input and output tokens | Send selected region, cap context, cache by revision |
| Extract tasks | Small/mini text model | Tokens | Structured short output, batch notes |
| Find gaps | Small/mini text model | Tokens | Send only flow and labels |
| Organize board | Small model + local geometry | Tokens and retries | Do layout geometry locally; ask AI only for grouping |
| Voice-to-canvas | Speech-to-text API | Audio minutes | Compress, trim silence, user confirmation |
| Camera/OCR | On-device OCR where possible | Image processing | Resize/crop before upload; use cloud vision only when needed |
| Sketch conversion | Vision model | Image tokens | Crop selected region and lower resolution |
| Prototype generation | Mostly local rules | Minimal AI | Use AI only for naming or missing connections |

## Illustrative scenario estimates

Because provider rates differ, use ranges for planning:

### Lean MVP — 1,000 MAU

- 4,000 text actions × roughly $0.001–$0.02/action: **$4–$80**
- 1,000 transcription minutes × roughly $0.003–$0.03/minute: **$3–$30**
- 500 OCR/vision jobs: **$1–$25**
- AI gateway, logs, and retries: **$10–$50**

**Estimated AI-related total: $18–$185/month**, excluding the core backend, storage, analytics, and payment fees.

### Growing usage — 10,000 MAU

Assuming 10× the above traffic with similar behavior:

**Estimated AI-related total: $180–$1,850/month.**

Actual spend can be much higher if users submit whole-board images, repeatedly regenerate layouts, or use premium reasoning models. Add a hard monthly budget and per-user quotas before public launch.

## Non-AI infrastructure planning

Typical early-stage line items to budget separately:

- Supabase database/storage/realtime: start with the appropriate paid tier once production reliability and backups matter.
- Sentry: free/paid tier based on event volume.
- PostHog: free/paid tier based on events and retention.
- RevenueCat: usually free at low revenue, then percentage-based pricing may apply.
- Apple/Google developer accounts and store commissions.
- Email, push notification, CDN, and PDF rendering costs.

Do not present these as fixed numbers until the selected vendors and current plans are confirmed.

## Cost controls to implement from day one

1. Route simple actions to the cheapest capable model.
2. Limit context to selected objects plus a bounded neighborhood.
3. Store normalized object text so it does not need repeated OCR.
4. Cache identical AI requests using board revision + action + options.
5. Make large-board organization asynchronous and quota-controlled.
6. Require confirmation before expensive vision or regeneration jobs.
7. Show remaining AI credits to the user.
8. Set workspace and user monthly spend ceilings.
9. Log token/audio/image usage and estimated cost per job.
10. Make exports and AI jobs idempotent to prevent duplicate charges.

## Suggested launch quotas

For a free plan, consider starting with limits rather than promising unlimited AI:

- 10 text AI actions/month.
- 30 transcription minutes/month.
- 10 vision/OCR imports/month.
- Maximum selected context size per action.

For Pro and Team, increase quotas only after observing real usage and gross margin.

## Cost measurement checklist

Before beta:

- Add provider adapter with usage fields.
- Store prompt/input/output token counts where supplied.
- Record audio seconds and image dimensions.
- Add dashboard: cost by workspace, user, feature, provider, and day.
- Add alert when projected monthly spend exceeds budget.
- Run a 7-day closed beta and replace assumptions with observed p50/p95 usage.
