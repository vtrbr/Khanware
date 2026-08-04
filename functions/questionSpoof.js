
// Khanware QuestionSpoof - Restaurado e Melhorado
const debug = (msg) => console.log(`[DEBUG] Khanware: ${msg}`);
const sendToast = (msg, duration = 3000) => {
    if (window.sendToast) window.sendToast(msg, duration);
    else console.log(`[TOAST] ${msg}`);
};

const phrases = [ 
    "🔥 Get good, get [**Khanware**](https://github.com/vtrbr/Khanware/)!",
    "🤍 Made by [**@im.nix**](https://e-z.bio/sounix).",
    "☄️ By [**vtrbr/Khanware**](https://github.com/vtrbr/Khanware/).",
    "🌟 Star the project on [GitHub](https://github.com/vtrbr/Khanware/)!"
];

const toFraction = (d) => { if (d === 0 || d === 1) return String(d); const decimals = (String(d).split('.')[1] || '').length; let num = Math.round(d * Math.pow(10, decimals)), den = Math.pow(10, decimals); const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; }; const div = gcd(Math.abs(num), Math.abs(den)); return den / div === 1 ? String(num / div) : `${num / div}/${den / div}`; };
const createEmptyResponse = (bodyObj) => { const emptyBody = JSON.parse(JSON.stringify(bodyObj)); if(emptyBody.variables?.input) { emptyBody.variables.input.attemptContent = "[[]]"; emptyBody.variables.input.userInput = "{}"; } return emptyBody; };

const isWidgetUsed = (widgetKey, questionContent, hints) => {
    const widgetPattern = `☃ ${widgetKey.replace(/\s+/g, ' ')}`;
    if (questionContent && questionContent.includes(widgetPattern)) return true;
    if (hints && Array.isArray(hints)) {
        for (const hint of hints) {
            if (hint.content && hint.content.includes(widgetPattern)) return true;
            if (hint.widgets) {
                for (const hintWidget of Object.values(hint.widgets)) {
                    if (hintWidget.options?.content?.includes(widgetPattern)) return true;
                }
            }
        }
    }
    return false;
};

const extractAnswers = (itemData) => {
    const answers = [];
    if (!itemData?.question?.widgets) return answers;
    for (const [key, w] of Object.entries(itemData.question.widgets)) {
        if (!isWidgetUsed(key, itemData.question.content, itemData.hints)) continue;
        try {
            if ((w.type === 'radio') && w.options?.choices) {
                const choices = w.options.choices.map((c, i) => ({ ...c, id: c.id || `radio-choice-${i}` }));
                const correctChoices = choices.filter(c => c.correct);
                if (correctChoices.length > 0) {
                    answers.push({ type: 'radio', choiceIds: correctChoices.map(c => c.id), multipleSelect: w.options.multipleSelect || false, widgetKey: key });
                }
            } else if ((w.type === 'numeric-input') && w.options?.answers) {
                const correct = w.options.answers.find(a => a.status === 'correct');
                if (correct && correct.value !== null && correct.value !== undefined) {
                    let val = correct.value;
                    const simplify = correct.simplify || 'required';
                    const answerForms = correct.answerForms || [];
                    if (answerForms.includes('proper') || answerForms.includes('improper') || answerForms.includes('mixed')) val = toFraction(val);
                    else val = String(val);
                    answers.push({ type: 'numeric-input', value: val, simplify: simplify, widgetKey: key });
                }
            } else if ((w.type === 'input-number') && w.options?.value !== undefined) {
                let val = w.options.value;
                if (val > 0 && val < 1 && String(val).includes('.')) val = toFraction(val);
                else val = String(val);
                answers.push({ type: 'input-number', value: val, widgetKey: key });
            }
        } catch (e) { debug(`Erro extract: ${e.message}`); }
    }
    return answers;
};

