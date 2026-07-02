/* ============================================================
   Contact form -> Firestore -> e-mail (Trigger Email extension)
   ------------------------------------------------------------
   On submit the message is written to Firestore. The Firebase
   "Trigger Email" extension turns the document in the mail
   collection into an e-mail to you. A copy is also stored in
   the messages collection so nothing is ever lost.

   If Firebase is not configured yet, the form gracefully falls
   back to opening the visitor's e-mail client (mailto:).
   ============================================================ */

(function () {
    var form = document.getElementById("contact-form");
    if (!form) return;

    var statusEl = form.querySelector(".form-status");
    var submitBtn = form.querySelector('button[type="submit"]');

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.className = "form-status" + (kind ? " " + kind : "");
    }

    function valid(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

    function mailtoFallback(data) {
        var to = window.DOCSCAN_CONTACT_TO || "schanen.sebastien@outlook.de";
        var subject = encodeURIComponent("Anfrage über schanensebastien.com — " + data.name);
        var body = encodeURIComponent(
            data.message + "\n\n—\nName: " + data.name +
            "\nE-Mail: " + data.email +
            (data.phone ? "\nTelefon: " + data.phone : "")
        );
        window.location.href = "mailto:" + to + "?subject=" + subject + "&body=" + body;
    }

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        /* Honeypot — bots fill hidden fields, humans do not. */
        var hp = form.querySelector('input[name="company"]');
        if (hp && hp.value) return;

        var data = {
            name:    (form.name && form.name.value || "").trim(),
            email:   (form.email && form.email.value || "").trim(),
            phone:   (form.phone && form.phone.value || "").trim(),
            message: (form.message && form.message.value || "").trim()
        };
        var consentBox = form.querySelector("#contact-consent");

        if (!data.name || !data.message) { setStatus("Bitte Name und Nachricht ausfüllen.", "err"); return; }
        if (!valid(data.email)) { setStatus("Bitte eine gültige E-Mail-Adresse angeben.", "err"); return; }
        if (consentBox && !consentBox.checked) { setStatus("Bitte der Verarbeitung Ihrer Angaben zustimmen.", "err"); return; }

        if (submitBtn) { submitBtn.disabled = true; }
        setStatus("Wird gesendet …", "");

        /* Preferred path: Cloud Function endpoint (Gmail OAuth2). */
        var fnBase = (window.DOCSCAN_FUNCTIONS_URL || "").replace(/\/+$/, "");
        if (fnBase) {
            try {
                var resp = await fetch(fnBase + "/sendContact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: data.name, email: data.email, phone: data.phone, message: data.message }),
                    mode: "cors",
                    credentials: "omit"
                });
                if (!resp.ok) throw new Error("status " + resp.status);
                form.reset();
                setStatus("Vielen Dank! Ihre Nachricht ist angekommen — ich melde mich verlässlich zurück.", "ok");
            } catch (err) {
                setStatus("Senden hat nicht geklappt. Bitte schreiben Sie direkt an " +
                          (window.DOCSCAN_CONTACT_TO || "") + ".", "err");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
            return;
        }

        /* Fallback path: Firestore + Trigger Email extension. */
        if (!window.DocScanFirebase || !window.DocScanFirebase.ready()) {
            mailtoFallback(data);
            setStatus("Ihr E-Mail-Programm wurde geöffnet. Falls nicht, schreiben Sie bitte direkt an " +
                      (window.DOCSCAN_CONTACT_TO || "") + ".", "ok");
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        try {
            var to = window.DOCSCAN_CONTACT_TO;
            var when = new Date().toLocaleString("de-DE");
            var textBody =
                "Neue Anfrage über schanensebastien.com\n\n" +
                "Name: " + data.name + "\n" +
                "E-Mail: " + data.email + "\n" +
                (data.phone ? "Telefon: " + data.phone + "\n" : "") +
                "Zeit: " + when + "\n\n" +
                "Nachricht:\n" + data.message + "\n";
            var htmlBody =
                "<h2>Neue Anfrage über schanensebastien.com</h2>" +
                "<p><strong>Name:</strong> " + escapeHtml(data.name) + "<br>" +
                "<strong>E-Mail:</strong> " + escapeHtml(data.email) + "<br>" +
                (data.phone ? "<strong>Telefon:</strong> " + escapeHtml(data.phone) + "<br>" : "") +
                "<strong>Zeit:</strong> " + escapeHtml(when) + "</p>" +
                "<p style='white-space:pre-wrap'>" + escapeHtml(data.message) + "</p>";

            /* 1) Keep a record of the request. */
            await window.DocScanFirebase.addDocument(
                window.DOCSCAN_MESSAGES_COLLECTION || "contact_messages",
                { name: data.name, email: data.email, phone: data.phone, message: data.message,
                  page: location.href, userAgent: navigator.userAgent }
            );

            /* 2) Hand it to the Trigger Email extension. */
            await window.DocScanFirebase.addDocument(
                window.DOCSCAN_MAIL_COLLECTION || "mail",
                { to: [to], replyTo: data.email,
                  message: { subject: "Anfrage über schanensebastien.com — " + data.name,
                             text: textBody, html: htmlBody } }
            );

            form.reset();
            setStatus("Vielen Dank! Ihre Nachricht ist angekommen — ich melde mich verlässlich zurück.", "ok");
        } catch (err) {
            setStatus("Senden hat nicht geklappt. Bitte schreiben Sie direkt an " +
                      (window.DOCSCAN_CONTACT_TO || "") + ".", "err");
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
})();
