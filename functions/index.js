/* ============================================================
   Cloud Functions for schanensebastien.com
   ------------------------------------------------------------
   Two HTTPS endpoints the website frontend calls:

     POST /notifyVisit  -> e-mails you when someone visits
     POST /sendContact  -> e-mails you a contact-form message

   Mail is sent from your Gmail account via nodemailer using
   OAuth2 (clientId / clientSecret / refreshToken) — the same
   "specific Google tokens" approach you used before. No password
   is stored; nodemailer refreshes the access token automatically.

   Configuration (see functions/.env.example and SETUP.md):
     defineString  -> GMAIL_USER, GMAIL_CLIENT_ID, MAIL_TO, ALLOWED_ORIGINS
     defineSecret  -> GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
   ============================================================ */

const { onRequest } = require("firebase-functions/v2/https");
const { defineString, defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const nodemailer = require("nodemailer");

setGlobalOptions({ region: "europe-west3", maxInstances: 5 });

const GMAIL_USER          = defineString("GMAIL_USER");
const GMAIL_CLIENT_ID     = defineString("GMAIL_CLIENT_ID");
const MAIL_TO             = defineString("MAIL_TO");
const ALLOWED_ORIGINS     = defineString("ALLOWED_ORIGINS", {
    default: "https://schanensebastien.com,https://www.schanensebastien.com,http://localhost:8080,http://localhost:8123"
});
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN");

const SECRETS = [GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN];

/* ---------- helpers ---------- */

let _transport = null;
function transport() {
    if (_transport) return _transport;
    _transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: GMAIL_USER.value(),
            clientId: GMAIL_CLIENT_ID.value(),
            clientSecret: GMAIL_CLIENT_SECRET.value(),
            refreshToken: GMAIL_REFRESH_TOKEN.value()
        }
    });
    return _transport;
}

function allowedOrigins() {
    return ALLOWED_ORIGINS.value().split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

/* Apply CORS headers; returns the matched origin or null. */
function applyCors(req, res) {
    const origin = req.headers.origin;
    const list = allowedOrigins();
    const ok = origin && list.indexOf(origin) !== -1;
    if (ok) res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    return ok ? origin : null;
}

function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
}

function clip(s, n) { return String(s == null ? "" : s).slice(0, n); }

function recipient() { return MAIL_TO.value() || GMAIL_USER.value(); }

/* ============================================================
   POST /notifyVisit
   ------------------------------------------------------------
   Sends a short "someone visited" e-mail. Deliberately minimal:
   no IP is stored or sent. Referer / User-Agent are the same
   fields already present in standard server logs.
   ============================================================ */
exports.notifyVisit = onRequest({ secrets: SECRETS, cors: false }, async (req, res) => {
    const origin = applyCors(req, res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    if (!origin) { res.status(403).json({ ok: false, error: "origin_not_allowed" }); return; }

    const b = req.body || {};
    const info = {
        page:      clip(b.path || "/", 300),
        title:     clip(b.title, 200),
        referrer:  clip(b.referrer || "(direct)", 300),
        language:  clip(b.language, 40),
        screen:    clip(b.screen, 40),
        ua:        clip(req.headers["user-agent"], 300),
        when:      new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })
    };

    const text =
        "Neuer Besuch auf schanensebastien.com\n\n" +
        "Seite:     " + info.page + "\n" +
        "Titel:     " + info.title + "\n" +
        "Referrer:  " + info.referrer + "\n" +
        "Sprache:   " + info.language + "\n" +
        "Bildschirm:" + info.screen + "\n" +
        "Browser:   " + info.ua + "\n" +
        "Zeit:      " + info.when + "\n";

    const html =
        "<h2>Neuer Besuch auf schanensebastien.com</h2>" +
        "<table cellpadding='4' style='font-family:sans-serif;font-size:14px'>" +
        "<tr><td><b>Seite</b></td><td>" + escapeHtml(info.page) + "</td></tr>" +
        "<tr><td><b>Titel</b></td><td>" + escapeHtml(info.title) + "</td></tr>" +
        "<tr><td><b>Referrer</b></td><td>" + escapeHtml(info.referrer) + "</td></tr>" +
        "<tr><td><b>Sprache</b></td><td>" + escapeHtml(info.language) + "</td></tr>" +
        "<tr><td><b>Bildschirm</b></td><td>" + escapeHtml(info.screen) + "</td></tr>" +
        "<tr><td><b>Browser</b></td><td>" + escapeHtml(info.ua) + "</td></tr>" +
        "<tr><td><b>Zeit</b></td><td>" + escapeHtml(info.when) + "</td></tr>" +
        "</table>";

    try {
        await transport().sendMail({
            from: '"schanensebastien.com" <' + GMAIL_USER.value() + ">",
            to: recipient(),
            subject: "Besuch: " + info.page,
            text: text,
            html: html
        });
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error("notifyVisit failed:", err && err.message);
        res.status(500).json({ ok: false });
    }
});

/* ============================================================
   POST /sendContact
   ------------------------------------------------------------
   Body: { name, email, phone, message, company (honeypot) }
   ============================================================ */
exports.sendContact = onRequest({ secrets: SECRETS, cors: false }, async (req, res) => {
    const origin = applyCors(req, res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    if (!origin) { res.status(403).json({ ok: false, error: "origin_not_allowed" }); return; }

    const b = req.body || {};
    if (b.company) { res.status(200).json({ ok: true }); return; } // honeypot: silently accept

    const name    = clip((b.name || "").trim(), 200);
    const email   = clip((b.email || "").trim(), 200);
    const phone   = clip((b.phone || "").trim(), 80);
    const message = clip((b.message || "").trim(), 5000);

    if (!name || !message) { res.status(400).json({ ok: false, error: "missing_fields" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ ok: false, error: "invalid_email" }); return; }

    const when = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
    const text =
        "Neue Anfrage über schanensebastien.com\n\n" +
        "Name:    " + name + "\n" +
        "E-Mail:  " + email + "\n" +
        (phone ? "Telefon: " + phone + "\n" : "") +
        "Zeit:    " + when + "\n\n" +
        "Nachricht:\n" + message + "\n";
    const html =
        "<h2>Neue Anfrage über schanensebastien.com</h2>" +
        "<p><b>Name:</b> " + escapeHtml(name) + "<br>" +
        "<b>E-Mail:</b> " + escapeHtml(email) + "<br>" +
        (phone ? "<b>Telefon:</b> " + escapeHtml(phone) + "<br>" : "") +
        "<b>Zeit:</b> " + escapeHtml(when) + "</p>" +
        "<p style='white-space:pre-wrap'>" + escapeHtml(message) + "</p>";

    try {
        await transport().sendMail({
            from: '"schanensebastien.com" <' + GMAIL_USER.value() + ">",
            to: recipient(),
            replyTo: email,
            subject: "Anfrage über schanensebastien.com — " + name,
            text: text,
            html: html
        });
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error("sendContact failed:", err && err.message);
        res.status(500).json({ ok: false });
    }
});
