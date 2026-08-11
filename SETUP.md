# Website setup — contact form, Google Analytics & Meta Pixel

The website works **without** Firebase or tracking IDs: the contact form uses its
configured backend and Google/Meta tracking stays off. Follow the steps below to
configure the optional services.

---

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com/> and **Add project**.
2. Give it a name (e.g. `schanensebastien-web`).
3. Google Analytics in Firebase can stay disabled; website analytics is configured
   separately in Part C below.

## 2. Register a Web app & copy the config

1. In the project, click the **Web** icon (`</>`) → **Register app**.
2. Copy the `firebaseConfig` object that Firebase shows you.
3. Paste the values into [`js/firebase-config.js`](js/firebase-config.js),
   replacing every `REPLACE_ME` required for the contact form. The website's GA4
   ID belongs in [`js/tracking-config.js`](js/tracking-config.js), not here.

Once a real `apiKey` is in place, `DOCSCAN_FIREBASE_READY` becomes `true`
automatically and the form starts saving to Firestore.

## 3. Enable Cloud Firestore

1. Firebase console → **Build → Firestore Database → Create database**.
2. Choose a **location in the EU** (e.g. `eur3` / `europe-west`) for GDPR.
3. Start in **production mode**, then set the security rules below.

### Firestore security rules

The website only needs to *create* documents (never read them from the browser).
Paste this in **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /contact_messages/{doc} {
      allow create: if true;
      allow read, update, delete: if false;
    }
    match /mail/{doc} {
      allow create: if true;
      allow read, update, delete: if false;
    }
  }
}
```

This lets the public form submit messages but keeps everything unreadable to the
public. You read the messages in the Firebase console (or your inbox).

## 4. Install the "Trigger Email" extension (sends the e-mail)

1. Firebase console → **Extensions** → find **Trigger Email from Firestore**
   (`firebase/firestore-send-email`) → **Install**.
   *(Requires the Blaze pay-as-you-go plan; the free monthly quota is generous.)*
2. During configuration set:
   - **Email documents collection:** `mail`  ← must match `DOCSCAN_MAIL_COLLECTION`
   - **SMTP connection URI:** your mail provider's SMTP string, e.g.
     `smtps://user@example.com:PASSWORD@smtp.example.com:465`
     (e.g. Outlook/Office 365, Gmail with app password, or a transactional
     provider such as Brevo/Mailgun).
   - **Default FROM address:** an address you're allowed to send from.
3. Finish installation.

Now every contact-form submission writes a document to `mail`, and the extension
e-mails it to `DOCSCAN_CONTACT_TO` (`schanen.sebastien@outlook.de`).

## 5. Restrict the API key (recommended)

In Google Cloud Console → **APIs & Services → Credentials**, restrict the web API
key to your domain (`schanensebastien.com`, `*.github.io`) under
**Application restrictions → HTTP referrers**.

## 6. Test

1. Open the site, submit a test message via the contact form.
2. Check **Firestore → contact_messages** for the stored copy.
3. Check the inbox of `DOCSCAN_CONTACT_TO` for the e-mail.
4. Test Google and Meta tracking separately as described in Part C.

---

# Part B — Contact & visit e-mail (separate backend)

The e-mail endpoints are provided by a **separate backend** (`../backend/`, its
own Firebase Cloud Functions project) and are **not** part of this repository.
The frontend just calls each function's URL.

Set the deployed URLs in [`js/firebase-config.js`](js/firebase-config.js)
(full `*.run.app` URLs from the backend deploy, no trailing slash):

```js
window.DOCSCAN_CONTACT_URL      = "https://contact-xxxxx-ey.a.run.app";
window.DOCSCAN_NOTIFY_VISIT_URL = "https://notifyvisit-xxxxx-ey.a.run.app";
window.DOCSCAN_TRACK_CLICK_URL  = "https://trackclick-xxxxx-ey.a.run.app";
```

Then:

- The contact form POSTs to `DOCSCAN_CONTACT_URL` (and falls back to Firestore or
  a `mailto:` link if it is left empty).
- A visit POSTs to `DOCSCAN_NOTIFY_VISIT_URL` once per browser session.
- Turn visit e-mails off: `window.DOCSCAN_VISIT_NOTIFY = false;`
- Only notify after explicit statistics consent: `window.DOCSCAN_VISIT_REQUIRE_CONSENT = true;`

The backend's CORS allow-list must include `https://schanensebastien.com`. Deploy
and secret setup for the backend live in `../backend/README.md`.

---

# Part C — Google Analytics 4, Tag Manager & Meta Pixel

Tracking is configured in [`js/tracking-config.js`](js/tracking-config.js).
Google and Meta load only after the visitor accepts the corresponding category
in the banner.

## Google Analytics 4

Configured identifiers:

- GA4 Measurement ID: `G-XKEVMQ5X28`
- Google Tag Manager: `GTM-NQMGFFW9`

In GA4 Realtime, test after accepting **Statistik** in the banner. The website
queues the GA4 configuration and then loads the GTM container after consent;
the container loads the Google tag for `G-XKEVMQ5X28`. Do **not** add another
GA4 Google tag with the same Measurement ID inside GTM, otherwise page views
and events can be counted twice.

GA4 records the original source/medium, campaign parameters and page views.
Enhanced Measurement supplies `click`, `scroll`, `file_download`, `form_start`
and `form_submit` when those switches are enabled in the web stream. The website
adds `cta_click`, `contact_click`, `contact_cta_click`, `email_click`,
`phone_click`, `test_folder_click` and, only after a successful form delivery,
`generate_lead`. `qualify_lead`, `close_convert_lead` and `purchase` must not be
fired by a normal page visit; add them later from a CRM or completed sales flow.
Google Signals and ad-personalisation signals are disabled in the website code.

## Meta Pixel / Dataset

Configured Meta Pixel / Dataset ID: `1703452621339104`.

Use **Test events** in Events Manager after accepting **Meta** in the banner.

The website sends `PageView`, `Contact`, `ViewContent` (for the test-folder
offer) and `Lead` after a successful form delivery. It deliberately contains no
`noscript` pixel, because that would bypass the visitor's consent choice.

## Tagged links for reliable social attribution

In-app browsers sometimes omit the referrer. Use these URLs in profile links:

- LinkedIn: `https://schanensebastien.com/?utm_source=linkedin&utm_medium=social&utm_campaign=organic_social&utm_content=profile`
- Facebook: `https://schanensebastien.com/?utm_source=facebook&utm_medium=social&utm_campaign=organic_social&utm_content=page`
- Instagram: `https://schanensebastien.com/?utm_source=instagram&utm_medium=social&utm_campaign=organic_social&utm_content=bio`
- Medium: `https://schanensebastien.com/?utm_source=medium&utm_medium=referral&utm_campaign=content&utm_content=profile`

For individual posts, change only `utm_content`, for example to
`post-dokumente-suchen`. This keeps GA4 reports comparable without creating a
different campaign name for every post.

---

## Notes on compliance

- Google Analytics and Meta Pixel load **only after separate consent** in the banner.
- The visit e-mail sends only minimal page/technical data and never stores the
  IP in its payload. With `DOCSCAN_VISIT_REQUIRE_CONSENT = true`, it is sent only
  after explicit statistics consent.
- The contact form is sent only on submit, and the privacy checkbox +
  [`datenschutz.html`](datenschutz.html) cover the legal basis.
- Fonts are self-hosted (`assets/fonts/`) — no Google Fonts CDN calls.
- Fill in your address in `impressum.html` and `datenschutz.html`, and have the
  privacy policy reviewed before going live.
