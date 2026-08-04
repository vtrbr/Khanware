// FIX: captura o fetch atual (que já inclui o questionSpoof) como _minuteFarmPrev
// para não quebrar a cadeia de interceptação
window._minuteFarmPrev = window.fetch;

window.fetch = async function (input, init = {}) {
    let body;
    if (input instanceof Request) body = await input.clone().text();
    else if (init && init.body) body = init.body;
    // FIX: input pode ser string (não Request), então input.url seria undefined
    // Usar a variável url extraída corretamente
    const url = input instanceof Request ? input.url : (typeof input === 'string' ? input : '');
    if (features.minuteFarmer && body && url.includes("mark_conversions")) {
        try {
            if (body.includes("termination_event")) { sendToast(`🚫 ${t('time_limiter_blocked')}`, 1000); return; }
        } catch (e) { debug(`🚨 ${t('error_at')} minuteFarm.js\n${e}`); }
    }
    return window._minuteFarmPrev.apply(this, arguments);
};
