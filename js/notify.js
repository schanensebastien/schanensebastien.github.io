/* ============================================================
   Visit + click notifications
   ------------------------------------------------------------
   Visit e-mail: sent once per page per session, AFTER the visitor
   made a choice in the consent banner (either choice). The e-mail
   includes which "Datenschutz & Tracking" option was selected.
   Click e-mails: sent for every link/button click, but only when
   "Statistik / Analyse" was allowed.
   ============================================================ */

(function () {
    var url = (window.DOCSCAN_NOTIFY_VISIT_URL || "").replace(/\/+$/, "");
    var clickUrl = (window.DOCSCAN_TRACK_CLICK_URL || "").replace(/\/+$/, "");
    if ((!url && !clickUrl) || !window.DOCSCAN_VISIT_NOTIFY) return;

    function sessionKey() {
        return "docscan-visit-pinged:" + (location.pathname || "/");
    }

    function alreadyPinged() {
        try { return sessionStorage.getItem(sessionKey()) === "1"; } catch (e) { return false; }
    }

    function markPinged() {
        try { sessionStorage.setItem(sessionKey(), "1"); } catch (e) {}
    }

    function post(endpoint, payload) {
        try {
            fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                keepalive: true,
                credentials: "omit",
                mode: "cors"
            }).catch(function () {});
        } catch (e) {}
    }

    /* Human-readable state of the "Datenschutz & Tracking" choice. */
    function consentLabel() {
        try {
            if (window.DocScanConsent && window.DocScanConsent.decided()) {
                return window.DocScanConsent.has("analytics")
                    ? "Statistik/Analyse erlaubt"
                    : "Nur notwendige (Tracking abgelehnt)";
            }
        } catch (e) {}
        return "keine Auswahl getroffen";
    }

    function send() {
        if (!url || alreadyPinged()) return;
        markPinged();
        post(url, {
            path: location.pathname + location.search,
            title: document.title,
            referrer: document.referrer || "",
            language: navigator.language || "",
            screen: (window.screen ? window.screen.width + "x" + window.screen.height : ""),
            consent: consentLabel()
        });
    }

    /* ---- click notifications ---- */

    var clicksWired = false;

    function wireClicks() {
        if (clicksWired || !clickUrl) return;
        clicksWired = true;
        document.addEventListener("click", function (e) {
            var node = e.target && e.target.closest &&
                e.target.closest("a[href], button, input[type='submit'], input[type='button'], [role='button'], [data-track]");
            if (!node) return;
            var label = (node.getAttribute("data-track") ||
                         node.getAttribute("aria-label") ||
                         (node.textContent || "").trim()).slice(0, 120);
            post(clickUrl, {
                label: label || "(no text)",
                tag: node.tagName ? node.tagName.toLowerCase() : "",
                href: node.getAttribute("href") || "",
                page: location.pathname + location.search,
                title: document.title
            });
        }, true);
    }

    function activate() {
        send();
        /* Click e-mails only when tracking was explicitly allowed. */
        if (window.DocScanConsent && window.DocScanConsent.has("analytics")) wireClicks();
    }

    function run() {
        if (window.DOCSCAN_VISIT_REQUIRE_CONSENT && window.DocScanConsent) {
            if (window.DocScanConsent.decided()) {
                activate();
            } else {
                /* Wait for the banner choice — fires on accept AND decline,
                   so the visit e-mail can report the chosen state. */
                window.DocScanConsent.onChange(function () { activate(); });
            }
        } else if (!window.DOCSCAN_VISIT_REQUIRE_CONSENT) {
            activate();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else { run(); }
})();
