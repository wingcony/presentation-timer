/**
 * Presentation Timer Pro v3.3 (Rendering Optimized)
 */
const bc = new BroadcastChannel('presentation-timer-channel');

const COLORS = [
    { label: 'デフォルト', value: '', class: 'default' }, 
    { label: '赤', value: 'var(--c-red)', class: 'red' },
    { label: '赤 (UD)', value: 'var(--c-red-ud)', class: 'red-ud' },
    { label: '黄', value: 'var(--c-yellow)', class: 'yellow' },
    { label: '黄 (UD)', value: 'var(--c-yellow-ud)', class: 'yellow-ud' },
    { label: '緑', value: 'var(--c-green)', class: 'green' },
    { label: '緑 (UD)', value: 'var(--c-green-ud)', class: 'green-ud' }
];

let config = {
    totalSeconds: 600, 
    displayFormat: 'auto',
    overtimeMode: 'stop',
    textSchedule: [
        { time: Infinity, color: '' },
        { time: 180, color: 'var(--c-yellow)' },
        { time: 60, color: 'var(--c-red)' }
    ],
    barSchedule: [
        { time: Infinity, color: '', blink: false },
        { time: 180, color: '', blink: false },
        { time: 60, color: '', blink: false }
    ]
};

let state = {
    endTime: null,
    remainingMs: 0,
    isRunning: false,
    animationFrameId: null,
    currentTheme: 'dark',
    isReceiver: false,
    meetingTitle: ''
};

const els = {
    bar: document.getElementById('status-bar'),
    display: document.getElementById('timer-display'),
    otContainer: document.getElementById('overtime-container'),
    otDisplay: document.getElementById('overtime-display'),
    titleInput: document.getElementById('meeting-title'),
    soundBell: document.getElementById('sound-bell'),
    
    // Inputs (Footer)
    curH: document.getElementById('current-h'),
    curM: document.getElementById('current-m'),
    curS: document.getElementById('current-s'),
    nxtH: document.getElementById('next-h'),
    nxtM: document.getElementById('next-m'),
    nxtS: document.getElementById('next-s'),
    
    // Buttons
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnReset: document.getElementById('btn-reset'),
    btnBell: document.getElementById('btn-bell'),
    btnSettings: document.getElementById('btn-settings'),
    btnTheme: document.getElementById('btn-theme-toggle'),
    btnWindow: document.getElementById('btn-window'),
    
    // Modal
    modal: document.getElementById('settings-modal'),
    btnClose: document.getElementById('btn-close-settings'),
    btnApply: document.getElementById('btn-apply-settings'),
    errorMsg: document.getElementById('error-msg'),
    otRadios: document.getElementsByName('ot-mode'),
    
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    textTime1H: document.getElementById('text-time-1-h'),
    textTime1M: document.getElementById('text-time-1-m'),
    textTime1S: document.getElementById('text-time-1-s'),
    textTime2H: document.getElementById('text-time-2-h'),
    textTime2M: document.getElementById('text-time-2-m'),
    textTime2S: document.getElementById('text-time-2-s'),

    barTime1H: document.getElementById('bar-time-1-h'),
    barTime1M: document.getElementById('bar-time-1-m'),
    barTime1S: document.getElementById('bar-time-1-s'),
    barTime2H: document.getElementById('bar-time-2-h'),
    barTime2M: document.getElementById('bar-time-2-m'),
    barTime2S: document.getElementById('bar-time-2-s'),

    barBlinkStart: document.getElementById('bar-blink-start'),
    barBlink1: document.getElementById('bar-blink-1'),
    barBlink2: document.getElementById('bar-blink-2')
};

// ==========================================
// Initialization
// ==========================================
function init() {
    // Check Mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'receiver') {
        state.isReceiver = true;
        document.body.classList.add('receiver-mode');
        setupReceiver();
    } else {
        setupSender();
    }

    renderPalette('palette-text-start', 'bg-text-start');
    renderPalette('palette-text-1', 'bg-text-1');
    renderPalette('palette-text-2', 'bg-text-2');
    renderPalette('palette-bar-start', 'bg-bar-start');
    renderPalette('palette-bar-1', 'bg-bar-1');
    renderPalette('palette-bar-2', 'bg-bar-2');

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        state.currentTheme = 'light';
    }
    applyTheme();

    fillCurrentInputs(config.totalSeconds);
    resetTimerLogic(config.totalSeconds);
}

