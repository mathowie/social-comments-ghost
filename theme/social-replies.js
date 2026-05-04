/**
 * Social Replies for Ghost — drop-in JavaScript
 *
 * Reads a JSON script tag (#social-replies) from the post's Code Injection
 * footer, fetches each Mastodon/Bluesky post via the platform's public API,
 * and renders threaded-comment-style cards inside an element with the
 * `data-social-replies` attribute.
 *
 * Setup is documented in README.md.
 *
 * License: MIT
 */
(function () {
  'use strict';

  function init () {
    var container = document.querySelector('[data-social-replies]');
    var dataEl = document.getElementById('social-replies');
    if (!container || !dataEl) return;

    var urls = [];
    try {
      var parsed = JSON.parse(dataEl.textContent);
      urls = Array.isArray(parsed) ? parsed : (parsed.replies || []);
    } catch (e) { return; }
    if (!urls.length) return;

    var list = container.querySelector('.social-replies-list') || container;

    // ---- Sanitize HTML from Mastodon (strips all but a, br, p, span) -------
    function sanitize (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var allowed = { A: true, BR: true, P: true, SPAN: true };
      function walk (node) {
        var kids = Array.prototype.slice.call(node.childNodes);
        kids.forEach(function (kid) {
          if (kid.nodeType !== 1) return;
          if (!allowed[kid.tagName]) {
            var text = document.createTextNode(kid.textContent);
            kid.parentNode.replaceChild(text, kid);
          } else {
            var attrs = Array.prototype.slice.call(kid.attributes);
            attrs.forEach(function (a) {
              if (kid.tagName === 'A' && a.name === 'href') {
                if (/^(https?:|mailto:)/i.test(a.value)) {
                  kid.setAttribute('target', '_blank');
                  kid.setAttribute('rel', 'noopener nofollow');
                } else {
                  kid.removeAttribute('href');
                }
              } else {
                kid.removeAttribute(a.name);
              }
            });
            walk(kid);
          }
        });
      }
      walk(doc.body);
      return doc.body.innerHTML;
    }

    function fmtDate (iso) {
      try {
        return new Date(iso).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric'
        });
      } catch (e) { return ''; }
    }

    function escapeHtml (s) {
      return (s || '').replace(/[&<>"']/g, function (c) {
        return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
      });
    }

    // ---- Render a unified card ---------------------------------------------
    function renderCard (reply) {
      var avatar = reply.avatar
        ? '<img src="' + escapeHtml(reply.avatar) + '" alt="" loading="lazy">'
        : '';
      return [
        '<div class="social-reply">',
        '  <a class="social-reply-avatar" href="' + escapeHtml(reply.authorUrl) + '" target="_blank" rel="noopener">',
        avatar,
        '  </a>',
        '  <div class="social-reply-main">',
        '    <div class="social-reply-head">',
        '      <a class="social-reply-name" href="' + escapeHtml(reply.authorUrl) + '" target="_blank" rel="noopener">',
        escapeHtml(reply.name),
        '      </a>',
        '      <span class="social-reply-handle">' + escapeHtml(reply.handle) + '</span>',
        '      <span class="social-reply-date" data-platform="' + reply.platform + '">',
        '        <a href="' + escapeHtml(reply.url) + '" target="_blank" rel="noopener">',
        fmtDate(reply.createdAt) || 'View',
        '        </a>',
        '      </span>',
        '    </div>',
        '    <div class="social-reply-body">' + reply.content + '</div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    // ---- Mastodon fetcher (works on any Mastodon instance) -----------------
    // Mastodon's /api/v1/statuses/:id is CORS-enabled by default.
    function fetchMastodon (url) {
      var u = new URL(url);
      var id = null;
      var m = u.pathname.match(/\/(?:@[^/]+|users\/[^/]+\/statuses)\/(\d+)/);
      if (m) id = m[1];
      if (!id) return Promise.reject(new Error('No status id'));
      var apiUrl = u.origin + '/api/v1/statuses/' + id;
      return fetch(apiUrl).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (s) {
        return {
          platform: 'mastodon',
          name: s.account.display_name || s.account.username,
          handle: '@' + s.account.acct + (s.account.acct.indexOf('@') === -1 ? '@' + u.host : ''),
          authorUrl: s.account.url,
          avatar: s.account.avatar,
          content: sanitize(s.content),
          createdAt: s.created_at,
          url: s.url || url
        };
      });
    }

    // ---- Bluesky fetcher ---------------------------------------------------
    // Public AppView API, no auth required, CORS-enabled.
    function fetchBluesky (url) {
      var u = new URL(url);
      var m = u.pathname.match(/\/profile\/([^/]+)\/post\/([^/]+)/);
      if (!m) return Promise.reject(new Error('Invalid Bluesky URL'));
      var handleOrDid = m[1];
      var rkey = m[2];

      var didPromise = handleOrDid.indexOf('did:') === 0
        ? Promise.resolve(handleOrDid)
        : fetch('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=' +
                encodeURIComponent(handleOrDid))
            .then(function (r) { return r.json(); })
            .then(function (j) { return j.did; });

      return didPromise.then(function (did) {
        var atUri = 'at://' + did + '/app.bsky.feed.post/' + rkey;
        return fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=' +
                     encodeURIComponent(atUri) + '&depth=0');
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        var post = j.thread && j.thread.post;
        if (!post) throw new Error('No post in response');
        var text = post.record && post.record.text || '';
        var html = '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
        return {
          platform: 'bluesky',
          name: post.author.displayName || post.author.handle,
          handle: '@' + post.author.handle,
          authorUrl: 'https://bsky.app/profile/' + post.author.handle,
          avatar: post.author.avatar,
          content: html,
          createdAt: post.record.createdAt,
          url: url
        };
      });
    }

    function fetchOne (url) {
      try {
        var u = new URL(url);
        if (u.host === 'bsky.app' || u.host.endsWith('.bsky.app')) {
          return fetchBluesky(url);
        }
        return fetchMastodon(url);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    // Kick off all fetches in parallel; failed ones are silently skipped.
    var pending = urls.map(function (url) {
      return fetchOne(url).catch(function (err) {
        console.warn('[social-replies] Failed to load', url, err);
        return null;
      });
    });

    Promise.all(pending).then(function (results) {
      var valid = results.filter(Boolean);
      if (!valid.length) {
        container.remove();
        return;
      }
      // Sort oldest-first to read like a comment thread
      valid.sort(function (a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      list.innerHTML = valid.map(renderCard).join('');
      container.hidden = false;
      container.removeAttribute('hidden');
    });
  }

  // Ghost renders {{ghost_foot}} AFTER theme scripts, so the JSON script tag
  // isn't in the DOM yet when this script runs. Defer until DOM is parsed.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
