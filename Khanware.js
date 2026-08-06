/**
 * Khanware v4.0 - Unified Khan Academy Auto-Solver
 * Repository: https://github.com/vtrbr/Khanware
 * A comprehensive script that automatically answers Khan Academy questions
 */

(function() {
    'use strict';

    // ============================================================================
    // CONFIGURATION & STATE
    // ============================================================================
    const VERSION = '4.0.0';
    const REPO = 'https://cdn.jsdelivr.net/gh/vtrbr/Khanware@main';
    
    let state = {
        currentAnswers: null,
        isProcessing: false,
        questionsAnswered: 0,
        startTime: Date.now(),
    };

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    const log = (msg, data) => console.log(`[KW v${VERSION}]`, msg, data || '');
    const warn = (msg, data) => console.warn(`[KW v${VERSION}]`, msg, data || '');
    
    const toast = (msg, type = 'info') => {
        if (window.Toastify) {
            const colors = { success: '#4caf50', error: '#f44336', info: '#2196f3' };
            Toastify({
                text: msg,
                duration: 3000,
                gravity: 'bottom',
                position: 'left',
                backgroundColor: colors[type] || colors.info,
            }).showToast();
        }
        log(msg);
    };

    const toFraction = (n) => {
        if (n === 0 || n === 1) return String(n);
        const decimals = (String(n).split('.')[1] || '').length;
        let num = Math.round(n * Math.pow(10, decimals));
        let den = Math.pow(10, decimals);
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const g = gcd(Math.abs(num), Math.abs(den));
        return den / g === 1 ? String(num / g) : `${num / g}/${den / g}`;
    };

    // ============================================================================
    // EXTRACT ANSWERS FROM QUESTION DATA
    // ============================================================================
    const extractAnswers = (itemData) => {
        const answers = [];
        if (!itemData?.question?.widgets) return answers;

        for (const [key, widget] of Object.entries(itemData.question.widgets)) {
            if (!widget?.type) continue;

            try {
                if (widget.type === 'radio' && widget.options?.choices) {
                    const correct = widget.options.choices.filter(c => c.correct);
                    if (correct.length) {
                        answers.push({
                            type: 'radio',
                            widgetKey: key,
                            choiceIds: correct.map((c, i) => c.id || `choice-${i}`),
                            multipleSelect: widget.options.multipleSelect || false,
                        });
                    }
                } 
                else if (widget.type === 'numeric-input' && widget.options?.answers) {
                    const correct = widget.options.answers.find(a => a.status === 'correct');
                    if (correct?.value !== null && correct?.value !== undefined) {
                        let value = correct.value;
                        if (correct.answerForms?.some(f => ['proper', 'improper', 'mixed'].includes(f))) {
                            value = toFraction(value);
                        }
                        answers.push({
                            type: 'numeric-input',
                            widgetKey: key,
                            value: String(value),
                        });
                    }
                }
                else if (widget.type === 'dropdown' && widget.options?.choices) {
                    const correct = widget.options.choices.find(c => c.correct);
                    if (correct) {
                        const idx = widget.options.choices.indexOf(correct);
                        answers.push({
                            type: 'dropdown',
                            widgetKey: key,
                            value: idx + 1,
                        });
                    }
                }
                else if (widget.type === 'input-number' && widget.options?.value !== undefined) {
                    let value = widget.options.value;
                    if (value > 0 && value < 1 && String(value).includes('.')) {
                        value = toFraction(value);
                    }
                    answers.push({
                        type: 'input-number',
                        widgetKey: key,
                        value: String(value),
                    });
                }
            } catch (e) {
                warn(`Error extracting answer for widget ${key}:`, e);
            }
        }
        return answers;
    };

    // ============================================================================
    // APPLY ANSWERS TO REQUEST BODY
    // ============================================================================
    const applyAnswers = (bodyObj, answers) => {
        try {
            const content = [];
            const userInput = {};
            let state = {};

            if (bodyObj.variables?.input?.attemptState) {
                try {
                    state = JSON.parse(bodyObj.variables.input.attemptState);
                } catch (e) {
                    state = {};
                }
            }

            answers.forEach(ans => {
                if (ans.type === 'radio') {
                    const ids = ans.multipleSelect ? ans.choiceIds : [ans.choiceIds[0]];
                    content.push({ selectedChoiceIds: ids });
                    userInput[ans.widgetKey] = { selectedChoiceIds: ids };
                } 
                else if (ans.type === 'numeric-input') {
                    userInput[ans.widgetKey] = { currentValue: ans.value };
                    if (state[ans.widgetKey]) state[ans.widgetKey].currentValue = ans.value;
                } 
                else if (ans.type === 'dropdown') {
                    content.push({ value: ans.value });
                    userInput[ans.widgetKey] = { value: ans.value };
                } 
                else if (ans.type === 'input-number') {
                    content.push({ currentValue: ans.value });
                    userInput[ans.widgetKey] = { currentValue: ans.value };
                }
            });

            if (bodyObj.variables?.input) {
                bodyObj.variables.input.attemptContent = JSON.stringify([content]);
                bodyObj.variables.input.userInput = JSON.stringify(userInput);
                if (Object.keys(state).length > 0) {
                    bodyObj.variables.input.attemptState = JSON.stringify(state);
                }
            }

            return bodyObj;
        } catch (e) {
            warn('Error applying answers:', e);
            return bodyObj;
        }
    };

    // ============================================================================
    // AUTO-FILL DOM
    // ============================================================================
    const autoFillDOM = (answers) => {
        answers.forEach(ans => {
            if (ans.type === 'numeric-input') {
                const inputs = document.querySelectorAll('input[type="text"]');
                inputs.forEach(inp => {
                    if (!inp.value && !inp.disabled && inp.offsetParent !== null) {
                        inp.value = ans.value;
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            } 
            else if (ans.type === 'radio') {
                const radios = document.querySelectorAll('input[type="radio"]');
                radios.forEach(r => {
                    if (ans.choiceIds.includes(r.value) || ans.choiceIds.includes(r.id)) {
                        r.checked = true;
                        r.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
        });
    };

    // ============================================================================
    // FETCH OVERRIDE
    // ============================================================================
    const originalFetch = window.fetch;

    window.fetch = function(...args) {
        const [resource, config] = args;
        const url = typeof resource === 'string' ? resource : resource?.url;
        let body = config?.body || (typeof resource === 'object' ? resource?.body : null);

        // Parse body if string
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                body = null;
            }
        }

        // Intercept getAssessmentItemById
        if (url?.includes('graphql') && body?.operationName === 'getAssessmentItemById') {
            return originalFetch.apply(this, args).then(res => {
                return res.clone().json().then(data => {
                    try {
                        const itemData = data.data?.getAssessmentItemById?.item;
                        if (itemData) {
                            const answers = extractAnswers(itemData);
                            if (answers.length > 0) {
                                state.currentAnswers = answers;
                                log(`✅ Extracted ${answers.length} answers`);
                                autoFillDOM(answers);
                            }
                        }
                    } catch (e) {
                        warn('Error in getAssessmentItemById:', e);
                    }
                    return res;
                });
            });
        }

        // Intercept attemptProblem
        if (url?.includes('graphql') && body?.operationName === 'attemptProblem') {
            if (state.currentAnswers?.length > 0) {
                body = applyAnswers(body, state.currentAnswers);
                if (config) config.body = JSON.stringify(body);
                else args[1] = { ...args[1], body: JSON.stringify(body) };
                log('✔️ Injected answers into attemptProblem');
                state.questionsAnswered++;
            }
        }

        return originalFetch.apply(this, args);
    };

    // ============================================================================
    // DARK MODE
    // ============================================================================
    const enableDarkMode = () => {
        const style = document.createElement('style');
        style.textContent = `
            html, body { background: #1a1a1a !important; color: #e0e0e0 !important; }
            input, textarea, select { background: #2a2a2a !important; color: #e0e0e0 !important; border: 1px solid #444 !important; }
            button { background: #0066cc !important; color: white !important; }
            a { color: #64b5f6 !important; }
        `;
        document.head.appendChild(style);
        log('🌙 Dark mode enabled');
    };

    // ============================================================================
    // INITIALIZE
    // ============================================================================
    const init = () => {
        log(`🚀 Khanware v${VERSION} initialized`);
        enableDarkMode();
        toast(`⭐ Khanware v${VERSION} loaded!`, 'success');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose to window
    window.Khanware = { VERSION, state, log, toast };
})();