function setupSender() {
    els.btnStart.addEventListener('click', startTimer);
    els.btnPause.addEventListener('click', pauseTimer);
    els.btnReset.addEventListener('click', resetTimer);
    els.btnBell.addEventListener('click', ringBell);
    els.btnSettings.addEventListener('click', openSettings);
    els.btnWindow.addEventListener('click', openReceiverWindow);
    
    els.btnClose.addEventListener('click', closeSettings);
    els.btnApply.addEventListener('click', applySettings);
    els.btnTheme.addEventListener('click', toggleTheme);

    els.titleInput.addEventListener('input', (e) => {
        state.meetingTitle = e.target.value;
        broadcastState();
    });

    [els.curH, els.curM, els.curS].forEach(inp => {
        inp.addEventListener('change', updateCurrentConfigFromInputs);
    });

    document.addEventListener('keydown', handleKeyboardShortcuts);

    els.tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            els.tabs.forEach(t => t.classList.remove('active'));
            els.tabContents.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.add('active');
        });
    });

    setInterval(broadcastState, 1000);
}

function setupReceiver() {
    bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        config = data.config; 
        if (data.isRunning) {
            state.endTime = data.endTime;
            state.isRunning = true;
            tick(); 
        } else {
            state.isRunning = false;
            state.remainingMs = data.remainingMs;
            state.endTime = null;
            cancelAnimationFrame(state.animationFrameId);
            render(state.remainingMs);
        }
        els.titleInput.value = data.meetingTitle;
        state.currentTheme = data.currentTheme;
        applyTheme();
    };
}

function handleKeyboardShortcuts(e) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space') {
        e.preventDefault();
        if (state.isRunning) pauseTimer();
        else startTimer();
    } else if (e.code === 'KeyR' && e.shiftKey) {
        e.preventDefault();
        resetTimer();
    } else if (e.code === 'KeyB' && e.shiftKey) {
        e.preventDefault();
        ringBell();
    }
}

// ==========================================
// Logic
// ==========================================

function updateCurrentConfigFromInputs() {
    if (state.isRunning) return;
    const total = getSecFromInputsHMS(els.curH, els.curM, els.curS);
    if (total > 0) {
        config.totalSeconds = total;
        updateDisplayFormat();
        resetTimerLogic(total);
        broadcastState();
    }
}

function fillCurrentInputs(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    els.curH.value = h;
    els.curM.value = m;
    els.curS.value = s;
}

function updateDisplayFormat() {
    const h = parseInt(els.curH.value||0);
    const m = parseInt(els.curM.value||0);
    if (h > 0) config.displayFormat = 'hms';
    else if (m >= 60) config.displayFormat = 'ms_ext';
    else config.displayFormat = 'auto';
}

function startTimer() {
    if (state.isRunning) return;
    lockCurrentInputs(true);
    state.isRunning = true;
    state.endTime = Date.now() + state.remainingMs;
    updateUIState(true);
    tick();
    broadcastState();
}

function pauseTimer() {
    if (!state.isRunning) return;
    state.isRunning = false;
    cancelAnimationFrame(state.animationFrameId);
    state.remainingMs = state.endTime - Date.now();
    updateUIState(false);
    broadcastState();
}

function resetTimer() {
    pauseTimer();
    const nextTotal = getSecFromInputsHMS(els.nxtH, els.nxtM, els.nxtS);
    
    if (nextTotal > 0) {
        applyNext(nextTotal);
    } else {
        resetTimerLogic(config.totalSeconds);
    }
    
    lockCurrentInputs(false);
    broadcastState();
}

function applyNext(totalSec) {
    config.totalSeconds = totalSec;
    fillCurrentInputs(totalSec);
    updateDisplayFormat();
    els.nxtH.value = ''; els.nxtM.value = ''; els.nxtS.value = '';
    resetTimerLogic(totalSec);
}

function resetTimerLogic(sec) {
    state.remainingMs = sec * 1000;
    state.endTime = null;
    els.otContainer.classList.add('hidden');
    els.bar.className = 'status-bar'; 
    els.bar.style.backgroundColor = 'transparent';
    els.display.style.color = '';
    els.display.classList.remove('dimmed');
    render(state.remainingMs);
    updateUIState(false);
}

