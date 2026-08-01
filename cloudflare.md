# Optional Cloudflare Pages deployment

GitHub Pages is the active deployment target. If the site is moved to Cloudflare Pages, use:

- Framework preset: Hugo
- Build command: `npm ci && npm test`
- Build output directory: `public`
- Node.js: 20
- Hugo Extended: 0.164.0

The optimized files under `static/images/galleries` and the sanitized `data/galleries.json` manifest must be present in the checkout before building. Private originals under the ignored `media/gallery-originals` directory are optional and must not be uploaded to the deployment checkout.
