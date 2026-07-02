/* ============================================================
   Analytics — consent-gated click & page tracking via Firebase
   ------------------------------------------------------------
   Runs ONLY after the visitor accepts "Statistik / Analyse".
   Logs a page_view on every page load and every click on links,
   buttons, and other interactive elements (not just the first visit).
   ============================================================ */

(function () {
    var started = false;
    var logEvent = null;

    function isInteractive(el) {
        if (!el || !el.closest) return null;
        return el.closest(
            "a[href], button, input[type='submit'], input[type='button'], " +
            "[role='button'], [role='link'], summary, label[for], " +
            ".btn, .nav a, .carousel-btn, [data-track]"
        );
    }

    function clickInfo(el) {
        var node = isInteractive(el);
        if (!node) return null;
        var tag = node.tagName ? node.tagName.toLowerCase() : "unknown";
        var txt = (node.getAttribute("data-track") ||
                   node.getAttribute("aria-label") ||
                   (node.textContent || "").trim()).slice(0, 80);
        return {
            label: txt || "(no text)",
            href: node.getAttribute("href") || "",
            tag: tag,
            id: node.id || "",
            classes: (node.className && String(node.className).split(/\s+/).slice(0, 3).join(" ")) || ""
        };
    }

    function wireClicks() {
        document.addEventListener("click", function (e) {
            if (!logEvent) return;
            var info = clickInfo(e.target);
            if (!info) return;
            try {
                logEvent("click", {
                    element_tag: info.tag,
                    element_id: info.label,
                    link_url: info.href,
                    page_path: location.pathname,
                    page_title: document.title
                });
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
            if (!a) { started = false; return; }
            logEvent = function (name, params) { a.api.logEvent(a.instance, name, params); };
            logEvent("page_view", {
                page_path: location.pathname,
                page_title: document.title,
                page_location: location.href
            });
            wireClicks();
        } catch (err) {
            started = false;
        }
    }

    function tryStart() {
        if (window.DocScanConsent && window.DocScanConsent.has("analytics")) {
            start();
        }
    }

    if (window.DocScanConsent) {
        window.DocScanConsent.onChange(function (s) {
            if (s && s.analytics) start();
        });
        tryStart();
    }
})();
