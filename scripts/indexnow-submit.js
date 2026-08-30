#!/usr/bin/env node
/* ============================================================
   IndexNow submission for schanensebastien.com
   ------------------------------------------------------------
   Notifies Bing and other IndexNow engines after public pages
   are added, updated or removed. Runs from the deploy machine
   or GitHub Actions, never in the visitor's browser.

   Usage:
     node scripts/indexnow-submit.js https://schanensebastien.com/kostenschaetzer.html
     node scripts/indexnow-submit.js --sitemap
     node scripts/indexnow-submit.js --from-git
     node scripts/indexnow-submit.js --dry-run --sitemap
   ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "indexnow.json"), "utf8"));
const HOST = CONFIG.host;
const KEY = CONFIG.key;
const ENDPOINT = CONFIG.endpoint || "https://api.indexnow.org/indexnow";
const KEY_LOCATION = "https://" + HOST + "/" + KEY + ".txt";

const SKIP = new Set([
    "404.html",
    "impressum.html",
    "datenschutz.html"
]);

function fail(message, code) {
    console.error("indexnow:", message);
    process.exit(code == null ? 1 : code);
}

function parseArgs(argv) {
    const args = { urls: [], sitemap: false, fromGit: false, dryRun: false, deleted: [] };
    argv.forEach(function (arg) {
        if (arg === "--sitemap") args.sitemap = true;
        else if (arg === "--from-git") args.fromGit = true;
        else if (arg === "--dry-run") args.dryRun = true;
        else if (arg === "--help" || arg === "-h") args.help = true;
        else if (arg.indexOf("--") === 0) fail("unknown flag " + arg);
        else args.urls.push(arg);
    });
    return args;
}

function canonicalFromFile(file) {
    const rel = file.replace(/\\/g, "/").replace(/^\.\//, "");
    if (rel.indexOf("/") !== -1) return null;
    if (!rel.endsWith(".html")) return null;
    if (SKIP.has(rel)) return null;
    if (rel === "index.html") return "https://" + HOST + "/";
    return "https://" + HOST + "/" + rel;
}

function urlsFromSitemap() {
    const xml = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
    const locs = [];
    xml.replace(/<loc>\s*([^<]+)\s*<\/loc>/g, function (_, loc) {
        locs.push(loc.trim());
        return _;
    });
    return locs;
}

function git(command) {
    return execSync(command, { cwd: ROOT, encoding: "utf8" }).trim();
}

function urlsFromGit() {
    const before = process.env.GITHUB_EVENT_BEFORE;
    const range = before && /^[0-9a-f]{40}$/.test(before) && before.indexOf("0000000") !== 0
        ? before + "...HEAD"
        : "HEAD~1...HEAD";
    let output = "";
    try {
        output = git("git diff --name-status --diff-filter=ACDMR " + range);
    } catch (err) {
        try {
            output = git("git diff --name-status --diff-filter=ACDMR HEAD");
        } catch (err2) {
            fail("could not read git diff: " + (err2.message || err2));
        }
    }
    const added = [];
    const deleted = [];
    output.split("\n").forEach(function (line) {
        if (!line) return;
        const status = line.charAt(0);
        const parts = line.split(/\t/);
        const file = status === "R" ? parts[2] : parts[1];
        const from = status === "R" ? parts[1] : parts[1];
        if (status === "D") {
            const url = canonicalFromFile(from);
            if (url) deleted.push(url);
            return;
        }
        if (status === "R") {
            const oldUrl = canonicalFromFile(parts[1]);
            if (oldUrl) deleted.push(oldUrl);
        }
        const url = canonicalFromFile(file);
        if (url) added.push(url);
    });
    return { urls: added, deleted: deleted };
}

function unique(list) {
    const seen = Object.create(null);
    return list.filter(function (item) {
        if (!item || seen[item]) return false;
        seen[item] = true;
        return true;
    });
}

function allowedUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return false;
        if (parsed.hostname !== HOST) return false;
        if (parsed.search || parsed.hash) return false;
        return true;
    } catch (e) {
        return false;
    }
}

function post(payload) {
    return new Promise(function (resolve, reject) {
        const body = JSON.stringify(payload);
        const target = new URL(ENDPOINT);
        const req = https.request({
            protocol: target.protocol,
            hostname: target.hostname,
            path: target.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": Buffer.byteLength(body)
            }
        }, function (res) {
            const chunks = [];
            res.on("data", function (chunk) { chunks.push(chunk); });
            res.on("end", function () {
                resolve({
                    status: res.statusCode,
                    body: Buffer.concat(chunks).toString("utf8").slice(0, 500)
                });
            });
        });
        req.on("error", reject);
        req.setTimeout(20000, function () {
            req.destroy(new Error("IndexNow request timed out"));
        });
        req.write(body);
        req.end();
    });
}

function describeStatus(status) {
    if (status === 200) return "submitted";
    if (status === 202) return "accepted, key verification pending";
    if (status === 400) return "bad request";
    if (status === 403) return "key verification failed";
    if (status === 422) return "URL, key or host mismatch";
    if (status === 429) return "rate limited";
    return "unexpected response";
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log("Usage: node scripts/indexnow-submit.js [--dry-run] [--sitemap] [--from-git] [url ...]");
        return;
    }

    const keyPath = path.join(ROOT, KEY + ".txt");
    if (!fs.existsSync(keyPath)) fail("missing key file " + KEY + ".txt");
    const onDisk = fs.readFileSync(keyPath, "utf8").trim();
    if (onDisk !== KEY) fail("key file contents do not match scripts/indexnow.json");

    let urls = args.urls.slice();
    let deleted = [];

    if (args.sitemap) urls = urls.concat(urlsFromSitemap());
    if (args.fromGit) {
        const diff = urlsFromGit();
        urls = urls.concat(diff.urls);
        deleted = deleted.concat(diff.deleted);
    }

    urls = unique(urls.filter(allowedUrl));
    deleted = unique(deleted.filter(allowedUrl));
    const all = unique(urls.concat(deleted));

    if (!all.length) {
        console.log("indexnow: nothing to submit");
        return;
    }

    const payload = {
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList: all
    };

    console.log("indexnow: " + all.length + " URL(s)" + (deleted.length ? " including " + deleted.length + " removed" : ""));
    all.forEach(function (url) { console.log("  " + url); });

    if (args.dryRun) {
        console.log("indexnow: dry run, not sent");
        return;
    }

    try {
        const result = await post(payload);
        const meaning = describeStatus(result.status);
        const line = "indexnow: HTTP " + result.status + " (" + meaning + ")";
        if (result.status === 200 || result.status === 202) {
            console.log(line);
            return;
        }
        console.error(line);
        if (result.body) console.error(result.body);
        /* Do not fail the website deploy over a search ping. */
        process.exit(0);
    } catch (err) {
        console.error("indexnow: request failed:", err && err.message);
        process.exit(0);
    }
}

main();
