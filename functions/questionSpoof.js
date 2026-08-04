
// ===== UTILITIES =====
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

// ===== FUNÇÕES AUXILIARES =====
const toFraction = (d) => { 
    if (d === 0 || d === 1) return String(d); 
    const decimals = (String(d).split('.')[1] || '').length; 
    let num = Math.round(d * Math.pow(10, decimals)), 
        den = Math.pow(10, decimals); 
    const gcd = (a, b) => { 
        while (b) [a, b] = [b, a % b]; 
        return a; 
    }; 
    const div = gcd(Math.abs(num), Math.abs(den)); 
    return den / div === 1 ? String(num / div) : `${num / div}/${den / div}`; 
};

const createEmptyResponse = (bodyObj) => { 
    const emptyBody = JSON.parse(JSON.stringify(bodyObj)); 
    if (emptyBody.variables?.input) {
        emptyBody.variables.input.attemptContent = "[[]]"; 
        emptyBody.variables.input.userInput = "{}"; 
    }
    return emptyBody; 
};

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
                    answers.push({ 
                        type: 'radio', 
                        choiceIds: correctChoices.map(c => c.id),
                        multipleSelect: w.options.multipleSelect || false,
                        widgetKey: key 
                    });
                }
            }
            else if ((w.type === 'dropdown') && w.options?.choices) {
                const correct = w.options.choices.find(c => c.correct);
                if (correct) {
                    const correctIndex = w.options.choices.findIndex(c => c.correct);
                    answers.push({ 
                        type: 'dropdown', 
                        value: correctIndex + 1,
                        choices: w.options.choices.map(c => c.content),
                        placeholder: w.options.placeholder || '',
                        widgetKey: key 
                    });
                }
            }
            else if ((w.type === 'numeric-input') && w.options?.answers) {
                const correct = w.options.answers.find(a => a.status === 'correct');
                if (correct && correct.value !== null && correct.value !== undefined) {
                    let val = correct.value;
                    const simplify = correct.simplify || 'required';
                    const answerForms = correct.answerForms || [];
                    if (answerForms.includes('proper') || answerForms.includes('improper') || answerForms.includes('mixed')) {
                        val = toFraction(val);
                    } else {
                        val = String(val);
                    }
                    answers.push({ 
                        type: 'numeric-input',
                        value: val,
                        simplify: simplify,
                        widgetKey: key 
                    });
                }
            }
            else if ((w.type === 'input-number') && w.options?.value !== undefined) {
                let val = w.options.value;
                const simplify = w.options.simplify || 'required';
                if (val > 0 && val < 1 && String(val).includes('.')) val = toFraction(val);
                else val = String(val);
                answers.push({ 
                    type: 'input-number',
                    value: val,
                    simplify: simplify,
                    answerType: w.options.answerType || 'number',
                    widgetKey: key 
                });
            }
            else if ((w.type === 'expression') && w.options?.answerForms) {
                const correct = w.options.answerForms.find(f => f.considered === 'correct' || f.form === true);
                if (correct) {
                    answers.push({ 
                        type: 'expression', 
                        value: correct.value,
                        buttonSets: w.options.buttonSets || ['basic'],
                        functions: w.options.functions || ['f', 'g', 'h'],
                        times: w.options.times || false,
                        widgetKey: key 
                    });
                }
            }
        } catch (error) {
            debug(`Erro ao extrair respostas do widget ${key}: ${error.message}`);
        }
    }
    return answers;
};

// Preenchimento visual dos inputs para evitar bloqueio do frontend
const autoFillDOM = (answers) => {
    if (!answers || answers.length === 0) return;
    
    answers.forEach(a => {
        try {
            if (a.type === 'numeric-input' || a.type === 'input-number') {
                const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
                inputs.forEach(input => {
                    // Tenta encontrar o input correto. Como o widgetKey nem sempre está no DOM,
                    // preenchemos todos os campos vazios com a primeira resposta disponível.
                    if (!input.value) {
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(input, a.value);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        debug(`Preenchido input visualmente com: ${a.value}`);
                    }
                });
            }
        } catch (e) {
            debug(`Erro no autoFillDOM: ${e.message}`);
        }
    });
};

const applyAnswers = (bodyObj, answers) => {
    if (!bodyObj?.variables?.input) return bodyObj;
    
    const content = [];
    const userInput = {};
    let state = {};
    
    try {
        state = bodyObj.variables.input.attemptState ? JSON.parse(bodyObj.variables.input.attemptState) : {};
    } catch (e) {
        state = {};
    }
    
    answers.forEach(a => {
        try {
            if (a.type === 'radio') {
                const selectedIds = a.multipleSelect ? a.choiceIds : [a.choiceIds[0]];
                content.push({ selectedChoiceIds: selectedIds });
                userInput[a.widgetKey] = { selectedChoiceIds: selectedIds };
            }
            else if (a.type === 'dropdown') {
                content.push({ value: a.value });
                userInput[a.widgetKey] = { value: a.value };
            }
            else if (a.type === 'numeric-input' || a.type === 'input-number') {
                content.push({ currentValue: a.value });
                userInput[a.widgetKey] = { currentValue: a.value };
                if (state?.[a.widgetKey]) {
                    state[a.widgetKey].currentValue = a.value;
                }
            }
            else if (a.type === 'expression') {
                content.push(a.value);
                userInput[a.widgetKey] = a.value;
            }
        } catch (error) {
            debug(`Erro ao aplicar resposta do widget ${a.widgetKey}: ${error.message}`);
        }
    });

    try {
        bodyObj.variables.input.attemptContent = JSON.stringify([content, []]);
        bodyObj.variables.input.userInput = JSON.stringify(userInput);
        if (state) bodyObj.variables.input.attemptState = JSON.stringify(state);
    } catch (error) {
        debug(`Erro ao aplicar respostas no body: ${error.message}`);
    }
    
    return bodyObj;
};

