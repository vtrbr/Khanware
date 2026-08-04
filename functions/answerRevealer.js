// Answer Revealer - Mostra as respostas corretas nas questões
// Agora com suporte para múltiplos tipos de widget

const originalParse = JSON.parse;
let answerRevealerActive = true;

// ===== CONFIGURAÇÕES =====
// Certifique-se que features existe
if (typeof features === 'undefined') {
    window.features = { showAnswers: true };
} else {
    features.showAnswers = true;
}

// ===== FUNÇÕES AUXILIARES =====
const revealAnswersInWidget = (widget, widgetKey) => {
    if (!widget || !widget.options) return false;
    
    let revealed = false;
    const options = widget.options;
    
    // Radio / Dropdown / Choices
    if (options.choices && Array.isArray(options.choices)) {
        options.choices.forEach(choice => {
            if (choice.correct) {
                // Não marca duas vezes
                if (!choice.content.startsWith('✅ ')) {
                    choice.content = '✅ ' + choice.content;
                    revealed = true;
                }
            }
        });
    }
    
    // Numeric Input
    if (options.answers && Array.isArray(options.answers)) {
        options.answers.forEach(answer => {
            if (answer.status === 'correct' && answer.value !== undefined) {
                // Adiciona indicação visual
                if (!answer._revealed) {
                    answer._revealed = true;
                    revealed = true;
                }
            }
        });
    }
    
    // Input Number
    if (options.value !== undefined && options.answerType) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Expression
    if (options.answerForms && Array.isArray(options.answerForms)) {
        options.answerForms.forEach(form => {
            if (form.considered === 'correct' || form.form === true) {
                if (!form._revealed) {
                    form._revealed = true;
                    revealed = true;
                }
            }
        });
    }
    
    // Grapher / Interactive Graph
    if (options.correct) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Categorizer
    if (options.values) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Matcher
    if (options.left && options.right) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Orderer
    if (options.correctOptions) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Sorter
    if (options.correct) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Number Line
    if (options.correctX !== undefined) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Plotter
    if (options.correct) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Matrix
    if (options.answers) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Table
    if (options.answers) {
        if (!options._revealed) {
            options._revealed = true;
            revealed = true;
        }
    }
    
    // Label Image
    if (options.markers && Array.isArray(options.markers)) {
        options.markers.forEach(marker => {
            if (marker.answers && marker.answers.length > 0) {
                if (!marker._revealed) {
                    marker._revealed = true;
                    revealed = true;
                }
            }
        });
    }
    
    return revealed;
};

const processItemData = (itemData) => {
    if (!itemData?.question?.widgets) return false;
    
    let anyRevealed = false;
    const widgets = itemData.question.widgets;
    
    // FIX: removido filtro restritivo de maiúsculas — processa qualquer questão
    
    Object.keys(widgets).forEach(widgetKey => {
        const widget = widgets[widgetKey];
        if (revealAnswersInWidget(widget, widgetKey)) {
            anyRevealed = true;
        }
    });
    
    if (anyRevealed) {
        debug(`🔓 Respostas reveladas!`);
    }
    
    return anyRevealed;
};

// ===== OVERRIDE DO JSON.PARSE =====
JSON.parse = function(text, reviver) {
    // Primeiro, faz o parse normal
    let result = originalParse(text, reviver);
    
    try {
        // Se não tiver dados ou o recurso estiver desativado, retorna normal
        if (!result?.data || !features.showAnswers) {
            return result;
        }
        
        let modified = false;
        
        // Itera sobre todas as chaves dos dados
        Object.keys(result.data).forEach(key => {
            const data = result.data[key];
            
            // Processa assessmentItem
            if (key === "assessmentItem" && data?.item?.itemData) {
                try {
                    const itemData = originalParse(data.item.itemData);
                    if (processItemData(itemData)) {
                        data.item.itemData = JSON.stringify(itemData);
                        modified = true;
                    }
                } catch (e) {
                    debug(`Erro ao processar assessmentItem: ${e.message}`);
                }
            }
            
            // Processa attemptProblem result
            if (key === "attemptProblem" && data?.result?.itemData) {
                try {
                    const itemData = originalParse(data.result.itemData);
                    if (processItemData(itemData)) {
                        data.result.itemData = JSON.stringify(itemData);
                        modified = true;
                    }
                } catch (e) {
                    debug(`Erro ao processar attemptProblem: ${e.message}`);
                }
            }
        });
        
        if (modified) {
            debug(`✅ Respostas corretas reveladas!`);
        }
        
    } catch (e) {
        debug(`Erro no answerRevealer: ${e.message}`);
    }
    
    return result;
};

// ===== FUNÇÃO PARA ATIVAR/DESATIVAR =====
window.toggleAnswerRevealer = function(enable) {
    features.showAnswers = enable !== undefined ? enable : !features.showAnswers;
    debug(`Answer Revealer ${features.showAnswers ? 'ativado' : 'desativado'}`);
    return features.showAnswers;
};

// ===== INICIALIZAÇÃO =====
console.log('✅ Answer Revealer carregado!');
console.log('📝 Use toggleAnswerRevealer() para ativar/desativar');