function tick() {
    if (!state.isRunning) return;
    const now = Date.now();
    let diff = state.endTime - now;

    if (diff <= 0 && config.overtimeMode === 'stop') {
        const nextTotal = getSecFromInputsHMS(els.nxtH, els.nxtM, els.nxtS);
        if (nextTotal > 0) {
            pauseTimer();
            applyNext(nextTotal);
            lockCurrentInputs(false);
            broadcastState();
            return;
        }
    }

    render(diff);
    state.animationFrameId = requestAnimationFrame(tick);
}

function ringBell() {
    els.soundBell.currentTime = 0;
    els.soundBell.play().catch(e=>{});
}

function render(ms) {
    let totalSec = Math.ceil(ms / 1000);
    let isOvertime = false;
    if (totalSec <= 0) {
        isOvertime = true;
        totalSec = 0; 
    }

    const text = formatTime(totalSec, config.displayFormat);
    
    // ★修正: 内容が変わった時だけDOM更新 (チラつき防止の決定打)
    if (els.display.textContent !== text) {
        els.display.textContent = text;
        if (text.length > 5) els.display.classList.add('long-text');
        else els.display.classList.remove('long-text');
    }

    if (isOvertime) {
        els.display.classList.add('dimmed');
        if (config.overtimeMode === 'countup') {
            els.otContainer.classList.remove('hidden');
            let otMs = Math.abs(ms);
            let otSec = Math.floor(otMs / 1000);
            
            const otText = formatTime(otSec, 'ot');
            if (els.otDisplay.textContent !== otText) {
                els.otDisplay.textContent = otText;
            }
        }
    } else {
        els.display.classList.remove('dimmed');
        els.otContainer.classList.add('hidden');
    }

    let checkSec = isOvertime ? 0 : totalSec;
    applyVisualPhases(checkSec);
}

function broadcastState() {
    if (state.isReceiver) return;
    bc.postMessage({
        isRunning: state.isRunning,
        remainingMs: state.remainingMs,
        endTime: state.endTime,
        config: config,
        currentTheme: state.currentTheme,
        meetingTitle: state.meetingTitle
    });
}

function openReceiverWindow() {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'receiver');
    window.open(url.href, 'ReceiverWindow', 'width=800,height=600,menubar=no,toolbar=no');
}

