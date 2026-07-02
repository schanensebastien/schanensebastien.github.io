/* Lightweight, dependency-free carousel for the portfolio page.
   Markup: <div class="carousel" data-carousel> with
   .carousel-slide children inside .carousel-track. */
(function () {
    function init(root) {
        var track = root.querySelector(".carousel-track");
        var slides = Array.prototype.slice.call(root.querySelectorAll(".carousel-slide"));
        if (!track || slides.length === 0) return;

        var caption = root.querySelector(".carousel-caption");
        var dotsWrap = root.querySelector(".carousel-dots");
        var index = 0;

        function captionFor(i) {
            return slides[i].getAttribute("data-caption") || "";
        }

        function render() {
            track.style.transform = "translateX(" + (-index * 100) + "%)";
            if (caption) caption.textContent = captionFor(index);
            if (dotsWrap) {
                Array.prototype.forEach.call(dotsWrap.children, function (d, i) {
                    d.setAttribute("aria-current", i === index ? "true" : "false");
                });
            }
        }

        function go(i) { index = (i + slides.length) % slides.length; render(); }

        if (dotsWrap) {
            slides.forEach(function (_, i) {
                var b = document.createElement("button");
                b.type = "button";
                b.setAttribute("aria-label", "Bild " + (i + 1));
                b.addEventListener("click", function () { go(i); });
                dotsWrap.appendChild(b);
            });
        }

        var prev = root.querySelector(".carousel-btn.prev");
        var next = root.querySelector(".carousel-btn.next");
        if (prev) prev.addEventListener("click", function () { go(index - 1); });
        if (next) next.addEventListener("click", function () { go(index + 1); });

        render();
    }

    function boot() {
        document.querySelectorAll("[data-carousel]").forEach(init);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();
