# Theme integration

The theme add-on is two files plus a small HTML snippet for your `post.hbs`.
Once installed, any post can show social replies by adding a JSON list of
URLs to its Code Injection footer.

## Installation

See [INTEGRATION.md](INTEGRATION.md) for the step-by-step Casper instructions.

The short version:

1. Copy `social-replies.css` and `social-replies.js` into your theme's assets folder
2. Reference both files from `default.hbs` (CSS in `<head>`, JS at end of `<body>`)
3. Add the `<section class="social-replies" data-social-replies hidden>` snippet
   to `post.hbs` wherever you want replies to appear
4. Re-zip and upload your theme to Ghost

## How replies are added to a post

In Ghost admin, open any post and go to **Post settings → Code injection →
Post footer**. Paste:

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

That's it — the next page load will fetch each post and render them as a
threaded comment list below your post body.

For a friendlier UI than hand-editing JSON, see the [Replies Helper](../helper/)
in this repo.

## Customizing the look

The CSS uses CSS custom properties for all colors and fonts. Override any of
them in your own theme stylesheet to match your design:

```css
:root {
  --social-replies-accent: #b4421a;
  --social-replies-rule: #d9d1c0;
  --social-replies-font-body: 'Fraunces', Georgia, serif;
  --social-replies-font-sans: 'Inter', sans-serif;
}
```

See `social-replies.css` for the complete list.

## Architecture

See [../docs/architecture.md](../docs/architecture.md) for how the system
works under the hood.