const autoFillDOM = (answers) => {
    if (!answers) return;
    answers.forEach(a => {
        try {
            if (a.type === 'numeric-input' || a.type === 'input-number') {
                const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
                inputs.forEach(input => {
                    if (!input.value) {
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(input, a.value);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
        } catch (e) {}
    });
};

const applyAnswers = (bodyObj, answers) => {
    const content = [], userInput = {};
    let state = bodyObj.variables.input.attemptState ? JSON.parse(bodyObj.variables.input.attemptState) : {};
    answers.forEach(a => {
        if (a.type === 'radio') {
            const selectedIds = a.multipleSelect ? a.choiceIds : [a.choiceIds[0]];
            content.push({ selectedChoiceIds: selectedIds });
            userInput[a.widgetKey] = { selectedChoiceIds: selectedIds };
        } else if (a.type === 'numeric-input' || a.type === 'input-number') {
            content.push({ currentValue: a.value });
            userInput[a.widgetKey] = { currentValue: a.value };
            if (state?.[a.widgetKey]) state[a.widgetKey].currentValue = a.value;
        }
    });
    bodyObj.variables.input.attemptContent = JSON.stringify([content, []]);
    bodyObj.variables.input.userInput = JSON.stringify(userInput);
    if (state) bodyObj.variables.input.attemptState = JSON.stringify(state);
    return bodyObj;
};

const modifyItemData = (itemData) => {
    if (!itemData?.question?.content) return false;
    itemData.answerArea = { calculator: false, chi2Table: false, periodicTable: false, tTable: false, zTable: false };
    itemData.question.content = phrases[Math.floor(Math.random() * phrases.length)] + 
        "\n\n**Onde você deve obter seus scripts?**" + `[[☃ radio 1]]` + 
        `\n\n**💎 Donate:** [livepix.gg/nixyy](https://livepix.gg/nixyy)`;
    itemData.question.widgets = {
        "radio 1": {
            type: "radio", alignment: "default", static: false, graded: true,
            options: {
                choices: [
                    { content: "**I Can Say** e **Platform Destroyer**.", correct: true, id: "correct-choice" },
                    { content: "No servidor do **Niximkk**.", correct: false, id: "wrong-choice-1" }
                ],
                randomize: false, multipleSelect: false
            }
        }
    };
    return true;
};

if (!window._qsPrev) {
    window._qsPrev = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        let method = init?.method || (input instanceof Request ? input.method : 'GET');
        let body = input instanceof Request ? await input.clone().text() : init?.body;

        // Interceptação getAssessmentItem (incluindo ById)
        if (url.includes('getAssessmentItem')) {
            const res = await window._qsPrev.apply(this, arguments);
            const clone = res.clone();
            try {
                const data = await clone.json();
                let modified = false;
                Object.keys(data.data || {}).forEach(key => {
                    const item = data.data[key]?.item;
                    // Tenta itemDataAnswerless (original) ou itemData (ByID)
                    const targetField = item?.itemDataAnswerless ? 'itemDataAnswerless' : (item?.itemData ? 'itemData' : null);
                    if (targetField) {
                        const itemData = JSON.parse(item[targetField]);
                        if (modifyItemData(itemData)) {
                            item[targetField] = JSON.stringify(itemData);
                            modified = true;
                            // Se for ByID, já temos as respostas no itemData
                            const ans = extractAnswers(itemData);
                            if (ans.length > 0) setTimeout(() => autoFillDOM(ans), 500);
                        }
                    }
                });
                if (modified) return new Response(JSON.stringify(data), { status: res.status, headers: res.headers });
            } catch (e) {}
            return res;
        }

        // Interceptação attemptProblem
        if (body && body.includes('"operationName":"attemptProblem"')) {
            let bodyObj = JSON.parse(body);
            const emptyBody = createEmptyResponse(bodyObj);
            const firstAttempt = await window._qsPrev.call(this, url, { ...init, body: JSON.stringify(emptyBody) });
            const responseData = await firstAttempt.json();
            const itemData = responseData?.data?.attemptProblem?.result?.itemData;
            if (itemData) {
                const answers = extractAnswers(JSON.parse(itemData));
                if (answers.length > 0) {
                    autoFillDOM(answers);
                    bodyObj = applyAnswers(bodyObj, answers);
                    const secondAttempt = await window._qsPrev.call(this, url, { ...init, body: JSON.stringify(bodyObj) });
                    const finalRes = await secondAttempt.json();
                    if (finalRes?.data?.attemptProblem?.result?.itemData) {
                        const resItemData = JSON.parse(finalRes.data.attemptProblem.result.itemData);
                        if (modifyItemData(resItemData)) {
                            finalRes.data.attemptProblem.result.itemData = JSON.stringify(resItemData);
                            return new Response(JSON.stringify(finalRes), { status: secondAttempt.status, headers: secondAttempt.headers });
                        }
                    }
                    return secondAttempt;
                }
            }
            return firstAttempt;
        }
        return window._qsPrev.apply(this, arguments);
    };
    debug("Fetch override restaurado.");
}
