/* ============================================================
   Visit notification
   ------------------------------------------------------------
   Pings the /notifyVisit Cloud Function so you get an e-mail when
   someone visits. Sent at most once per browser session and only
   if a functions URL is configured. No personal data is collected
   client-side; the request carries page, referrer, language and
   screen size only.
   ============================================================ */

(function () {
    var base = (window.DOCSCAN_FUNCTIONS_URL || "").replace(/\/+$/, "");
    if (!base || !window.DOCSCAN_VISIT_NOTIFY) return;

    var KEY = "docscan-visit-pinged";

    function alreadyPinged() {
        try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; }
    }
    function markPinged() {
        try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
    }

    function send() {
        if (alreadyPinged()) return;
        markPinged();
        var payload = {
            path: location.pathname + location.search,
            title: document.title,
            referrer: document.referrer || "",
            language: navigator.language || "",
            screen: (window.screen ? window.screen.width + "x" + window.screen.height : "")
        };
        try {
            fetch(base + "/notifyVisit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                keepalive: true,
                credentials: "omit",
                mode: "cors"
            }).catch(function () {});
        } catch (e) {}
    }

    function run() {
        if (window.DOCSCAN_VISIT_REQUIRE_CONSENT) {
            if (window.DocScanConsent && window.DocScanConsent.has("analytics")) {
                send();
            } else if (window.DocScanConsent) {
                window.DocScanConsent.onChange(function (s) { if (s && s.analytics) send(); });
            }
        } else {
            send();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else { run(); }
})();
