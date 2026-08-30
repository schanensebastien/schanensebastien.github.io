# Deploy — schanensebastien.com (frontend)

The main static website for **[schanensebastien.com](https://schanensebastien.com)**,
hosted on **GitHub Pages**.

- Repository: `github.com/schanensebastien/schanensebastien.github.io`
- Custom domain: `schanensebastien.com` (set via the `CNAME` file)

## Preview locally

```bash
cd schanensebastien.github.io
python3 -m http.server 8080
# open http://localhost:8080
```

## Publish (upload)

GitHub Pages deploys automatically on every push to the default branch:

```bash
cd schanensebastien.github.io
git add -A
git commit -m "Update website"
git push
```

## Rebuild the bundled assets

Pages load `js/site.min.js`, not the individual scripts. After editing any of
`js/firebase-config.js`, `js/tracking-config.js`, `js/consent.js`,
`js/analytics.js`, `js/notify.js` or `js/main.js`, rebuild it in that order:

```bash
cd schanensebastien.github.io
printf 'import "./firebase-config.js";\nimport "./tracking-config.js";\nimport "./consent.js";\nimport "./analytics.js";\nimport "./notify.js";\nimport "./main.js";\n' > js/_site-entry.js
npx esbuild js/_site-entry.js --bundle --minify --charset=utf8 --target=es2015 '--banner:js="use strict";' --outfile=js/site.min.js
rm js/_site-entry.js
```

`js/contact.js` → `js/contact.min.js` and `css/docscan.css` → `css/docscan.min.css`
are built the same way. `js/estimator.js` and `css/estimator.css` are served
unminified and only on `kostenschaetzer.html`.

## Connect the contact form to the backend

The email backend lives in the separate `../backend/` folder (Firebase). After
you deploy it (see [`../backend/README.md`](../backend/README.md)), paste each
function URL into [`js/firebase-config.js`](js/firebase-config.js) (Firebase v2
gives separate `*.run.app` URLs per function):

```js
window.DOCSCAN_CONTACT_URL = "https://contact-xxxxx-ey.a.run.app";
window.DOCSCAN_NOTIFY_VISIT_URL = "https://notifyvisit-xxxxx-ey.a.run.app";
```

The backend allows the `schanensebastien.com` origin via CORS.

> The previous in-repo Gmail-OAuth2 backend (`functions/`, `firebase.json`) has
> been removed. The active backend is now the separate `../backend/` project.
> Frontend/Firebase config for this site is documented in `SETUP.md`.

## First-time setup / DNS

See the master guide [`../DEPLOYMENT.md`](../DEPLOYMENT.md) → *Project 1:
schanensebastien.com* for repo creation, enabling Pages, and DNS records.

## Before going live — checklist

- [ ] Fill in the postal address in `impressum.html` **and** `datenschutz.html`.
- [ ] Add USt-IdNr. / Kleinunternehmer note in `impressum.html` as applicable.
- [ ] Have the privacy policy reviewed (template, not legal advice).
- [ ] Deploy `../backend/` and wire the contact form to its endpoint.
- [ ] Test the contact form end to end.
