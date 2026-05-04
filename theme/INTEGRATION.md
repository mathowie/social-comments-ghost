# Adding the replies section to your post.hbs

You only need to add **one HTML snippet** to your theme's `post.hbs` file. It
goes anywhere inside the `<article>` element where you want the replies to
appear — typically below the post body but above any "Further Reading" or
related-posts section.

## The snippet

```handlebars
{{!-- Social Replies — JS populates this from the post's Code Injection footer.
     Hidden by default; revealed when fetched data is available. --}}
<section class="social-replies" data-social-replies hidden>
    <h3 class="social-replies-heading">
        <span class="social-replies-label">Replies from the social web</span>
    </h3>
    <div class="social-replies-list"></div>
</section>
```

## Where to put it in Casper

In the stock Casper theme's `post.hbs`, find this block near the end of the
file (around line 90 in current Casper versions):

```handlebars
                {{#match @custom.email_signup -- "Show"}}
                    {{#unless @member}}
                        ...
                    {{/unless}}
                {{/match}}
            </article>
```

Add the snippet just **before** the closing `</article>` tag:

```handlebars
                {{#match @custom.email_signup -- "Show"}}
                    {{#unless @member}}
                        ...
                    {{/unless}}
                {{/match}}

                {{!-- Social Replies --}}
                <section class="social-replies" data-social-replies hidden>
                    <h3 class="social-replies-heading">
                        <span class="social-replies-label">Replies from the social web</span>
                    </h3>
                    <div class="social-replies-list"></div>
                </section>
            </article>
```

## Loading the CSS and JS

Add these two lines inside `default.hbs` — the CSS link goes in `<head>`,
the JS goes near the end of `<body>`, just before `{{ghost_foot}}`.

In `default.hbs`, find the existing CSS link and add ours after it:

```handlebars
<link rel="stylesheet" type="text/css" href="{{asset "built/screen.css"}}" />
<link rel="stylesheet" type="text/css" href="{{asset "built/social-replies.css"}}" />
```

Then find where the existing `<script>` tags are loaded near the end of `<body>`,
and add ours after them:

```handlebars
<script defer src="{{asset "built/casper.js"}}"></script>
<script defer src="{{asset "built/social-replies.js"}}"></script>
```

> **Note on file path:** Casper compiles its CSS via Gulp into `assets/built/`.
> If you're skipping the build step and want to avoid running Gulp, you can
> drop the CSS/JS files directly into `assets/built/` and reference them as
> shown above. They are pre-compiled vanilla CSS/JS — no build needed.
>
> Alternatively, drop them into `assets/css/` and `assets/js/` then reference
> them as `{{asset "css/social-replies.css"}}` and `{{asset "js/social-replies.js"}}`.

## Customizing the look

The CSS uses CSS custom properties so you can adjust colors without editing
the file. Add overrides anywhere in your own stylesheet:

```css
:root {
  --social-replies-accent: #ff5722;
  --social-replies-rule: #d9d1c0;
  --social-replies-font-body: 'Fraunces', Georgia, serif;
}
```

See `social-replies.css` for the full list of overrideable properties.

## Smoke test

After uploading the theme:

1. Open any post in Ghost admin
2. Click the gear icon → Code injection
3. In the **Post footer** field, paste:

   ```html
   <script type="application/json" id="social-replies">
   {"replies": ["https://mastodon.social/@Gargron/111229027577729060"]}
   </script>
   ```

4. Save the post and view it on the live site

You should see a "Replies from the social web" section appear below the post,
with one Mastodon reply rendered. If you don't see it, check the browser
console for `[social-replies]` warnings.