const modifyItemData = (itemData) => {
    if (!itemData?.question?.content) return false;
    
    itemData.answerArea = { 
        calculator: false, chi2Table: false, periodicTable: false, tTable: false, zTable: false 
    };
    
    itemData.question.content = phrases[Math.floor(Math.random() * phrases.length)] + 
        "\n\n**Onde você deve obter seus scripts?**" + 
        `[[☃ radio 1]]` + 
        `\n\n**💎 Quer ter a sua mensagem lida para TODOS utilizando o Khanware?** \nFaça uma [Donate Aqui](https://livepix.gg/nixyy)!`;
    
    itemData.question.widgets = {
        "radio 1": {
            type: "radio", alignment: "default", static: false, graded: true,
            options: {
                choices: [
                    { content: "**I Can Say** e **Platform Destroyer**.", correct: true, id: "correct-choice" },
                    { content: "No servidor do **Niximkk**.", correct: false, id: "wrong-choice-1" },
                    { content: "Em qualquer lugar.", correct: false, id: "wrong-choice-2" }
                ],
                randomize: true, multipleSelect: false
            }
        }
    };
    
    return true;
};

// ===== FETCH OVERRIDE =====
if (!window._qsPrev) {
    window._qsPrev = window.fetch;

    window.fetch = async function(input, init) {
        let url = typeof input === 'string' ? input : input.url;
        let method = init?.method || (input instanceof Request ? input.method : 'GET');
        
        // Interceptação de questões (carregamento)
        if (url.includes('getAssessmentItem')) {
            const response = await window._qsPrev.apply(this, arguments);
            const clone = response.clone();
            
            try {
                const data = await clone.json();
                let modified = false;
                
                Object.keys(data.data || {}).forEach(key => {
                    const item = data.data[key]?.item;
                    if (item?.itemData) {
                        const itemData = JSON.parse(item.itemData);
                        if (modifyItemData(itemData)) {
                            item.itemData = JSON.stringify(itemData);
                            modified = true;
                        }
                    }
                });
                
                if (modified) {
                    debug("Questão modificada para múltipla escolha.");
                    
                    // Tenta extrair e preencher respostas se disponíveis (answerRevealer style)
                    Object.keys(data.data || {}).forEach(key => {
                        const item = data.data[key]?.item;
                        if (item?.itemData) {
                            const parsed = JSON.parse(item.itemData);
                            const answers = extractAnswers(parsed);
                            if (answers.length > 0) autoFillDOM(answers);
                        }
                    });

                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            } catch (e) {
                debug(`Erro ao processar getAssessmentItem: ${e.message}`);
            }
            return response;
        }

        // Interceptação de respostas (envio)
        if (method === 'POST' && url.includes('graphql')) {
            let body;
            try {
                if (init?.body) body = init.body;
                else if (input instanceof Request) {
                    const clonedReq = input.clone();
                    body = await clonedReq.text();
                }

                if (body && body.includes('"operationName":"attemptProblem"')) {
                    debug("Interceptado attemptProblem. Obtendo respostas...");
                    sendToast("🔍 Searching for correct answers...");
                    
                    let bodyObj = JSON.parse(body);
                    const emptyBody = createEmptyResponse(bodyObj);
                    
                    // Faz uma tentativa vazia para obter as respostas
                    const firstAttempt = await window._qsPrev.call(this, url, {
                        ...init,
                        body: JSON.stringify(emptyBody)
                    });
                    
                    const responseData = await firstAttempt.json();
                    const itemData = responseData?.data?.attemptProblem?.result?.itemData;
                    
                    if (itemData) {
                        const parsedItemData = JSON.parse(itemData);
                        const answers = extractAnswers(parsedItemData);
                        
                        if (answers.length > 0) {
                            debug(`Respostas encontradas: ${answers.length}`);
                            sendToast(`✅ Found ${answers.length} answers!`);
                            
                            // Preenche o DOM visualmente para evitar bloqueio do frontend
                            autoFillDOM(answers);
                            
                            // Aplica as respostas no body da requisição real
                            bodyObj = applyAnswers(bodyObj, answers);
                            const finalBody = JSON.stringify(bodyObj);
                            
                            // Re-envia a requisição com as respostas corretas
                            return window._qsPrev.call(this, url, {
                                ...init,
                                body: finalBody
                            });
                        }
                    }
                }
            } catch (e) {
                debug(`Erro no processamento do POST: ${e.message}`);
            }
        }

        return window._qsPrev.apply(this, arguments);
    };
    
    debug("Fetch override (QuestionSpoof) ativo.");
}
