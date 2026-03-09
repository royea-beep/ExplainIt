# ExplainIt — Analytics Events Reference

## Storage
- Events are posted to `POST /api/events` via the `EventsQueueProvider` (client-side batching)
- Server appends to `exports/analytics.jsonl` (one JSON object per line)
- Each event has: `type`, `payload` (optional), `timestamp` (epoch ms)

## Events by Page

### Poker Landing (`/poker`)
| Event | Payload | When |
|-------|---------|------|
| `poker_page_view` | — | Page mount |
| `poker_cta_click` | `{ target }` | Any CTA click |

**CTA targets**: `hero_create`, `see_example`, `demo_video`, `demo_pdf`, `try_free`, `platform_card` (+ `platform`), `final_create`, `view_plans`, `whatsapp_contact`

### Editor (`/editor`)
| Event | Payload | When |
|-------|---------|------|
| `editor_page_view` | `{ platform }` | Page mount |
| `editor_request_submit` | `{ request }` (first 50 chars) | User submits free-text request |
| `editor_auth_required` | — | Server returns 401 or upgrade-required |
| `editor_auth_success` | — | User successfully authenticates via modal |
| `editor_questions_received` | `{ count }` | AI returns clarifying questions |
| `editor_generate_start` | `{ stepCount }` | User clicks Generate |
| `editor_generate_complete` | — | Phase transitions to "done" |
| `editor_draft_restored` | — | User resumes a saved draft |

### Results (`/results`)
| Event | Payload | When |
|-------|---------|------|
| `results_page_view` | `{ runCount }` | Exports loaded |
| `results_share_whatsapp` | `{ type }` | WhatsApp share (type: "project" or "item") |
| `results_item_open` | `{ category, name }` | User opens an item in lightbox |
| `results_item_download` | `{ category }` | User downloads from lightbox |

## Parsing analytics.jsonl

```bash
# Count events by type
cat exports/analytics.jsonl | jq -r '.type' | sort | uniq -c | sort -rn

# Show all poker CTA clicks
cat exports/analytics.jsonl | jq 'select(.type == "poker_cta_click")'

# Count unique sessions per day (by timestamp)
cat exports/analytics.jsonl | jq -r '.timestamp / 1000 | strftime("%Y-%m-%d")' | sort | uniq -c
```

## What's Measurable Now
- Full funnel: landing → editor → auth → generate → results → share
- Platform preference (which poker platform selected)
- Drop-off points (auth wall, generate, share)
- Content engagement (which items are opened/downloaded)

## What's Still Blind
- No user/session ID linking events across pages
- No UTM parameter tracking on landing pages
- No error/failure event tracking
- No time-on-page or scroll depth
- No A/B test framework
