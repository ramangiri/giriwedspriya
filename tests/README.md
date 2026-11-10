# RSVP regression tests

These tests use synthetic guests, dummy authentication fixtures, and intercepted network responses. They do not submit to the live site, read real guests, or require production credentials.

- `npm --prefix tests ci && npm --prefix tests test` runs all 18 DOM/server regressions using Node 20+ and jsdom. No browser or production access is required.
- `node --test tests/rsvp-server.test.mjs` checks the Netlify function contract, missing configuration, authorization, pagination, and failures (Node 20+).

DOM coverage includes removing private rows/counts/search on lock; ignored late refresh successes and failures; ignored late CSV reads; lock/reopen session isolation; CSV versus refresh ordering; back/forward-cache clearing; and the guest RSVP field contract with dashboard counts.

Live end-to-end syncing still requires an authorized dashboard session and a configured `NETLIFY_RSVP_API_TOKEN` in the site's Netlify Functions environment. These local tests do not claim that production credentials are configured.
