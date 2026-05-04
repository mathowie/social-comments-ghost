# Ghost Social Replies

Show Mastodon and Bluesky replies as comments on your Ghost blog posts.

A two-part add-on for any Ghost theme:

- **Theme integration** — drop-in CSS + JS that fetches social posts and renders them as comment-style cards below your post body
- **Helper tool** — optional web UI for adding/removing reply URLs without hand-editing JSON

Both are vanilla, dependency-free, MIT licensed.

## Why?

Many Ghost bloggers cross-post to Mastodon and Bluesky. Their best discussions happen in those replies — but blog readers never see them. This tool surfaces those threads on the post itself, fetched live from the source platforms (no scraping, no copies).

## What it looks like

```
┌─────────────────────────────────────────────────────┐
│  ───  Replies from the social web  ───              │
│                                                     │
│   👤  Bruce Oberg  · @bruce@xoxo.zone   Apr 21      │
│       great stuff... happy to see I do most of      │
│       these already. The AppleTV tip is a new one   │
│       to me — going to steal that for my next trip. │
│                                                     │
│   ───────────────────────────────────────────────   │
│                                                     │
│   👤  Cassie  · @cass@mstdn.social      Apr 21      │
│       Travel routers are also useful for getting    │
│       around those "1 device per room" paywalls     │
│       that some hotels still pull.                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## How it works (briefly)

1. **Per-post URL list** lives in the post's Code Injection footer as a small JSON blob (`{"replies": ["url1", "url2"]}`)
2. **Theme template** has an empty `<section>` placeholder where replies render
3. **Client-side JS** reads the URL list, fetches each post via Mastodon and Bluesky's public APIs (CORS-enabled, no auth needed), and renders styled cards
4. **Optional helper tool** provides a web UI for managing the URL lists

For a deeper architecture explainer, see [`docs/architecture.md`](docs/architecture.md).

## Installation

### 1. Add to your theme

See [`theme/INTEGRATION.md`](theme/INTEGRATION.md) for step-by-step instructions specific to **Casper**. The same pattern works for any Ghost theme — the integration is just a CSS file, a JS file, and a small HTML snippet in `post.hbs`.

### 2. (Optional) Install the helper tool

See [`helper/README.md`](helper/README.md) for setup. This is purely optional — you can skip it and hand-edit the JSON in Ghost admin if you prefer.

Two flavors are included:

- **`helper/replies-helper.html` + `helper/ghost-replies-proxy.php`** — the full helper, requires a PHP-capable server.
- **`helper/replies-helper-standalone.html`** — a single self-contained file. No server needed. Offline mode builds the script block for you to paste into Ghost manually; an opt-in direct mode talks to Ghost's Admin API straight from the browser (in-browser JWT, CORS permitting).

## Adding replies to a post (no helper)

In Ghost admin:

1. Open any post
2. Click the gear icon → **Code injection** → **Post footer**
3. Paste:

```html
<script type="application/json" id="social-replies">
{
  "replies": [
    "https://mastodon.social/@someone/123456789",
    "https://bsky.app/profile/someone.bsky.social/post/abc123"
  ]
}
</script>
```

4. Replace example URLs with real ones, save the post

That's it. Replies render on next page load.

## Adding replies (with the helper)

1. Open `replies-helper.html` in your browser
2. Search and pick a post
3. Paste URLs (one per line) in the textarea
4. Click **Save to Ghost**

The helper handles JSON formatting, deduplication, and removal of existing entries.

## Compatibility

- **Ghost** — works on Ghost(Pro) and self-hosted Ghost 5.x and 6.x
- **Themes** — Casper, Source, custom themes, Liebling, etc. The integration is theme-agnostic
- **Browsers** — modern evergreen browsers (Chrome, Safari, Firefox, Edge). Uses `fetch`, `Promise.all`, and CSS custom properties
- **Mastodon** — any instance, any version with the v1 API (effectively all of them)
- **Bluesky** — public posts only

## What this is NOT

- Not webmentions — there's no incoming federation. You curate which replies appear.
- Not real-time — replies render at page load, no websockets or live updates
- Not a comment system — it's a one-way display of social-platform replies. Readers can't post directly to your blog (use Ghost's built-in comments for that, alongside this)
- Not analytics-aware — replies are fetched fresh each visit, no view tracking

## Contributing

Contributions, bug reports, and suggestions welcome. Open an issue or PR on GitHub.

Some ideas for future improvements:

- [ ] Server-side fetching at build time (for larger blogs / better performance)
- [ ] Support for Threads, Pixelfed, other Fediverse platforms with public APIs
- [ ] Quote-post / reply-context display ("in reply to...")
- [ ] Configurable sort order (newest-first, by likes, etc.)
- [ ] Show media attachments inline

## License

MIT. See [LICENSE](LICENSE).

## Credits

Built originally for [A Whole Lotta Nothing](https://a.wholelottanothing.org). Released for anyone who wants the same feature on their Ghost blog.
