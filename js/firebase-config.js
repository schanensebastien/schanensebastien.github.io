/* ============================================================
   Firebase configuration
   ------------------------------------------------------------
   Paste the config object from your Firebase project here.
   Firebase console -> Project settings -> "Your apps" -> Web app.

   Until the apiKey below is replaced, the contact form falls back
   to a normal e-mail link and analytics stays off — the site keeps
   working with NO third-party requests. See SETUP.md.
   ============================================================ */

window.DOCSCAN_FIREBASE_CONFIG = {
    apiKey:            "REPLACE_ME",
    authDomain:        "REPLACE_ME.firebaseapp.com",
    projectId:         "REPLACE_ME",
    storageBucket:     "REPLACE_ME.appspot.com",
    messagingSenderId: "REPLACE_ME",
    appId:             "REPLACE_ME",
    measurementId:     "G-REPLACE_ME"   // optional, for Analytics
};

/* Firestore collection watched by the "Trigger Email" extension. */
window.DOCSCAN_MAIL_COLLECTION = "mail";

/* Firestore collection that keeps a copy of every contact request. */
window.DOCSCAN_MESSAGES_COLLECTION = "contact_messages";

/* Where contact-form messages are e-mailed to. */
window.DOCSCAN_CONTACT_TO = "schanen.sebastien@outlook.de";

/* ---- Cloud Functions backend (../backend/) ----
   Firebase Functions v2 gives each function its own URL (*.run.app).
   Paste the full URLs from `firebase deploy` output — no trailing slash. */
window.DOCSCAN_CONTACT_URL = "https://contact-7tacntja7a-ey.a.run.app";
window.DOCSCAN_NOTIFY_VISIT_URL = "https://notifyvisit-7tacntja7a-ey.a.run.app";

/* Send yourself an e-mail when someone visits (once per browser session).
   Uses POST /notifyVisit on the backend. */
window.DOCSCAN_VISIT_NOTIFY = true;

/* If true, the visit e-mail is only sent after the visitor accepts the
   "analytics" category in the cookie banner. Default false: a minimal,
   non-personal notification is sent on legitimate-interest grounds. */
window.DOCSCAN_VISIT_REQUIRE_CONSENT = false;

/* Firebase JS SDK version loaded on demand from the official CDN. */
window.DOCSCAN_FIREBASE_SDK = "10.12.2";

/* True only once a real apiKey has been pasted in above. */
window.DOCSCAN_FIREBASE_READY =
    typeof window.DOCSCAN_FIREBASE_CONFIG.apiKey === "string" &&
    window.DOCSCAN_FIREBASE_CONFIG.apiKey.indexOf("REPLACE_ME") === -1;
