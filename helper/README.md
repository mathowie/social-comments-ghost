# Replies Helper — setup

A simple web tool to manage social replies on your blog without hand-editing
JSON. Pick a post, paste URLs, click Save.

Two flavors are included — pick whichever suits your setup:

| File | Needs a server? | What it does |
| --- | --- | --- |
| `replies-helper.html` + `ghost-replies-proxy.php` | Yes — any PHP 7.4+ host | Full helper. Lists posts, reads/writes Code Injection footer via a server-side proxy that holds your Admin API key. |
| `replies-helper-standalone.html` | No — a single HTML file | Two modes in one page: an **offline JSON builder** that produces the script block to paste into Ghost yourself, plus an opt-in **direct mode** that calls Ghost's Admin API straight from the browser (in-browser JWT, no PHP). |

If you don't have a PHP-capable server, jump to [the standalone helper](#standalone-helper-no-server-needed) below.

---

## PHP-backed helper (recommended for daily use)

### What you need

- A web server that can run PHP 7.4+ with the `curl` extension. Examples:
  - A NAS like Synology (WebStation or via Docker)
  - Shared hosting (most providers support PHP)
  - A small VPS
  - Local development server (`php -S localhost:8080` for testing)
- An Admin API key for your Ghost site

### Step 1 — Create a Ghost integration

1. In Ghost admin, go to **Settings → Integrations**
2. Click **+ Add custom integration**
3. Name it "Replies Helper" and click **Add**
4. Copy the **Admin API Key** (looks like `123abc:def456...`, an ID and secret separated by a colon)
5. Note your **Admin API URL** — at the top of the integration page. For Ghost(Pro)
   accounts this is usually `https://yourblog.ghost.io` (NOT your custom domain).
   For self-hosted Ghost, it's your site URL.

### Step 2 — Configure the proxy

Open `ghost-replies-proxy.php` in any text editor and edit the two constants
at the top:

```php
const GHOST_ADMIN_URL = 'https://yourblog.ghost.io';
const GHOST_ADMIN_KEY = '123abc:def456...';
```

### Step 3 — Deploy the files

Upload **both** files to a directory on your web server:

- `ghost-replies-proxy.php`
- `replies-helper.html`

They should be in the **same directory** so the helper can find the proxy via a
relative path. If you need to put them in different places, edit the
`PROXY_URL` constant near the top of the helper HTML's inline JavaScript.

### Step 4 — Lock it down (important)

The proxy holds your Admin API key, which has full edit access to your site.
**Anyone who can reach the proxy URL can edit your posts.** Restrict access to
trusted networks only:

- **Best:** Put the URL behind a VPN, Tailscale, or local network only
- **Good:** Use HTTP basic auth (Apache `.htaccess` or nginx config)
- **Acceptable:** IP allowlist via your web server config
- **Not OK:** Leave it on the public internet with no protection

### Step 5 — Use it

1. Open `replies-helper.html` in your browser
2. Click the search box → type to filter recent posts → click one
3. The page shows what's already saved on that post (if anything)
4. Paste new reply URLs in the textarea (one per line)
5. Click **Save to Ghost**

The change is live on your blog immediately. Refresh the post page to see it.

### Removing replies

Each saved URL has a small × button. Click it to mark for removal (the row
turns red and gets struck through). Click **Save to Ghost** to commit the
removal. You can stage additions and removals together in a single save.

### Troubleshooting

**"Could not load posts: HTTP 401"**
The Admin API key isn't being accepted. Double-check both constants in
`ghost-replies-proxy.php`. Make sure the URL is the Admin URL (often `*.ghost.io`),
not your custom domain.

**"Could not load posts: HTTP 404"**
The Admin API URL is wrong. For Ghost(Pro), find the correct URL at the top
of the integration page in Ghost admin.

**Nothing happens when I click Save**
Open the browser console (Cmd+Option+I) and check for errors. Most commonly
this means the proxy file isn't reachable at the relative path
`ghost-replies-proxy.php`. Verify both files are in the same web-accessible
directory.

**Save fails with "Saving failed because of a conflict"**
Someone (probably you) edited the post in Ghost admin while the helper had it
loaded. Refresh the helper page and try again — Ghost rejects updates against
stale data to prevent accidental overwrites.

---

## Standalone helper — no server needed

`replies-helper-standalone.html` is a single self-contained file. Double-click
it (or open via a local web server, see CORS note below) and you get two
modes in one page.

### Offline mode (default — always works)

No API key, no network requests to Ghost. Just an editor that produces the
right script block.

1. Open `replies-helper-standalone.html` in any browser.
2. (Optional) In **Current footer**, paste the existing
   `<script id="social-replies">…</script>` block from your post's Code
   Injection footer so we can merge instead of overwriting.
3. In **Reply URLs**, paste new Mastodon / Bluesky URLs, one per line.
   Invalid lines and duplicates are flagged.
4. Click **Copy block**.
5. In Ghost admin, open the post → gear icon → **Code injection** →
   **Post footer**, replace the old block with the new one, click Update.

This mode works fully offline. It's the most reliable option and never
touches your API key.

### Direct mode (opt-in — full read/write)

Same UX as the PHP-backed helper, but the JWT is generated in your browser
using the Web Crypto API. No proxy file required.

1. Open the standalone helper, click the **Direct to Ghost** tab.
2. Paste your **Admin URL** (e.g. `https://yourblog.ghost.io`) and your
   **Admin API key** (`id:secret`). Click **Connect**.
3. Pick a post, manage replies, click **Save to Ghost**.

Two things to know before you use direct mode:

- **Your API key is stored in `localStorage`** so you don't have to retype
  it. Use **Forget saved key** when you're done if other people share this
  device.
- **CORS may block the request.** Ghost's Admin API is intended for
  server-side use, and depending on your setup the browser may refuse to
  call it. If Connect fails with a network/CORS error, you have three
  options: (a) use Offline mode (always works), (b) self-host Ghost and
  configure CORS to allow your origin, or (c) launch a fresh Chrome with
  `--disable-web-security --user-data-dir=/tmp/ghost-helper` for a
  one-off session. Don't browse the regular web in a CORS-disabled
  browser.

### Standalone troubleshooting

**"Network/CORS error reaching Ghost"**
The browser blocked the request. Use Offline mode, or run the file via a
local server (`python3 -m http.server 8000`) and configure Ghost to allow
that origin.

**"Admin API secret is not valid hex"**
The key field expects the literal `id:secret` string from Ghost's
Integrations page — paste it as-is. The secret half is hex.

**"Saving failed because of a conflict"**
Same as the PHP version: someone updated the post in Ghost admin while the
helper held a stale copy. Reload the helper, pick the post again, retry.
