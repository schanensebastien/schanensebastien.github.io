/* ============================================================
   Visit + click notifications
   ------------------------------------------------------------
   E-mails you when someone views a page (once per page per session)
   and on every click on a link/button (via the trackClick endpoint).
   Both require analytics consent when DOCSCAN_VISIT_REQUIRE_CONSENT
   is true.
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

    function send() {
        if (!url || alreadyPinged()) return;
        markPinged();
        post(url, {
            path: location.pathname + location.search,
            title: document.title,
            referrer: document.referrer || "",
            language: navigator.language || "",
            screen: (window.screen ? window.screen.width + "x" + window.screen.height : "")
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
        wireClicks();
    }

    function run() {
        if (window.DOCSCAN_VISIT_REQUIRE_CONSENT) {
            if (window.DocScanConsent && window.DocScanConsent.has("analytics")) {
                activate();
            } else if (window.DocScanConsent) {
                window.DocScanConsent.onChange(function (s) { if (s && s.analytics) activate(); });
            }
        } else {
            activate();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else { run(); }
})();
