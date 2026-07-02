/* ============================================================
   Click notification (e-mail via backend)
   ------------------------------------------------------------
   After analytics consent, sends an e-mail for every click on
   links, buttons, and navigation. Uses the same backend URL as
   visit notifications (notifyVisit) with event: "click".
   Works without Firebase Analytics configuration.
   ============================================================ */

(function () {
    var url = (window.DOCSCAN_NOTIFY_VISIT_URL || "").replace(/\/+$/, "");
    if (!url || window.DOCSCAN_CLICK_NOTIFY === false) return;

    var wired = false;

    function hasConsent() {
        return window.DocScanConsent && window.DocScanConsent.has("analytics");
    }

    function interactive(el) {
        if (!el || !el.closest) return null;
        return el.closest(
            "a[href], button, input[type='submit'], input[type='button'], " +
            "[role='button'], [role='link'], summary, .btn, .nav a, " +
            ".nav-toggle, .carousel-btn, [data-track]"
        );
    }

    function clickLabel(node) {
        return (node.getAttribute("data-track") ||
                node.getAttribute("aria-label") ||
                (node.textContent || "").trim()).slice(0, 80) || "(no text)";
    }

    function sendClick(node) {
        if (!hasConsent()) return;
        var tag = node.tagName ? node.tagName.toLowerCase() : "unknown";
        var payload = {
            event: "click",
            path: location.pathname + location.search,
            title: document.title,
            label: clickLabel(node),
            href: node.getAttribute("href") || "",
            tag: tag
        };
        try {
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                keepalive: true,
                credentials: "omit",
                mode: "cors"
            }).catch(function () {});
        } catch (e) {}
    }

    function wire() {
        if (wired) return;
        wired = true;
        document.addEventListener("click", function (e) {
            if (!hasConsent()) return;
            var node = interactive(e.target);
            if (!node) return;
            sendClick(node);
        }, true);
    }

    function run() {
        if (hasConsent()) wire();
        if (window.DocScanConsent) {
            window.DocScanConsent.onChange(function (s) {
                if (s && s.analytics) wire();
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else { run(); }
})();
