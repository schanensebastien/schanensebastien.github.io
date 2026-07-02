/* ============================================================
   Analytics — consent-gated user/click tracking via Firebase
   ------------------------------------------------------------
   Runs ONLY after the visitor accepts the "analytics" category.
   Tracks: page_view + clicks on links and buttons (so you can see
   how real visitors move through the site and which calls-to-action
   they use). No personal data is collected; IP anonymisation is
   handled by Google Analytics 4 by default.
   ============================================================ */

(function () {
    var started = false;
    var logEvent = null;

    function label(el) {
        var a = el.closest && el.closest("a,button");
        if (!a) return null;
        var txt = (a.getAttribute("data-track") ||
                   a.getAttribute("aria-label") ||
                   (a.textContent || "").trim()).slice(0, 80);
        return {
            label: txt || "(no text)",
            href: a.getAttribute("href") || "",
            tag: a.tagName.toLowerCase()
        };
    }

    function wireClicks() {
        document.addEventListener("click", function (e) {
            if (!logEvent) return;
            var info = label(e.target);
            if (!info) return;
            try {
                logEvent("select_content", {
                    content_type: info.tag === "a" ? "link" : "button",
                    item_id: info.label,
                    link_url: info.href,
                    page_path: location.pathname
                });
            } catch (err) {}
        }, true);
    }

    async function start() {
        if (started || !window.DocScanFirebase || !window.DocScanFirebase.ready()) return;
        started = true;
        try {
            var a = await window.DocScanFirebase.analytics();
            if (!a) return;
            logEvent = function (name, params) { a.api.logEvent(a.instance, name, params); };
            logEvent("page_view", {
                page_path: location.pathname,
                page_title: document.title,
                page_location: location.href
            });
            wireClicks();
        } catch (err) {
            started = false; /* allow retry if it failed */
        }
    }

    if (window.DocScanConsent) {
        window.DocScanConsent.onChange(function (s) {
            if (s && s.analytics) start();
        });
    }
})();
