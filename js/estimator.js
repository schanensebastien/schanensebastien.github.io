/* ============================================================
   Kostenschätzer — questionnaire, result and quote request
   ------------------------------------------------------------
   Loaded only on kostenschaetzer.html, after js/site.min.js so that
   DocScanConsent and DocScanAnalytics are available.

   The price is calculated exclusively on the server. This file knows
   nothing about rates, factors or thresholds.
   ============================================================ */

(function () {
    "use strict";

    var root = document.querySelector("[data-estimator]");
    if (!root) return;

    var STORAGE_KEY = "docscan-estimator-v1";
    var AUTO_ADVANCE_MS = 260;
    var REQUEST_TIMEOUT_MS = 12000;

    var ENDPOINTS = {
        answer: window.DOCSCAN_ESTIMATOR_ANSWER_URL || "",
        estimate: window.DOCSCAN_ESTIMATOR_ESTIMATE_URL || "",
        contact: window.DOCSCAN_ESTIMATOR_CONTACT_URL || ""
    };

    /* ---------------------------------------------------------
       Question definitions — the questionnaire is data, not code.
       Conditional logic lives in `when`, nowhere else.
       --------------------------------------------------------- */

    var QUANTITY_STEPS = {
        ordner: [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500],
        kartons: [2, 5, 10, 15, 20, 30, 50, 75, 100, 150, 200]
    };

    var CONDITION_STAGES = [
        "Sehr gut geordnet",
        "Überwiegend geordnet",
        "Teilweise gemischt",
        "Unsortiert",
        "Stark gemischt / viele lose Belege"
    ];

    var USER_TIERS = [
        { value: "t1", label: "1–5 Personen" },
        { value: "t2", label: "6–15 Personen" },
        { value: "t3", label: "16–50 Personen" },
        { value: "t4", label: "mehr als 50 Personen" }
    ];

    /* Loose paper is counted in boxes, everything else in folders. */
    function unitFor(answers) {
        return answers.documentType === "lose" ? "kartons" : "ordner";
    }

    function unitNoun(unit, value) {
        if (unit === "kartons") return value === 1 ? "Karton" : "Kartons";
        return "Ordner";
    }

    var QUESTIONS = [
        {
            id: "documentType",
            type: "options",
            legend: "Welche Unterlagen möchten Sie digitalisieren?",
            wide: false,
            options: [
                { value: "aktenordner", label: "Aktenordner" },
                { value: "rechnungen", label: "Rechnungen und Belege" },
                { value: "personal", label: "Personalunterlagen" },
                { value: "projektakten", label: "Projekt- oder Kundenakten" },
                { value: "lose", label: "Lose Unterlagen / Kartons" },
                { value: "gemischt", label: "Unterschiedliche Unterlagen" },
                { value: "sonstiges", label: "Sonstiges" }
            ],
            extra: {
                forValue: "sonstiges",
                label: "Worum handelt es sich? (optional)",
                placeholder: "z. B. Pläne, Karteikarten, Mikrofilm",
                key: "documentTypeOther"
            }
        },
        {
            id: "quantity",
            type: "slider",
            legend: "Ca. wie groß ist der Bestand?",
            hint: "Eine grobe Einschätzung genügt.",
            unsureLabel: "Weiß ich nicht",
            steps: function (answers) { return QUANTITY_STEPS[unitFor(answers)]; },
            defaultIndex: 3,
            format: function (index, answers) {
                var unit = unitFor(answers);
                var steps = QUANTITY_STEPS[unit];
                var value = steps[index];
                var open = index === steps.length - 1 ? "+" : "";
                return "ca. " + value + open + " " + unitNoun(unit, value);
            },
            scale: function (answers) {
                var steps = QUANTITY_STEPS[unitFor(answers)];
                return [String(steps[0]), String(steps[steps.length - 1]) + "+"];
            },
            read: function (answers) {
                var value = answers.quantity;
                if (!value || value.unknown) return null;
                var steps = QUANTITY_STEPS[value.unit] || QUANTITY_STEPS.ordner;
                var index = steps.indexOf(value.value);
                return index === -1 ? null : index;
            },
            isUnsure: function (answers) { return !!(answers.quantity && answers.quantity.unknown); },
            write: function (answers, index, unsure) {
                var unit = unitFor(answers);
                answers.quantity = unsure
                    ? { unit: unit, unknown: true, value: null }
                    : { unit: unit, unknown: false, value: QUANTITY_STEPS[unit][index] };
            }
        },
        {
            id: "condition",
            type: "slider",
            legend: "Wie gut sind die Unterlagen derzeit organisiert?",
            hint: "Das beeinflusst vor allem den Vorbereitungsaufwand.",
            unsureLabel: "Weiß ich nicht",
            steps: function () { return CONDITION_STAGES; },
            defaultIndex: 2,
            format: function (index) { return CONDITION_STAGES[index]; },
            scale: function () { return ["geordnet", "gemischt"]; },
            read: function (answers) {
                var value = answers.condition;
                if (!value || value.unknown) return null;
                return value.stage - 1;
            },
            isUnsure: function (answers) { return !!(answers.condition && answers.condition.unknown); },
            write: function (answers, index, unsure) {
                answers.condition = unsure
                    ? { unknown: true, stage: null }
                    : { unknown: false, stage: index + 1 };
            }
        },
        {
            id: "archive",
            type: "options",
            legend: "Wie möchten Sie die digitalisierten Unterlagen künftig nutzen?",
            hint: "Durchsuchbare PDFs, verständliche Dateinamen und eine klare Struktur sind immer enthalten.",
            wide: true,
            options: [
                { value: "dateien", label: "Als strukturierte Dateien zur Übergabe" },
                { value: "bestehende_ablage", label: "In meiner bestehenden digitalen Ablage" },
                { value: "lokaler_server", label: "Auf einem neuen lokalen Archiv-Server im Unternehmen" },
                { value: "cloud", label: "In einer gehosteten Archiv-/Cloud-Lösung" },
                { value: "unsicher", label: "Noch nicht sicher" }
            ]
        },
        {
            id: "users",
            type: "slider",
            legend: "Wie viele Personen sollen auf das Archiv zugreifen können?",
            hint: "Eine ungefähre Größenordnung genügt.",
            unsureLabel: "Noch nicht sicher",
            when: function (answers) {
                return answers.archive === "lokaler_server" || answers.archive === "cloud";
            },
            steps: function () { return USER_TIERS; },
            defaultIndex: 1,
            format: function (index) { return USER_TIERS[index].label; },
            scale: function () { return ["kleines Team", "großes Team"]; },
            read: function (answers) {
                var value = answers.users;
                if (!value || value.unknown) return null;
                for (var i = 0; i < USER_TIERS.length; i++) {
                    if (USER_TIERS[i].value === value.tier) return i;
                }
                return null;
            },
            isUnsure: function (answers) { return !!(answers.users && answers.users.unknown); },
            write: function (answers, index, unsure) {
                answers.users = unsure
                    ? { unknown: true, tier: null }
                    : { unknown: false, tier: USER_TIERS[index].value };
            }
        },
        {
            id: "processing",
            type: "options",
            legend: "Wie sollen die Unterlagen verarbeitet werden?",
            wide: true,
            options: [
                { value: "vor_ort", label: "Digitalisierung direkt bei uns im Unternehmen" },
                { value: "abholung", label: "Abholung und Rückgabe" },
                { value: "unsicher", label: "Noch nicht sicher" }
            ]
        },
        {
            id: "postcode",
            type: "postcode",
            legend: "Wo befinden sich die Unterlagen?",
            hint: "Bitte geben Sie die Postleitzahl ein."
        }
    ];

    function byId(id) {
        for (var i = 0; i < QUESTIONS.length; i++) {
            if (QUESTIONS[i].id === id) return QUESTIONS[i];
        }
        return null;
    }

    /* ---------------------------------------------------------
       State
       --------------------------------------------------------- */

    function randomId() {
        try {
            if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
            var bytes = new Uint8Array(16);
            window.crypto.getRandomValues(bytes);
            return Array.prototype.map.call(bytes, function (b) {
                return ("0" + b.toString(16)).slice(-2);
            }).join("");
        } catch (e) {
            return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        }
    }

    /* Stable per distinct answer, so re-selecting the same value or
       reloading the page never produces a second notification. */
    function eventIdFor(questionId, value) {
        var text = questionId + ":" + JSON.stringify(value === undefined ? null : value);
        var hash = 2166136261;
        for (var i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = (hash * 16777619) >>> 0;
        }
        return questionId + "-" + ("0000000" + hash.toString(16)).slice(-8) + "-" + text.length;
    }

    var state = {
        sessionId: "",
        startedAt: "",
        updatedAt: "",
        currentStep: "",
        answers: {},
        meta: {},
        sent: {},
        completed: false,
        estimate: null,
        view: "intro"
    };

    function store() {
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function restore() {
        var raw = null;
        try { raw = sessionStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
        if (!raw) return false;
        try {
            var saved = JSON.parse(raw);
            if (!saved || !saved.sessionId) return false;
            state.sessionId = saved.sessionId;
            state.startedAt = saved.startedAt || "";
            state.currentStep = saved.currentStep || "";
            state.answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
            state.meta = saved.meta && typeof saved.meta === "object" ? saved.meta : {};
            state.sent = saved.sent && typeof saved.sent === "object" ? saved.sent : {};
            state.completed = !!saved.completed;
            state.estimate = saved.estimate || null;
            state.view = saved.view || "intro";
            return true;
        } catch (e) { return false; }
    }

    function applicable() {
        return QUESTIONS.filter(function (question) {
            return !question.when || question.when(state.answers);
        });
    }

    function stepIndex() {
        var list = applicable();
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === state.currentStep) return i;
        }
        return 0;
    }

    function isAnswered(question) {
        var value = state.answers[question.id];
        return value !== undefined && value !== null && value !== "";
    }

    /* ---------------------------------------------------------
       Attribution — captured once, kept for the whole session
       --------------------------------------------------------- */

    function cookie(name) {
        var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
        return match ? decodeURIComponent(match[1]) : "";
    }

    function captureMeta() {
        var params = new URLSearchParams(location.search);
        var pick = function (key) { return (params.get(key) || "").slice(0, 150); };

        if (!state.meta.landingUrl) {
            state.meta.landingUrl = location.href;
            state.meta.referrer = document.referrer || "";
            state.meta.utm = {
                source: pick("utm_source"),
                medium: pick("utm_medium"),
                campaign: pick("utm_campaign"),
                content: pick("utm_content"),
                term: pick("utm_term")
            };
            state.meta.clickIds = {
                fbclid: pick("fbclid"),
                gclid: pick("gclid"),
                gbraid: pick("gbraid"),
                wbraid: pick("wbraid"),
                msclkid: pick("msclkid")
            };
        }

        state.meta.url = location.href;
        state.meta.language = navigator.language || "";
        state.meta.screen = window.screen ? window.screen.width + "x" + window.screen.height : "";
        state.meta.startedAt = state.startedAt;
        state.meta.consent = consentLabel();

        /* Analytics identifiers only exist once the visitor allowed them. */
        state.meta.gaClientId = consentFor("analytics") ? cookie("_ga") : "";
        state.meta.metaBrowserId = consentFor("marketing") ? cookie("_fbp") : "";
    }

    function consentFor(category) {
        try { return !!(window.DocScanConsent && window.DocScanConsent.has(category)); } catch (e) { return false; }
    }

    function consentLabel() {
        try {
            if (window.DocScanConsent && window.DocScanConsent.decided()) {
                return (consentFor("analytics") ? "Statistik erlaubt" : "Statistik abgelehnt") + ", " +
                       (consentFor("marketing") ? "Meta erlaubt" : "Meta abgelehnt");
            }
        } catch (e) {}
        return "keine Auswahl getroffen";
    }

    /* ---------------------------------------------------------
       Analytics — buckets only, never free text or contact data
       --------------------------------------------------------- */

    function quantityBucket() {
        var value = state.answers.quantity;
        if (!value) return "";
        if (value.unknown) return "unbekannt";
        var n = value.value;
        var band = n <= 10 ? "bis_10" : n <= 50 ? "11_50" : n <= 100 ? "51_100" : n <= 300 ? "101_300" : "ueber_300";
        return value.unit + "_" + band;
    }

    function estimateBucket(price) {
        if (typeof price !== "number") return "";
        if (price < 1000) return "unter_1000";
        if (price < 3000) return "1000_2999";
        if (price < 5000) return "3000_4999";
        if (price < 10000) return "5000_9999";
        return "ab_10000";
    }

    function funnelParams() {
        var answers = state.answers;
        return {
            document_type: answers.documentType || "",
            quantity_bucket: quantityBucket(),
            condition_bucket: answers.condition
                ? (answers.condition.unknown ? "unbekannt" : "stufe_" + answers.condition.stage) : "",
            archive_type: answers.archive || "",
            user_count_category: answers.users ? (answers.users.unknown ? "unbekannt" : answers.users.tier) : "",
            processing_mode: answers.processing || "",
            postcode_region: answers.postcode ? answers.postcode.slice(0, 2) : ""
        };
    }

    function track(gaEvent, gaParams, metaEvent, metaParams, metaStandard) {
        try {
            if (window.DocScanAnalytics && gaEvent) {
                window.DocScanAnalytics.event(gaEvent, gaParams || {});
            }
            if (window.DocScanAnalytics && metaEvent) {
                window.DocScanAnalytics.metaEvent(metaEvent, metaParams || {}, !metaStandard);
            }
        } catch (e) {}
    }

    /* ---------------------------------------------------------
       Backend
       --------------------------------------------------------- */

    function post(url, payload, timeout) {
        if (!url) return Promise.reject(new Error("endpoint_missing"));

        var controller = null;
        var timer = null;
        try {
            controller = new AbortController();
            timer = setTimeout(function () { controller.abort(); }, timeout || REQUEST_TIMEOUT_MS);
        } catch (e) { controller = null; }

        return fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "omit",
            mode: "cors",
            signal: controller ? controller.signal : undefined
        }).then(function (response) {
            if (timer) clearTimeout(timer);
            if (!response.ok) throw new Error("http_" + response.status);
            return response.json();
        }).catch(function (error) {
            if (timer) clearTimeout(timer);
            throw error;
        });
    }

    function basePayload() {
        captureMeta();
        return {
            sessionId: state.sessionId,
            answers: state.answers,
            meta: state.meta,
            website: ""
        };
    }

    /* Fire and forget: the questionnaire never waits for this. */
    function sendAnswer(question) {
        var eventId = eventIdFor(question.id, state.answers[question.id]);
        if (state.sent[eventId]) return;
        state.sent[eventId] = true;
        store();

        var list = applicable();
        var payload = basePayload();
        payload.eventId = eventId;
        payload.questionId = question.id;
        payload.step = stepIndex() + 1;
        payload.totalSteps = list.length;
        payload.completed = state.completed;

        post(ENDPOINTS.answer, payload).catch(function () {
            /* One retry; the stable eventId makes a duplicate harmless. */
            setTimeout(function () {
                post(ENDPOINTS.answer, payload).catch(function () {});
            }, 3000);
        });
    }

    /* ---------------------------------------------------------
       Rendering
       --------------------------------------------------------- */

    var screens = {
        intro: root.querySelector('[data-screen="intro"]'),
        question: root.querySelector('[data-screen="question"]'),
        result: root.querySelector('[data-screen="result"]')
    };
    var head = {
        label: root.querySelector("[data-step-label]"),
        progress: root.querySelector("[data-progress]"),
        bar: root.querySelector("[data-progress-bar]")
    };
    var foot = root.querySelector("[data-nav]");
    var backButton = root.querySelector('[data-act="back"]');
    var nextButton = root.querySelector('[data-act="next"]');

    function setView(name) {
        state.view = name;
        Object.keys(screens).forEach(function (key) {
            if (screens[key]) screens[key].hidden = key !== name;
        });
        /* Only the questionnaire itself is pinned to the viewport. */
        document.body.classList.toggle("is-locked", name === "question");
        if (foot) foot.hidden = name !== "question";
    }

    function setProgress(percent, text) {
        if (head.bar) head.bar.style.width = Math.max(4, Math.min(100, percent)) + "%";
        if (head.progress) head.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
        if (head.label) head.label.textContent = text;
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function renderOptions(question, container) {
        var group = element("div", "est-options" + (question.wide ? " est-options-wide" : ""));
        group.setAttribute("role", "group");
        group.setAttribute("aria-labelledby", "est-question-title");

        var extra = null;
        if (question.extra) {
            extra = element("div", "est-extra");
            extra.hidden = state.answers[question.id] !== question.extra.forValue;
            var label = element("label", null, question.extra.label);
            label.setAttribute("for", "est-extra-input");
            var input = element("input", "est-input");
            input.id = "est-extra-input";
            input.type = "text";
            input.maxLength = 200;
            input.placeholder = question.extra.placeholder;
            input.value = state.answers[question.extra.key] || "";
            input.addEventListener("input", function () {
                state.answers[question.extra.key] = input.value.slice(0, 200);
                store();
            });
            extra.appendChild(label);
            extra.appendChild(input);
        }

        question.options.forEach(function (option) {
            var button = element("button", "est-option");
            button.type = "button";
            button.setAttribute("aria-pressed", state.answers[question.id] === option.value ? "true" : "false");
            button.appendChild(element("span", "est-check"));
            button.lastChild.setAttribute("aria-hidden", "true");
            button.appendChild(element("span", "est-label", option.label));

            button.addEventListener("click", function () {
                if (button.dataset.busy) return;
                state.answers[question.id] = option.value;
                if (question.extra && option.value !== question.extra.forValue) {
                    delete state.answers[question.extra.key];
                }
                /* Dropping a conditional question invalidates its answer. */
                if (question.id === "archive" && option.value !== "lokaler_server" && option.value !== "cloud") {
                    delete state.answers.users;
                }
                touch();

                Array.prototype.forEach.call(group.children, function (node) {
                    node.setAttribute("aria-pressed", "false");
                });
                button.setAttribute("aria-pressed", "true");

                if (extra) {
                    extra.hidden = option.value !== question.extra.forValue;
                    if (!extra.hidden) extra.querySelector("input").focus();
                }
                updateNext(question);

                /* "Sonstiges" opens a text field, so the visitor keeps control. */
                var stays = extra && !extra.hidden;
                if (!stays) {
                    button.dataset.busy = "1";
                    setTimeout(function () {
                        button.dataset.busy = "";
                        advance(question);
                    }, AUTO_ADVANCE_MS);
                }
            });

            group.appendChild(button);
        });

        container.appendChild(group);
        if (extra) container.appendChild(extra);
    }

    function renderSlider(question, container) {
        var steps = question.steps(state.answers);
        var block = element("div", "est-slider-block");

        var value = element("p", "est-value");
        value.id = "est-slider-value";

        var row = element("div", "est-slider-row");
        var minus = element("button", "est-nudge", "\u2212");
        minus.type = "button";
        minus.setAttribute("aria-label", "Auswahl verringern");
        var plus = element("button", "est-nudge", "+");
        plus.type = "button";
        plus.setAttribute("aria-label", "Auswahl erhöhen");

        var range = element("input", "est-range");
        range.type = "range";
        range.min = "0";
        range.max = String(steps.length - 1);
        range.step = "1";
        range.setAttribute("aria-labelledby", "est-question-title");

        var stored = question.read(state.answers);
        var index = stored === null ? question.defaultIndex : stored;
        var unsure = question.isUnsure(state.answers);
        range.value = String(index);

        var scale = element("p", "est-scale");
        question.scale(state.answers).forEach(function (text) {
            scale.appendChild(element("span", null, text));
        });

        var unsureButton = element("button", "est-unsure", question.unsureLabel);
        unsureButton.type = "button";
        unsureButton.setAttribute("aria-pressed", unsure ? "true" : "false");

        function paint(writeAnswer) {
            var current = parseInt(range.value, 10);
            var text = unsure ? question.unsureLabel : question.format(current, state.answers);
            value.textContent = text;
            value.classList.toggle("is-muted", unsure);
            range.classList.toggle("is-inactive", unsure);
            range.setAttribute("aria-valuetext", text);
            unsureButton.setAttribute("aria-pressed", unsure ? "true" : "false");
            minus.disabled = !unsure && current <= 0;
            plus.disabled = !unsure && current >= steps.length - 1;
            if (writeAnswer) {
                question.write(state.answers, current, unsure);
                touch();
                updateNext(question);
            }
        }

        range.addEventListener("input", function () { unsure = false; paint(true); });
        minus.addEventListener("click", function () {
            unsure = false;
            range.value = String(Math.max(0, parseInt(range.value, 10) - 1));
            paint(true);
        });
        plus.addEventListener("click", function () {
            unsure = false;
            range.value = String(Math.min(steps.length - 1, parseInt(range.value, 10) + 1));
            paint(true);
        });
        unsureButton.addEventListener("click", function () {
            unsure = !unsure;
            paint(true);
        });

        row.appendChild(minus);
        row.appendChild(range);
        row.appendChild(plus);
        block.appendChild(value);
        block.appendChild(row);
        block.appendChild(scale);
        block.appendChild(unsureButton);
        container.appendChild(block);

        /* Sliders always need an explicit "Weiter", so the answer is
           written immediately and the visitor confirms it. */
        question.write(state.answers, parseInt(range.value, 10), unsure);
        paint(false);
        touch();
    }

    function renderPostcode(question, container) {
        var block = element("div", "est-postcode-block");
        var label = element("label", "visually-hidden", "Postleitzahl");
        label.setAttribute("for", "est-postcode");

        var input = element("input", "est-postcode");
        input.id = "est-postcode";
        input.type = "text";
        input.inputMode = "numeric";
        input.pattern = "[0-9]*";
        input.maxLength = 5;
        input.autocomplete = "postal-code";
        input.placeholder = "97070";
        input.value = state.answers.postcode || "";
        input.setAttribute("aria-describedby", "est-postcode-error");

        var error = element("p", "est-error");
        error.id = "est-postcode-error";
        error.setAttribute("role", "alert");

        input.addEventListener("input", function () {
            input.value = input.value.replace(/\D/g, "").slice(0, 5);
            state.answers.postcode = input.value;
            error.textContent = "";
            touch();
            updateNext(question);
        });
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") { event.preventDefault(); advance(question); }
        });

        block.appendChild(label);
        block.appendChild(input);
        block.appendChild(error);
        container.appendChild(block);
    }

    function postcodeValid() {
        return /^\d{5}$/.test(state.answers.postcode || "");
    }

    function updateNext(question) {
        if (!nextButton) return;
        var ready = question.type === "postcode" ? postcodeValid() : isAnswered(question);
        nextButton.disabled = !ready;
        var list = applicable();
        var last = list[list.length - 1];
        nextButton.textContent = last && last.id === question.id ? "Kostenschätzung anzeigen" : "Weiter";
    }

    function renderQuestion() {
        var list = applicable();
        var index = stepIndex();
        var question = list[index];
        if (!question) return;
        state.currentStep = question.id;

        var container = screens.question;
        container.innerHTML = "";

        /* The intro screen owns the page h1, so questions use h2. */
        var title = element("h2", "est-question", question.legend);
        title.id = "est-question-title";
        title.tabIndex = -1;
        container.appendChild(title);
        if (question.hint) container.appendChild(element("p", "est-hint", question.hint));

        if (question.type === "options") renderOptions(question, container);
        else if (question.type === "slider") renderSlider(question, container);
        else renderPostcode(question, container);

        setView("question");
        setProgress((index / list.length) * 100, "Frage " + (index + 1) + " von " + list.length);
        updateNext(question);
        title.focus();
        store();
    }

    function touch() {
        state.updatedAt = new Date().toISOString();
        store();
    }

    /* ---------------------------------------------------------
       Navigation
       --------------------------------------------------------- */

    var advancing = false;

    function advance(question) {
        if (advancing) return;
        var ready = question.type === "postcode" ? postcodeValid() : isAnswered(question);
        if (!ready) {
            if (question.type === "postcode") {
                var error = document.getElementById("est-postcode-error");
                if (error) error.textContent = "Bitte geben Sie eine fünfstellige Postleitzahl ein.";
            }
            return;
        }

        advancing = true;
        var list = applicable();
        var index = stepIndex();
        var isLast = index >= list.length - 1;
        state.completed = isLast;

        track("estimator_question_answered", Object.assign({
            question_id: question.id,
            step: index + 1,
            total_steps: list.length
        }, funnelParams()), "EstimatorQuestionAnswered", { question_id: question.id, step: index + 1 });

        sendAnswer(question);

        if (isLast) {
            track("estimator_completed", funnelParams(), "EstimatorCompleted", funnelParams());
            showResult();
        } else {
            state.currentStep = applicable()[index + 1].id;
            renderQuestion();
        }
        setTimeout(function () { advancing = false; }, 120);
    }

    function goBack() {
        var index = stepIndex();
        track("estimator_back", { step: index + 1 });
        if (index === 0) {
            setView("intro");
            setProgress(0, "Kostenschätzung");
            store();
            return;
        }
        state.currentStep = applicable()[index - 1].id;
        renderQuestion();
    }

    /* ---------------------------------------------------------
       Result
       --------------------------------------------------------- */

    var result = {
        price: root.querySelector("[data-price]"),
        copy: root.querySelector("[data-price-copy]"),
        note: root.querySelector("[data-price-note]"),
        review: root.querySelector("[data-review]"),
        recurring: root.querySelector("[data-recurring]"),
        considered: root.querySelector("[data-considered]")
    };

    function formatPrice(value) {
        return value.toLocaleString("de-DE") + " € netto";
    }

    function showFallback() {
        if (result.price) {
            result.price.textContent = "Auf Anfrage";
            result.price.classList.add("est-price-text");
        }
        if (result.copy) {
            result.copy.textContent = "Die Schätzung konnte gerade nicht automatisch berechnet werden. " +
                "Ihre bisherigen Angaben bleiben erhalten. Gerne nenne ich Ihnen den voraussichtlichen " +
                "Projektwert nach kurzer Rücksprache.";
        }
        if (result.note) result.note.hidden = true;
        if (result.review) result.review.hidden = true;
        if (result.recurring) result.recurring.hidden = true;
        if (result.considered) result.considered.hidden = true;
    }

    function paintResult(estimate) {
        if (!estimate || typeof estimate.estimatedNetPrice !== "number") { showFallback(); return; }

        if (result.price) {
            result.price.textContent = formatPrice(estimate.estimatedNetPrice);
            result.price.classList.remove("est-price-text");
        }
        if (result.note) result.note.hidden = false;
        if (result.considered) result.considered.hidden = false;
        if (result.copy) {
            result.copy.textContent = "Auf Grundlage Ihrer Angaben ergibt sich voraussichtlich ein Projektwert " +
                "von rund " + formatPrice(estimate.estimatedNetPrice) + ".";
        }
        if (result.review) result.review.hidden = !estimate.requiresManualReview;
        if (result.recurring) result.recurring.hidden = !estimate.includesArchiveSolution;

        track("estimate_shown", Object.assign({
            estimate_bucket: estimateBucket(estimate.estimatedNetPrice),
            requires_manual_review: estimate.requiresManualReview ? "ja" : "nein"
        }, funnelParams()), "EstimateShown", {
            estimate_bucket: estimateBucket(estimate.estimatedNetPrice)
        });
    }

    function showResult() {
        setView("result");
        setProgress(100, "Kostenschätzung");
        window.scrollTo(0, 0);

        if (result.price) result.price.textContent = "wird berechnet …";
        if (result.copy) result.copy.textContent = "Einen Moment, die Angaben werden ausgewertet.";
        if (result.review) result.review.hidden = true;
        if (result.recurring) result.recurring.hidden = true;

        var heading = root.querySelector("[data-result-heading]");
        if (heading) heading.focus();
        store();

        post(ENDPOINTS.estimate, basePayload()).then(function (response) {
            if (!response || response.ok !== true) throw new Error("bad_response");
            state.estimate = {
                estimatedNetPrice: response.estimatedNetPrice,
                currency: response.currency,
                requiresManualReview: !!response.requiresManualReview,
                includesArchiveSolution: !!response.includesArchiveSolution
            };
            store();
            paintResult(state.estimate);
        }).catch(function () {
            state.estimate = null;
            store();
            showFallback();
        });
    }

    /* ---------------------------------------------------------
       Quote / callback request
       --------------------------------------------------------- */

    var form = root.querySelector("[data-quote-form]");
    var formStatus = form ? form.querySelector("[data-status]") : null;
    var callbackBox = form ? form.querySelector("[data-callback]") : null;
    var phoneField = form ? form.querySelector("#est-phone") : null;
    var phoneLabel = form ? form.querySelector("[data-phone-label]") : null;

    function openForm(withCallback) {
        if (!form) return;
        form.hidden = false;
        if (callbackBox && withCallback) callbackBox.checked = true;
        syncPhoneRequirement();
        track(withCallback ? "callback_requested" : "quote_form_opened", funnelParams(),
              withCallback ? "CallbackRequested" : null, funnelParams());
        var first = form.querySelector("input:not([type='hidden'])");
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        if (first) setTimeout(function () { first.focus(); }, 240);
    }

    function syncPhoneRequirement() {
        if (!phoneField || !callbackBox) return;
        var required = callbackBox.checked;
        phoneField.required = required;
        if (phoneLabel) phoneLabel.textContent = required ? "Telefon" : "Telefon (optional)";
    }

    function setStatus(message, kind) {
        if (!formStatus) return;
        formStatus.textContent = message;
        formStatus.className = "est-status" + (kind ? " " + kind : "");
    }

    function submitQuote(event) {
        event.preventDefault();
        if (form.dataset.busy) return;

        var honeypot = form.querySelector("#est-website");
        if (honeypot && honeypot.value) { setStatus("Vielen Dank. Ihre Angaben wurden übermittelt.", "ok"); return; }

        var contact = {
            company: form.querySelector("#est-company").value.trim(),
            name: form.querySelector("#est-name").value.trim(),
            email: form.querySelector("#est-email").value.trim(),
            phone: phoneField ? phoneField.value.trim() : "",
            callback: !!(callbackBox && callbackBox.checked),
            note: form.querySelector("#est-note") ? form.querySelector("#est-note").value.trim() : ""
        };
        var consentBox = form.querySelector("#est-consent");

        if (!contact.company || !contact.name) { setStatus("Bitte Unternehmen und Ansprechpartner angeben.", "err"); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) { setStatus("Bitte eine gültige E-Mail-Adresse angeben.", "err"); return; }
        if (contact.callback && !contact.phone) { setStatus("Für einen Rückruf wird eine Telefonnummer benötigt.", "err"); return; }
        if (consentBox && !consentBox.checked) { setStatus("Bitte bestätigen Sie die Verarbeitung Ihrer Angaben.", "err"); return; }

        form.dataset.busy = "1";
        var button = form.querySelector("button[type='submit']");
        if (button) button.disabled = true;
        setStatus("Wird übermittelt …");

        var payload = basePayload();
        payload.eventId = eventIdFor("contact", contact.email + "|" + contact.company + "|" + contact.callback);
        payload.contact = contact;
        payload.completed = true;

        post(ENDPOINTS.contact, payload).then(function (response) {
            if (!response || response.ok !== true) throw new Error("bad_response");
            form.reset();
            form.hidden = true;
            var done = root.querySelector("[data-quote-done]");
            if (done) { done.hidden = false; done.focus(); }
            track("quote_requested", Object.assign({
                callback: contact.callback ? "ja" : "nein",
                estimate_bucket: state.estimate ? estimateBucket(state.estimate.estimatedNetPrice) : ""
            }, funnelParams()), "Lead", {
                content_name: "Kostenschätzer Angebotsanfrage",
                content_category: "Dokumentendigitalisierung"
            }, true);
        }).catch(function () {
            setStatus("Die Übermittlung hat nicht geklappt. Bitte rufen Sie kurz an oder schreiben Sie eine E-Mail.", "err");
        }).then(function () {
            form.dataset.busy = "";
            if (button) button.disabled = false;
        });
    }

    /* ---------------------------------------------------------
       Init
       --------------------------------------------------------- */

    function start() {
        if (!state.answers || !Object.keys(state.answers).length) state.answers = {};
        state.currentStep = applicable()[0].id;
        track("estimator_started", {}, "EstimatorStarted", {});
        renderQuestion();
    }

    function reset() {
        state.answers = {};
        state.sent = {};
        state.estimate = null;
        state.completed = false;
        state.currentStep = "";
        store();
        setView("intro");
        setProgress(0, "Kostenschätzung");
    }

    function wireConsentSpacing() {
        function sync() {
            var decided = !!(window.DocScanConsent && window.DocScanConsent.decided());
            document.body.classList.toggle("has-consent", !decided);
        }
        sync();
        if (window.DocScanConsent) window.DocScanConsent.onChange(sync);
        document.addEventListener("docscan:consent", sync);
    }

    function init() {
        var resumed = restore();
        if (!resumed) {
            state.sessionId = randomId();
            state.startedAt = new Date().toISOString();
        }
        captureMeta();

        root.querySelectorAll("[data-act='start']").forEach(function (node) {
            node.addEventListener("click", function (event) { event.preventDefault(); start(); });
        });
        root.querySelectorAll("[data-act='restart']").forEach(function (node) {
            node.addEventListener("click", function (event) { event.preventDefault(); reset(); });
        });
        if (backButton) backButton.addEventListener("click", function () { goBack(); });
        if (nextButton) nextButton.addEventListener("click", function () {
            var question = applicable()[stepIndex()];
            if (question) advance(question);
        });

        var quoteButton = root.querySelector("[data-act='quote']");
        var callbackButton = root.querySelector("[data-act='callback']");
        if (quoteButton) quoteButton.addEventListener("click", function () { openForm(false); });
        if (callbackButton) callbackButton.addEventListener("click", function () { openForm(true); });
        if (callbackBox) callbackBox.addEventListener("change", syncPhoneRequirement);
        if (form) form.addEventListener("submit", submitQuote);

        root.querySelectorAll("[data-act='vcard']").forEach(function (node) {
            node.addEventListener("click", function () { track("contact_save", { method: "vcard" }); });
        });

        wireConsentSpacing();

        track("estimator_view", { page_path: location.pathname }, "ViewContent", {
            content_name: "Kostenschätzer",
            content_category: "Dokumentendigitalisierung"
        }, true);

        if (state.view === "result" && state.estimate) {
            setView("result");
            setProgress(100, "Kostenschätzung");
            paintResult(state.estimate);
        } else if (state.view === "question" && state.currentStep && byId(state.currentStep)) {
            renderQuestion();
        } else {
            setView("intro");
            setProgress(0, "Kostenschätzung");
        }
        store();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else { init(); }
})();
