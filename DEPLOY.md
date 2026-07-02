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

## Connect the contact form to the backend

The email backend lives in the separate `../backend/` folder (Firebase). After
you deploy it (see [`../backend/README.md`](../backend/README.md)), point the
form at the deployed endpoint URL, e.g.:

```js
await fetch("https://europe-west3-YOURPROJECT.cloudfunctions.net/contact", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, phone, message }),
  mode: "cors"
});
```

The backend already allows the `schanensebastien.com` origin via CORS.

> The older `functions/` folder inside **this** repo is the previous Gmail-OAuth2
> backend. The active backend is now `../backend/`. You can ignore or delete the
> in-repo `functions/`, `firebase.json` and `SETUP.md` to avoid confusion.

## First-time setup / DNS

See the master guide [`../DEPLOYMENT.md`](../DEPLOYMENT.md) → *Project 1:
schanensebastien.com* for repo creation, enabling Pages, and DNS records.

## Before going live — checklist

- [ ] Fill in the postal address in `impressum.html` **and** `datenschutz.html`.
- [ ] Add USt-IdNr. / Kleinunternehmer note in `impressum.html` as applicable.
- [ ] Have the privacy policy reviewed (template, not legal advice).
- [ ] Deploy `../backend/` and wire the contact form to its endpoint.
- [ ] Test the contact form end to end.
