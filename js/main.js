/* General UI: mobile nav, dynamic year, re-open cookie settings. */
(function () {
    function ready(fn) {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
        else fn();
    }

    ready(function () {
        var toggle = document.querySelector(".nav-toggle");
        var nav = document.querySelector(".nav");
        if (toggle && nav) {
            function closeNav() {
                nav.classList.remove("open");
                toggle.setAttribute("aria-expanded", "false");
                toggle.setAttribute("aria-label", "Menü öffnen");
                toggle.textContent = "Menü";
            }

            toggle.addEventListener("click", function () {
                var open = nav.classList.toggle("open");
                toggle.setAttribute("aria-expanded", open ? "true" : "false");
                toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
                toggle.textContent = open ? "Schließen" : "Menü";
            });
            nav.addEventListener("click", function (e) {
                if (e.target.tagName === "A") {
                    closeNav();
                }
            });
            document.addEventListener("keydown", function (e) {
                if (e.key === "Escape" && nav.classList.contains("open")) {
                    closeNav();
                    toggle.focus();
                }
            });
            document.addEventListener("click", function (e) {
                if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== toggle) closeNav();
            });
            window.addEventListener("resize", function () {
                if (window.innerWidth > 980) closeNav();
            });
        }

        document.querySelectorAll("[data-year]").forEach(function (n) {
            n.textContent = new Date().getFullYear();
        });

        document.querySelectorAll("[data-cookie-settings]").forEach(function (n) {
            n.addEventListener("click", function (e) {
                e.preventDefault();
                if (window.DocScanConsent) window.DocScanConsent.open();
            });
        });
    });
})();