function formatTime(totalSec, formatMode) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (formatMode === 'ot') return `${pad(Math.floor(totalSec/60))}:${pad(s)}`;
    if (formatMode === 'hms') return `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (formatMode === 'ms_ext') return `${pad(Math.floor(totalSec/60))}:${pad(s)}`;
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
}
function pad(n) { return n.toString().padStart(2, '0'); }

function applyVisualPhases(currentSec) {
    let activeTextPhase = config.textSchedule.reduce((prev, curr) => {
        if (currentSec <= curr.time) {
            if (prev === null || curr.time < prev.time) return curr;
        } return prev;
    }, null);
    
    // 色変更も変更時のみ適用するのがベストだが、CSS変数の場合は負荷が低いのでOK
    els.display.style.color = activeTextPhase ? activeTextPhase.color : '';

    let activeBarPhase = config.barSchedule.reduce((prev, curr) => {
        if (currentSec <= curr.time) {
            if (prev === null || curr.time < prev.time) return curr;
        } return prev;
    }, null);

    if (activeBarPhase) {
        els.bar.style.backgroundColor = activeBarPhase.color || 'transparent';
        els.bar.classList.remove('blink');
        if (activeBarPhase.blink) els.bar.classList.add('blink');
    } else {
        els.bar.style.backgroundColor = 'transparent';
        els.bar.classList.remove('blink');
    }
}

function updateUIState(running) {
    els.btnStart.disabled = running;
    els.btnPause.disabled = !running;
    els.btnSettings.disabled = running;
}

function lockCurrentInputs(locked) {
    [els.curH, els.curM, els.curS].forEach(el => el.disabled = locked);
}

function toggleTheme() {
    state.currentTheme = (state.currentTheme === 'dark') ? 'light' : 'dark';
    applyTheme();
    broadcastState();
}

function applyTheme() {
    if (state.currentTheme === 'light') document.body.setAttribute('data-theme', 'light');
    else document.body.removeAttribute('data-theme');
}

function openSettings() {
    if (state.isRunning) pauseTimer();
    els.errorMsg.classList.add('hidden');
    els.modal.classList.remove('hidden');
    
    for(const radio of els.otRadios) { radio.checked = (radio.value === config.overtimeMode); }
    
    const ts = config.textSchedule;
    setPaletteValue('bg-text-start', ts[0]?.color);
    setPhaseTimeInputsHMS(ts[1], els.textTime1H, els.textTime1M, els.textTime1S);
    setPaletteValue('bg-text-1', ts[1]?.color);
    setPhaseTimeInputsHMS(ts[2], els.textTime2H, els.textTime2M, els.textTime2S);
    setPaletteValue('bg-text-2', ts[2]?.color);
    
    const bs = config.barSchedule;
    setPaletteValue('bg-bar-start', bs[0]?.color);
    els.barBlinkStart.checked = bs[0]?.blink;
    setPhaseTimeInputsHMS(bs[1], els.barTime1H, els.barTime1M, els.barTime1S);
    setPaletteValue('bg-bar-1', bs[1]?.color);
    els.barBlink1.checked = bs[1]?.blink;
    setPhaseTimeInputsHMS(bs[2], els.barTime2H, els.barTime2M, els.barTime2S);
    setPaletteValue('bg-bar-2', bs[2]?.color);
    els.barBlink2.checked = bs[2]?.blink;
}

function closeSettings() { els.modal.classList.add('hidden'); }

function applySettings() {
    let otMode = 'stop';
    for(const radio of els.otRadios) { if(radio.checked) otMode = radio.value; }
    
    const tStartCol = getPaletteValue('bg-text-start');
    const t1Sec = getSecFromInputsHMS(els.textTime1H, els.textTime1M, els.textTime1S);
    const t1Col = getPaletteValue('bg-text-1');
    const t2Sec = getSecFromInputsHMS(els.textTime2H, els.textTime2M, els.textTime2S);
    const t2Col = getPaletteValue('bg-text-2');

    const bStartCol = getPaletteValue('bg-bar-start');
    const bStartBlink = els.barBlinkStart.checked;
    const b1Sec = getSecFromInputsHMS(els.barTime1H, els.barTime1M, els.barTime1S);
    const b1Col = getPaletteValue('bg-bar-1');
    const b1Blink = els.barBlink1.checked;
    const b2Sec = getSecFromInputsHMS(els.barTime2H, els.barTime2M, els.barTime2S);
    const b2Col = getPaletteValue('bg-bar-2');
    const b2Blink = els.barBlink2.checked;

    config.overtimeMode = otMode;
    config.textSchedule = [
        { time: Infinity, color: tStartCol },
        { time: t1Sec, color: t1Col },
        { time: t2Sec, color: t2Col }
    ];
    config.barSchedule = [
        { time: Infinity, color: bStartCol, blink: bStartBlink },
        { time: b1Sec, color: b1Col, blink: b1Blink },
        { time: b2Sec, color: b2Col, blink: b2Blink }
    ];
    
    broadcastState();
    closeSettings();
}

function setPhaseTimeInputsHMS(phaseObj, elH, elM, elS) {
    if (!phaseObj || phaseObj.time === Infinity || phaseObj.time === -1) {
        elH.value = ''; elM.value = ''; elS.value = ''; return;
    }
    const h = Math.floor(phaseObj.time / 3600);
    const rem = phaseObj.time % 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    elH.value = h>0?h:''; elM.value = m; elS.value = s;
}
function getSecFromInputsHMS(elH, elM, elS) {
    const h = parseInt(elH.value || 0, 10);
    const m = parseInt(elM.value || 0, 10);
    const s = parseInt(elS.value || 0, 10);
    if (h===0 && m===0 && s===0) return -1;
    return (h*3600) + (m*60) + s;
}
function renderPalette(id, name) {
    const container = document.getElementById(id);
    if (!container) return;
    COLORS.forEach(c => {
        const lbl = document.createElement('label'); lbl.className = 'color-option';
        const inp = document.createElement('input'); inp.type = 'radio'; inp.name = name; inp.value = c.value;
        const sw = document.createElement('span'); sw.className = `swatch ${c.class}`; sw.title = c.label;
        lbl.append(inp, sw); container.append(lbl);
    });
}
function setPaletteValue(name, val) {
    document.getElementsByName(name).forEach(r => { if(r.value === (val||'')) r.checked = true; });
}
function getPaletteValue(name) {
    for(const r of document.getElementsByName(name)) { if(r.checked) return r.value; } return '';
}
function showError(msg) { els.errorMsg.textContent = msg; els.errorMsg.classList.remove('hidden'); }

init();