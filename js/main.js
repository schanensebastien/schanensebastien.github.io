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
            toggle.addEventListener("click", function () {
                var open = nav.classList.toggle("open");
                toggle.setAttribute("aria-expanded", open ? "true" : "false");
            });
            nav.addEventListener("click", function (e) {
                if (e.target.tagName === "A") {
                    nav.classList.remove("open");
                    toggle.setAttribute("aria-expanded", "false");
                }
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
