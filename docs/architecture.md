# How it works

A short explainer for anyone wanting to understand or modify the system.

## The data flow

```
   ┌─────────────────────┐
   │  Ghost admin UI     │
   │  Post → Code        │
   │  Injection footer   │
   └──────────┬──────────┘
              │ stores JSON list of URLs
              ▼
   ┌─────────────────────┐
   │  Ghost-rendered     │
   │  post HTML          │
   │  ┌───────────────┐  │
   │  │ <section ...> │  │ ← from your post.hbs
   │  │ (empty,       │  │
   │  │  hidden)      │  │
   │  └───────────────┘  │
   │  ┌───────────────┐  │
   │  │ <script type= │  │ ← from {{ghost_foot}}
   │  │  "appl/json"> │  │   (the JSON URL list)
   │  └───────────────┘  │
   └──────────┬──────────┘
              │
              │ social-replies.js runs on
              │ DOMContentLoaded
              ▼
  ┌──────────────────────┐         ┌─────────────────────┐
  │  Read JSON list of   │         │  Mastodon API       │
  │  URLs                │ ──────▶ │  (any instance)     │
  │                      │         │  /api/v1/statuses/  │
  │  Classify each URL   │         └─────────────────────┘
  │  by platform         │         ┌─────────────────────┐
  │                      │ ──────▶ │  Bluesky API        │
  │  Fetch in parallel   │         │  public.api.bsky.app│
  │                      │         │  /xrpc/...          │
  │                      │         └─────────────────────┘
  └──────────┬───────────┘
             │
             │ Sanitize HTML, normalize fields,
             │ render unified comment cards
             ▼
   ┌─────────────────────┐
   │  Reader sees:       │
   │  ─── Replies ───    │
   │  • Avatar + name    │
   │  • Reply text       │
   │  • Date + platform  │
   └─────────────────────┘
```

## Why client-side fetching

There are several ways this could be implemented. Server-side fetching at
build time would be more performant and resilient (cached results, no live
API dependency on every page load), but it requires a build pipeline that
re-runs whenever a reply is added.

Client-side fetching has trade-offs:

**Pros:**
- Zero infrastructure beyond a static HTML hosting setup
- Replies update automatically when their authors edit them
- If a reply is deleted on its source platform, it disappears
- Works on Ghost(Pro) without any server-side hooks

**Cons:**
- Each post page makes N API calls (one per reply) on load
- Brief moment of "no replies yet" before fetches resolve
- Requires CORS support from the source platforms (which Mastodon and
  Bluesky both provide)

For typical blog post traffic with <20 replies per post, the trade-offs
favor client-side. If you have posts with hundreds of replies, you might
want a build-time approach instead.

## The script execution timing trick

A common gotcha: Ghost renders `{{ghost_foot}}` (which contains the JSON
list of URLs) AFTER theme scripts. If `social-replies.js` runs immediately
on parse, the JSON tag isn't in the DOM yet and the script silently does
nothing.

The fix is at the bottom of `social-replies.js`:

```javascript
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

This defers the init until DOM is fully parsed, by which point Ghost has
injected the JSON. Works whether the script tag has `defer`, `async`, or
neither.

## API endpoints used

### Mastodon

`GET https://{instance}/api/v1/statuses/{id}` — returns post JSON including
HTML content, author info (with avatar URL), and timestamps. CORS-enabled
by default on all Mastodon instances. No auth required for public posts.

### Bluesky

Two-step process:

1. `GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={handle}`
   — converts a human-readable handle (`alice.bsky.social`) to a DID
   (`did:plc:abc123...`)

2. `GET https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri={atUri}&depth=0`
   — fetches the post by its AT-URI

Both endpoints are public, CORS-enabled, no auth required.

## Sanitization

Mastodon returns posts as HTML. The script sanitizes it to allow only
`<a>`, `<br>`, `<p>`, and `<span>` tags, and on `<a>` strips all attributes
except `href` (which is restricted to `https:`, `http:`, and `mailto:`
schemes only). Links get `target="_blank"` and `rel="noopener nofollow"`
forced.

Bluesky returns plain text in `record.text`, which the script HTML-escapes
and wraps in a `<p>` tag.

## Failure handling

Each URL is fetched independently with `Promise.all`. If a single fetch
fails (deleted post, server down, malformed URL), it's silently skipped —
the warning is logged to console with the prefix `[social-replies]` for
debugging.

If ALL fetches fail or the JSON is missing/empty, the entire `<section>`
is removed from the page so there's no empty heading or visual residue.

## The helper architecture

The Replies Helper exists because Ghost's Admin API blocks browser-origin
requests via CORS, and the Admin API key is sensitive (anyone with it can
edit posts). So the helper is split:

- **HTML/JS frontend** (`replies-helper.html`) — the UI you interact with
- **PHP proxy** (`ghost-replies-proxy.php`) — server-side shim that holds
  the API key, generates JWTs, and forwards requests to Ghost

The frontend talks only to the proxy via relative URL. The proxy does the
authenticated Ghost API calls and returns results. This keeps the API key
server-side while still giving you a friendly browser UI.

The proxy uses Ghost's optimistic concurrency check (`updated_at`), so if
you accidentally have the post open in Ghost admin and edit it there while
the helper is loaded, the helper's save will fail rather than silently
overwriting your changes.
