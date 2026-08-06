/**
 * Khanware Ultimate v4.0
 * Unified & Professional Version
 * Repository: https://github.com/vtrbr/Khanware
 */

(function() {
    'use strict';

    const VERSION = "V4.0.0";
    const REPO = "https://cdn.jsdelivr.net/gh/vtrbr/Khanware@main/";
    
    // --- Configuration ---
    window.features = {
        questionSpoof: true,
        autoAnswer: true,
        darkMode: true
    };

    const phrases = [ 
        "🔥 Get good, get [**Khanware**](https://github.com/vtrbr/Khanware)!",
        "🤍 Made by [**@im.nix**](https://e-z.bio/sounix).",
        "☄️ By [**vtrbr/Khanware**](https://github.com/vtrbr/Khanware).",
        "🌟 Star the project on [GitHub](https://github.com/vtrbr/Khanware)!"
    ];

    // --- Utilities ---
    const log = (msg) => console.log(`[KW] ${msg}`);
    const delay = ms => new Promise(res => setTimeout(res, ms));
    
    function sendToast(text, duration=3000) {
        if (window.Toastify) {
            Toastify({
                text: text,
                duration: duration,
                gravity: "bottom",
                position: "left",
                style: { background: "#000000", color: "#ffffff", borderRadius: "8px" }
            }).showToast();
        }
        log(text);
    }

    const toFraction = (d) => {
        if (d === 0 || d === 1) return String(d);
        const decimals = (String(d).split('.')[1] || '').length;
        let num = Math.round(d * Math.pow(10, decimals));
        let den = Math.pow(10, decimals);
        const gcd = (a, b) => b ? gcd(b, a % b) : a;
        const div = gcd(Math.abs(num), Math.abs(den));
        return den / div === 1 ? String(num / div) : `${num / div}/${den / div}`;
    };

    // --- Core Logic ---
    const extractAnswers = (itemData) => {
        const answers = [];
        if (!itemData?.question?.widgets) return answers;
        
        for (const [key, w] of Object.entries(itemData.question.widgets)) {
            try {
                if (w.type === 'radio' && w.options?.choices) {
                    const correct = w.options.choices.filter(c => c.correct);
                    if (correct.length) answers.push({ type: 'radio', widgetKey: key, choiceIds: correct.map(c => c.id || `radio-choice-${w.options.choices.indexOf(c)}`), multipleSelect: w.options.multipleSelect || false });
                }
                else if (w.type === 'numeric-input' && w.options?.answers) {
                    const correct = w.options.answers.find(a => a.status === 'correct');
                    if (correct) {
                        let val = correct.value;
                        if (correct.answerForms?.some(f => ['proper', 'improper', 'mixed'].includes(f))) val = toFraction(val);
                        answers.push({ type: 'numeric-input', widgetKey: key, value: String(val) });
                    }
                }
                else if (w.type === 'dropdown' && w.options?.choices) {
                    const correctIdx = w.options.choices.findIndex(c => c.correct);
                    if (correctIdx !== -1) answers.push({ type: 'dropdown', widgetKey: key, value: correctIdx + 1 });
                }
                else if (w.type === 'input-number' && w.options?.value !== undefined) {
                    let val = w.options.value;
                    if (val > 0 && val < 1 && String(val).includes('.')) val = toFraction(val);
                    answers.push({ type: 'input-number', widgetKey: key, value: String(val) });
                }
            } catch(e) {}
        }
        return answers;
    };

    const applyAnswers = (bodyObj, answers) => {
        const content = [], userInput = {};
        let state = bodyObj.variables?.input?.attemptState ? JSON.parse(bodyObj.variables.input.attemptState) : {};
        
        answers.forEach(a => {
            if (a.type === 'radio') {
                const ids = a.multipleSelect ? a.choiceIds : [a.choiceIds[0]];
                content.push({ selectedChoiceIds: ids });
                userInput[a.widgetKey] = { selectedChoiceIds: ids };
            }
            else if (a.type === 'numeric-input' || a.type === 'input-number') {
                content.push({ currentValue: a.value });
                userInput[a.widgetKey] = { currentValue: a.value };
                if (state[a.widgetKey]) state[a.widgetKey].currentValue = a.value;
            }
            else if (a.type === 'dropdown') {
                content.push({ value: a.value });
                userInput[a.widgetKey] = { value: a.value };
            }
        });

        if (bodyObj.variables?.input) {
            bodyObj.variables.input.attemptContent = JSON.stringify([content]);
            bodyObj.variables.input.userInput = JSON.stringify(userInput);
            bodyObj.variables.input.attemptState = JSON.stringify(state);
        }
        return bodyObj;
    };

    const modifyItemData = (itemData) => {
        if (!itemData || !itemData.question) return false;
        itemData.question.content = phrases[Math.floor(Math.random() * phrases.length)] + "\n\n**Made by @im.nix**\n\nEscolha 1 resposta:";
        itemData.question.widgets = {
            "radio 1": {
                type: "radio",
                alignment: "default",
                static: false,
                graded: true,
                options: {
                    choices: [
                        { content: "**I Can Say** e **Platform Destroyer**.", correct: true, id: "correct-choice" },
                        { content: "Qualquer outro kibador.", correct: false, id: "incorrect-choice" }
                    ],
                    randomize: false,
                    multipleSelect: false
                }
            }
        };
        return true;
    };

    const createEmptyResponse = (bodyObj) => {
        const empty = JSON.parse(JSON.stringify(bodyObj));
        empty.variables.input.attemptContent = "[[]]";
        empty.variables.input.userInput = "{}";
        return empty;
    };

    // --- Fetch Interceptor ---
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        let bodyText = "";
        
        if (input instanceof Request) {
            bodyText = await input.clone().text();
        } else if (init?.body) {
            bodyText = init.body;
        }

        // 1. Intercept getAssessmentItemById (Modify UI)
        if (url.includes('getAssessmentItem') || bodyText.includes('getAssessmentItem')) {
            const res = await originalFetch.apply(this, arguments);
            if (!res.ok) return res;
            
            const clone = res.clone();
            try {
                const data = await clone.json();
                let item = null;
                for (const key in data.data) { if (data.data[key]?.item) { item = data.data[key].item; break; } }
                
                if (item?.itemDataAnswerless) {
                    let itemData = JSON.parse(item.itemDataAnswerless);
                    if (modifyItemData(itemData)) {
                        item.itemDataAnswerless = JSON.stringify(itemData);
                        sendToast("🔓 Khanware: Interface Modificada!");
                        
                        // Fix GRAPHQL_ERROR by creating a clean response
                        const newHeaders = new Headers(res.headers);
                        newHeaders.delete('content-encoding');
                        newHeaders.delete('content-length');
                        
                        return new Response(JSON.stringify(data), {
                            status: res.status,
                            statusText: res.statusText,
                            headers: newHeaders
                        });
                    }
                }
            } catch(e) { log("Error in getAssessmentItem interceptor: " + e); }
            return res;
        }

        // 2. Intercept attemptProblem (Inject Answers)
        if (bodyText.includes('"operationName":"attemptProblem"')) {
            try {
                let bodyObj = JSON.parse(bodyText);
                sendToast("🔍 Buscando resposta correta...");
                
                const emptyBody = createEmptyResponse(bodyObj);
                const firstRes = await originalFetch.call(this, url, {
                    ...init,
                    method: 'POST',
                    body: JSON.stringify(emptyBody)
                });
                
                if (!firstRes.ok) return firstRes;
                
                const data = await firstRes.clone().json();
                const rawItemData = data?.data?.attemptProblem?.result?.itemData;
                
                if (rawItemData) {
                    const itemData = JSON.parse(rawItemData);
                    const answers = extractAnswers(itemData);
                    
                    if (answers.length > 0) {
                        sendToast(`📦 Capturadas ${answers.length} respostas!`);
                        bodyObj = applyAnswers(bodyObj, answers);
                        
                        const secondRes = await originalFetch.call(this, url, {
                            ...init,
                            method: 'POST',
                            body: JSON.stringify(bodyObj)
                        });
                        
                        if (!secondRes.ok) return secondRes;
                        
                        const finalData = await secondRes.clone().json();
                        const finalItemData = JSON.parse(finalData.data.attemptProblem.result.itemData);
                        
                        if (modifyItemData(finalItemData)) {
                            finalData.data.attemptProblem.result.itemData = JSON.stringify(finalItemData);
                            
                            const newHeaders = new Headers(secondRes.headers);
                            newHeaders.delete('content-encoding');
                            newHeaders.delete('content-length');
                            
                            sendToast("✨ Resposta aplicada com sucesso!");
                            return new Response(JSON.stringify(finalData), {
                                status: secondRes.status,
                                statusText: secondRes.statusText,
                                headers: newHeaders
                            });
                        }
                        return secondRes;
                    }
                }
                return firstRes;
            } catch(e) { log("Error in attemptProblem interceptor: " + e); }
        }

        return originalFetch.apply(this, arguments);
    };

    // --- UI Elements ---
    function setupUI() {
        // Watermark
        const wm = document.createElement('div');
        wm.innerHTML = `KW <span style="font-size:10px; opacity:0.7;">${VERSION}</span>`;
        wm.style.cssText = "position:fixed; top:10px; right:10px; background:rgba(0,0,0,0.8); color:#00ff00; padding:5px 10px; border-radius:5px; font-family:monospace; z-index:10000; border:1px solid #00ff00; font-weight:bold; pointer-events:none;";
        document.body.appendChild(wm);

        // Status Panel
        const panel = document.createElement('div');
        panel.id = "kw-panel";
        panel.style.cssText = "position:fixed; bottom:10px; left:10px; background:rgba(0,0,0,0.9); color:white; padding:10px; border-radius:8px; font-family:sans-serif; z-index:10000; border:1px solid #333; font-size:12px; min-width:150px; box-shadow:0 4px 15px rgba(0,0,0,0.5);";
        panel.innerHTML = `
            <div style="color:#00ff00; font-weight:bold; margin-bottom:5px; border-bottom:1px solid #333; padding-bottom:3px;">KHANWARE ULTIMATE</div>
            <div id="kw-status">Status: <span style="color:#00ff00;">Ativo</span></div>
            <div id="kw-fps">FPS: --</div>
            <div id="kw-ping">Ping: --</div>
        `;
        document.body.appendChild(panel);

        // Dark Mode
        if (window.features.darkMode) {
            const style = document.createElement('style');
            style.textContent = `
                html, body { background-color: #111 !important; color: #eee !important; }
                .kui-button--primary { background-color: #007bff !important; }
                input[type="text"], input[type="radio"] { filter: invert(0.8) hue-rotate(180deg); }
            `;
            document.head.appendChild(style);
        }

        // Stats Update
        let lastTime = performance.now();
        let frames = 0;
        function updateStats() {
            frames++;
            const now = performance.now();
            if (now > lastTime + 1000) {
                document.getElementById('kw-fps').innerText = `FPS: ${Math.round((frames * 1000) / (now - lastTime))}`;
                lastTime = now;
                frames = 0;
            }
            requestAnimationFrame(updateStats);
        }
        updateStats();
        
        setInterval(async () => {
            const start = Date.now();
            try {
                await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' });
                document.getElementById('kw-ping').innerText = `Ping: ${Date.now() - start}ms`;
            } catch(e) {}
        }, 5000);
    }

    // --- Boot ---
    async function boot() {
        // Load Toastify
        if (!window.Toastify) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css';
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/toastify-js';
            document.head.appendChild(script);
            await delay(1000);
        }
        
        setupUI();
        sendToast(`🚀 Khanware ${VERSION} Iniciado!`, 5000);
    }

    if (document.readyState === 'complete') boot();
    else window.addEventListener('load', boot);

})();
