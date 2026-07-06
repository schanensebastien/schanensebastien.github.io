# Firebase setup — contact form e-mail & click tracking

The website works **without** Firebase: until you add your config the contact
form falls back to opening the visitor's e-mail program, and tracking stays off.
Follow the steps below to enable real e-mail delivery and analytics.

---

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com/> and **Add project**.
2. Give it a name (e.g. `schanensebastien-web`).
3. Google Analytics: enable it if you want click tracking (recommended).

## 2. Register a Web app & copy the config

1. In the project, click the **Web** icon (`</>`) → **Register app**.
2. Copy the `firebaseConfig` object that Firebase shows you.
3. Paste the values into [`js/firebase-config.js`](js/firebase-config.js),
   replacing every `REPLACE_ME`. The `measurementId` (`G-…`) is only needed for
   analytics.

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
4. Accept analytics in the cookie banner, click around, then watch
   **Firebase console → Analytics → Realtime**.

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
- Only notify after consent: `window.DOCSCAN_VISIT_REQUIRE_CONSENT = true;`

The backend's CORS allow-list must include `https://schanensebastien.com`. Deploy
and secret setup for the backend live in `../backend/README.md`.

---

## Notes on compliance

- Analytics only loads **after** the visitor accepts in the cookie banner.
- The visit e-mail sends only minimal, non-personal data and never stores/sends
  the IP. It is documented in `datenschutz.html` (legitimate interest). Set
  `DOCSCAN_VISIT_REQUIRE_CONSENT = true` if you prefer to gate it behind consent.
- The contact form is sent only on submit, and the privacy checkbox +
  [`datenschutz.html`](datenschutz.html) cover the legal basis.
- Fonts are self-hosted (`assets/fonts/`) — no Google Fonts CDN calls.
- Fill in your address in `impressum.html` and `datenschutz.html`, and have the
  privacy policy reviewed before going live.
