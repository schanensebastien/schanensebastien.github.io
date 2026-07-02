/* ============================================================
   Lazy Firebase loader
   ------------------------------------------------------------
   The Firebase SDK is fetched from Google's CDN only when it is
   actually needed (a contact-form submit, or analytics AFTER the
   visitor has consented). A visitor who just browses and rejects
   tracking never triggers any request to Google.
   ============================================================ */

window.DocScanFirebase = (function () {
    var V = window.DOCSCAN_FIREBASE_SDK || "10.12.2";
    var base = "https://www.gstatic.com/firebasejs/" + V + "/";
    var appPromise = null;

    function ready() { return !!window.DOCSCAN_FIREBASE_READY; }

    async function getApp() {
        if (!ready()) throw new Error("Firebase is not configured (see js/firebase-config.js).");
        if (!appPromise) {
            appPromise = (async function () {
                var mod = await import(base + "firebase-app.js");
                return mod.initializeApp(window.DOCSCAN_FIREBASE_CONFIG);
            })();
        }
        return appPromise;
    }

    async function firestore() {
        var app = await getApp();
        var fs = await import(base + "firebase-firestore.js");
        return { db: fs.getFirestore(app), fs: fs };
    }

    /* Write a document to a collection, stamped with a server time. */
    async function addDocument(collectionName, data) {
        var ctx = await firestore();
        var payload = Object.assign({ createdAt: ctx.fs.serverTimestamp() }, data);
        return ctx.fs.addDoc(ctx.fs.collection(ctx.db, collectionName), payload);
    }

    /* Initialise Google Analytics for Firebase (consent required). */
    async function analytics() {
        var app = await getApp();
        var an = await import(base + "firebase-analytics.js");
        var ok = await an.isSupported().catch(function () { return false; });
        if (!ok) return null;
        return { instance: an.getAnalytics(app), api: an };
    }

    return {
        ready: ready,
        getApp: getApp,
        addDocument: addDocument,
        analytics: analytics
    };
})();
