/* ============================================================
   Consent manager (GDPR / TDDDG)
   ------------------------------------------------------------
   - "Necessary" is always on and stores nothing trackable.
   - "Analytics" is strictly opt-in. Nothing tracking-related runs
     and no Google request is made until the visitor accepts.
   - Choice is remembered in localStorage and can be changed any
     time via the footer "Cookie-Einstellungen" link.
   ============================================================ */

window.DocScanConsent = (function () {
    var KEY = "docscan-consent-v1";
    var listeners = [];
    var state = load();

    function load() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    function save(s) {
        s.ts = new Date().toISOString();
        state = s;
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
        listeners.forEach(function (cb) { try { cb(s); } catch (e) {} });
        document.dispatchEvent(new CustomEvent("docscan:consent", { detail: s }));
    }

    function has(category) {
        if (category === "necessary") return true;
        return !!(state && state[category]);
    }

    function decided() { return state !== null; }

    function onChange(cb) {
        listeners.push(cb);
        if (state) { try { cb(state); } catch (e) {} }
    }

    /* ---------- UI ---------- */
    var el = null;

    function setSettingsOpen(open) {
        var d = el.querySelector(".consent-detail");
        var saveBtn = el.querySelector('[data-act="save"]');
        var toggleBtn = el.querySelector('[data-act="toggle"]');
        if (open) {
            d.removeAttribute("hidden");
            saveBtn.removeAttribute("hidden");
            if (toggleBtn) toggleBtn.textContent = "Einstellungen schließen";
            if (state) el.querySelector("#consent-analytics").checked = !!state.analytics;
        } else {
            d.setAttribute("hidden", "");
            saveBtn.setAttribute("hidden", "");
            if (toggleBtn) toggleBtn.textContent = "Einstellungen";
        }
    }

    function build() {
        if (el) return el;
        el = document.createElement("section");
        el.className = "consent";
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-live", "polite");
        el.setAttribute("aria-label", "Cookie- und Tracking-Einstellungen");
        el.innerHTML =
            '<h2>Datenschutz &amp; Tracking</h2>' +
            '<p>Diese Website nutzt nur technisch notwendige Speicherung. Optional messe ich ' +
            'mit Firebase/Google Analytics anonymisiert, wie die Seite genutzt wird, um sie zu ' +
            'verbessern. Das geschieht erst mit Ihrer Einwilligung. Mehr dazu in der ' +
            '<a href="datenschutz.html">Datenschutz&shy;erklärung</a>.</p>' +
            '<div class="consent-detail" hidden>' +
              '<label class="consent-opt">' +
                '<input type="checkbox" checked disabled>' +
                '<span><strong>Notwendig</strong>Für den Betrieb der Seite erforderlich. Immer aktiv.</span>' +
              '</label>' +
              '<label class="consent-opt">' +
                '<input type="checkbox" id="consent-analytics">' +
                '<span><strong>Statistik / Analyse</strong>Firebase &amp; Google Analytics — anonymisierte Nutzungsmessung.</span>' +
              '</label>' +
            '</div>' +
            '<div class="consent-actions">' +
              '<button type="button" class="btn btn-primary" data-act="all">Alle akzeptieren</button>' +
              '<button type="button" class="btn btn-ghost" data-act="necessary">Nur notwendige</button>' +
              '<button type="button" class="btn-text" data-act="toggle">Einstellungen</button>' +
              '<button type="button" class="btn btn-ghost" data-act="save" hidden>Auswahl speichern</button>' +
            '</div>';

        el.addEventListener("click", function (e) {
            var act = e.target.getAttribute && e.target.getAttribute("data-act");
            if (!act) return;
            if (act === "all") { save({ analytics: true }); hide(); }
            else if (act === "necessary") { save({ analytics: false }); hide(); }
            else if (act === "toggle") {
                var d = el.querySelector(".consent-detail");
                setSettingsOpen(d.hasAttribute("hidden"));
            }
            else if (act === "save") {
                save({ analytics: !!el.querySelector("#consent-analytics").checked });
                hide();
            }
        });

        document.body.appendChild(el);
        return el;
    }

    function show() { build().removeAttribute("hidden"); }
    function hide() { if (el) el.setAttribute("hidden", ""); }

    function open() {
        build();
        setSettingsOpen(true);
        show();
    }

    function init() {
        if (!decided()) show();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else { init(); }

    return { has: has, onChange: onChange, open: open, decided: decided };
})();
