/* ============================================================
   Consent-gated Google Analytics 4, Google Tag Manager and Meta
   ------------------------------------------------------------
   - No Google or Meta request is made before explicit consent.
   - Google Analytics/Tag Manager and Meta are separate purposes.
   - Events never contain values entered in contact form fields.
   ============================================================ */

(function () {
    "use strict";

    var cfg = window.DOCSCAN_TRACKING || {};
    var gaId = String(cfg.googleMeasurementId || "").trim();
    var gtmId = String(cfg.googleTagManagerId || "").trim();
    var metaId = String(cfg.metaPixelId || "").trim();
    var gaReady = /^G-[A-Z0-9]+$/i.test(gaId) && gaId.indexOf("REPLACE_ME") === -1;
    var gtmReady = /^GTM-[A-Z0-9]+$/i.test(gtmId) && gtmId.indexOf("REPLACE_ME") === -1;
    var metaReady = /^\d{5,}$/.test(metaId) && metaId.indexOf("REPLACE_ME") === -1;
    var googleStarted = false;
    var googleActive = false;
    var googleDefaultSet = false;
    var tagManagerStarted = false;
    var metaStarted = false;
    var metaActive = false;
    var clicksWired = false;

    function ensureGtag() {
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    }

    function googleConsentDefault() {
        if ((!gaReady && !gtmReady) || googleDefaultSet) return;
        googleDefaultSet = true;
        ensureGtag();
        window.gtag("consent", "default", {
            analytics_storage: "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied"
        });
        window.gtag("set", "ads_data_redaction", true);
    }

    function googleConsent(granted) {
        if (!gaReady && !gtmReady) return;
        ensureGtag();
        if (gaReady) window["ga-disable-" + gaId] = !granted;
        window.gtag("consent", "update", {
            analytics_storage: granted ? "granted" : "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied"
        });
        googleActive = granted;
    }

    function startTagManager() {
        if (!gtmReady || tagManagerStarted) return;
        tagManagerStarted = true;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });

        var script = document.createElement("script");
        script.async = true;
        script.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(gtmId);
        document.head.appendChild(script);
    }

    function startGoogle() {
        if (!gaReady && !gtmReady) return;
        if (googleStarted) {
            googleConsent(true);
            if (gaReady) window.gtag("event", "page_view", {
                page_location: location.href,
                page_path: location.pathname + location.search,
                page_title: document.title
            });
            return;
        }

        googleStarted = true;
        googleConsentDefault();
        googleConsent(true);
        if (gaReady) {
            window.gtag("js", new Date());
            window.gtag("config", gaId, {
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
                send_page_view: true
            });

            /* GTM processes the queued config command and loads the Google tag.
               Without a container, fall back to the standalone gtag.js loader. */
            if (!gtmReady) {
                var script = document.createElement("script");
                script.async = true;
                script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gaId);
                document.head.appendChild(script);
            }
        }
        startTagManager();
    }

    function installMetaBase() {
        if (window.fbq) return;
        var fbq = window.fbq = function () {
            fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
        };
        if (!window._fbq) window._fbq = fbq;
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = [];

        var script = document.createElement("script");
        script.async = true;
        script.src = "https://connect.facebook.net/en_US/fbevents.js";
        var first = document.getElementsByTagName("script")[0];
        first.parentNode.insertBefore(script, first);
    }

    function startMeta() {
        if (!metaReady) return;
        if (metaStarted) {
            window.fbq("consent", "grant");
            window.fbq("track", "PageView");
            metaActive = true;
            return;
        }

        metaStarted = true;
        installMetaBase();
        window.fbq("consent", "grant");
        window.fbq("init", metaId);
        window.fbq("track", "PageView");
        metaActive = true;
    }

    function stopMeta() {
        metaActive = false;
        if (metaStarted && window.fbq) window.fbq("consent", "revoke");
    }

    function googleEvent(name, parameters) {
        if (!googleActive || !gaReady || !window.gtag) return;
        var values = parameters || {};
        if (!values.page_path) values.page_path = location.pathname;
        window.gtag("event", name, values);
    }

    function metaEvent(name, parameters, custom) {
        if (!metaActive || !window.fbq) return;
        window.fbq(custom ? "trackCustom" : "track", name, parameters || {});
    }

    function trackedNode(target) {
        if (!target || !target.closest) return null;
        return target.closest(
            "[data-track], [data-estimator-cta], a[href^='tel:'], a[href^='mailto:'], " +
            "a[href*='testordner'], a[href*='kostenschaetzer'], button[type='submit']"
        );
    }

    function destination(node) {
        var href = node.getAttribute("href") || "";
        if (href.indexOf("tel:") === 0) return "phone";
        if (href.indexOf("mailto:") === 0) return "email";
        if (!href) return "form";
        try {
            var url = new URL(href, location.href);
            return url.origin === location.origin ? url.pathname : url.hostname;
        } catch (e) { return "link"; }
    }

    function isTestFolder(node, target) {
        var marker = (node.getAttribute("data-track") || "").toLowerCase();
        return target.indexOf("testordner") !== -1 || marker.indexOf("testordner") !== -1 ||
               marker.indexOf("test-folder") !== -1;
    }

    function isContactCta(node) {
        var href = (node.getAttribute("href") || "").toLowerCase();
        var marker = (node.getAttribute("data-track") || "").toLowerCase();
        return href.indexOf("#kontakt") !== -1 || href.indexOf("#anfragen") !== -1 ||
               marker.indexOf("contact") !== -1 || node.matches("button[type='submit']");
    }

    function estimatorHref(node) {
        var href = node.getAttribute("href") || "";
        try {
            return new URL(href, location.href).pathname.indexOf("kostenschaetzer") !== -1;
        } catch (e) { return false; }
    }

    function estimatorLocation(node) {
        var loc = String(node.getAttribute("data-estimator-cta") || "").replace(/[^a-z0-9_]/gi, "").slice(0, 80);
        if (loc === "navigation") {
            var nav = node.closest(".nav");
            if (nav && nav.classList.contains("open")) return "mobile_navigation";
        }
        return loc || "internal_link";
    }

    function rememberEstimatorEntry(locationId) {
        try {
            sessionStorage.setItem("docscan-estimator-entry", JSON.stringify({
                cta: locationId,
                page: location.pathname || "/",
                at: new Date().toISOString()
            }));
        } catch (e) {}
    }

    function trackEstimatorCta(node) {
        if (location.pathname.indexOf("kostenschaetzer") !== -1) return;
        var ctaLocation = estimatorLocation(node);
        rememberEstimatorEntry(ctaLocation);
        var text = (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
        googleEvent("cost_estimator_cta_click", {
            cta_location: ctaLocation,
            source_page: location.pathname || "/",
            link_target: "/kostenschaetzer.html",
            cta_text: text
        });
        metaEvent("CostEstimatorCTA", {
            location: ctaLocation,
            source_page: location.pathname || "/"
        }, true);
    }

    function wireClicks() {
        if (clicksWired) return;
        clicksWired = true;
        document.addEventListener("click", function (event) {
            var node = trackedNode(event.target);
            if (!node) return;

            if (node.getAttribute("data-estimator-cta") || estimatorHref(node)) {
                try { trackEstimatorCta(node); } catch (e) {}
                return;
            }

            var label = (node.getAttribute("data-track") ||
                         node.getAttribute("aria-label") ||
                         (node.textContent || "").trim()).slice(0, 80) || "cta";
            var target = destination(node);
            var parameters = {
                cta_name: label,
                cta_destination: target,
                page_path: location.pathname
            };

            googleEvent("cta_click", parameters);

            if (target === "phone") {
                googleEvent("phone_click", parameters);
                googleEvent("contact_click", parameters);
                metaEvent("Contact", { contact_method: "phone" });
            } else if (target === "email") {
                googleEvent("email_click", parameters);
                googleEvent("contact_click", parameters);
                metaEvent("Contact", { contact_method: "email" });
            } else if (isTestFolder(node, target)) {
                googleEvent("test_folder_click", parameters);
                googleEvent("contact_cta_click", parameters);
                metaEvent("ViewContent", { content_name: "Kostenloser Testordner" });
            } else if (isContactCta(node)) {
                googleEvent("contact_cta_click", parameters);
            }
        }, true);
    }

    function lead(formName) {
        var name = formName || "contact-form";
        googleEvent("generate_lead", {
            method: "contact_form",
            form_id: name,
            page_path: location.pathname
        });
        metaEvent("Lead", { content_name: "Kontaktanfrage", content_category: "Dokumentendigitalisierung" });
    }

    function applyConsent(state) {
        state = state || {};
        if (state.analytics && !googleActive) startGoogle();
        else if (!state.analytics && googleActive) googleConsent(false);

        if (state.marketing && !metaActive) startMeta();
        else if (!state.marketing && metaActive) stopMeta();
    }

    wireClicks();
    googleConsentDefault();
    window.DocScanAnalytics = {
        event: googleEvent,
        metaEvent: metaEvent,
        lead: lead
    };
    if (window.DocScanConsent) {
        window.DocScanConsent.onChange(applyConsent);
    }
})();
