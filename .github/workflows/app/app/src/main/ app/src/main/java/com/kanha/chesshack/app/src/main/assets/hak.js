// ==UserScript==
// @name         Chess.com Pro Stockfish Overlay v12.5 (Full Code)
// @namespace    http://tampermonkey.net/
// @version      12.5
// @description  Dynamic Clock + MultiPV 3 + ELO Slider + Full Code
// @author       KANHA#2003
// @match        *://*.chess.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';
    if (document.getElementById('dot-pill')) return;

    const SF_BASE = 'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/';
    const SF_JS   = SF_BASE + 'stockfish-nnue-16-single.js';
    const SF_WASM = SF_BASE + 'stockfish-nnue-16-single.wasm';
    const SF_FALLBACK = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';

    // ============ UI Pill ============
    const pill = document.createElement('div');
    pill.id = 'dot-pill';
    pill.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(17,17,17,0.95); color: white; padding: 8px 14px; border-radius: 12px;
        z-index: 100000; font-family: Arial, sans-serif;
        box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; gap: 6px;
        border: 1px solid #333; user-select: none; min-width: 260px;`;
    pill.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; justify-content:space-between;">
            <button id="dot-play-btn" style="background:none;border:none;color:#4CAF50;cursor:pointer;font-size:20px;font-weight:bold;">▶</button>
            <div id="dot-info" style="font-family:monospace;font-size:12px;color:#4CAF50;text-align:center;flex:1;font-weight:bold;">—</div>
            <button id="dot-menu-btn" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">☰</button>
            <button id="dot-close-btn" style="background:none;border:none;color:#ff5252;cursor:pointer;font-size:20px;">✕</button>
        </div>
        <div id="dot-lines" style="display:flex; flex-direction:column; gap:4px; font-family:monospace; font-size:11px; color:#aaa; background:rgba(0,0,0,0.3); padding:6px; border-radius:6px;"></div>
    `;
    document.body.appendChild(pill);

    let isDragging = false, startX, startY, dragStartTop, dragStartLeft;
    pill.addEventListener('pointerdown', e => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        isDragging = true;
        const r = pill.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        dragStartTop = r.top; dragStartLeft = r.left;
    });
    document.addEventListener('pointermove', e => {
        if (!isDragging) return;
        pill.style.left = (dragStartLeft + e.clientX - startX) + 'px';
        pill.style.top = (dragStartTop + e.clientY - startY) + 'px';
        pill.style.transform = 'none';
    });
    document.addEventListener('pointerup', () => { isDragging = false; });

    // ============ Modal ============
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: #1e1e1e; color: white; padding: 18px; border-radius: 12px;
        z-index: 100001; width: 300px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
        border: 1px solid #333; display: none; font-size: 13px; font-family: sans-serif;`;
    modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
            <h3 style="margin:0;font-size:16px;color:#4CAF50;">Settings</h3>
            <button id="dot-modal-close" style="background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:5px;">My Color</label>
            <select id="dot-color" style="width:100%;padding:7px;background:#111;color:white;border:1px solid #333;border-radius:6px;">
                <option value="w">White</option>
                <option value="b">Black</option>
            </select>
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:5px;">Engine Strength: <span id="elo-val">Max</span></label>
            <input type="range" id="dot-elo" min="1200" max="3200" step="100" value="3200" style="width:100%;accent-color:#4CAF50;">
        </div>
        <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:5px;">Time Reserve (sec): <span id="reserve-val">15</span></label>
            <input type="range" id="dot-reserve" min="5" max="60" step="5" value="15" style="width:100%;accent-color:#4CAF50;">
            <div style="font-size:10px;color:#777;margin-top:2px;">Kept for emergencies (Dynamic Clock)</div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span>Show Arrows</span>
            <input type="checkbox" id="dot-show-arrows" checked style="accent-color:#4CAF50;transform:scale(1.2);">
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span>Auto-Play Moves</span>
            <input type="checkbox" id="dot-autoplay" style="accent-color:#4CAF50;transform:scale(1.2);">
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
            <span>توقع أفضل نقلة للخصم</span>
            <input type="checkbox" id="dot-opp-best" checked style="accent-color:#4CAF50;transform:scale(1.2);">
        </div>
        <div id="dot-status" style="font-size:11px;color:#888;text-align:center;margin-top:10px;padding-top:10px;border-top:1px solid #333;">Engine: Loading...</div>
        <div id="dot-debug" style="font-size:9px;color:#aaa;font-family:monospace;margin-top:8px;max-height:60px;overflow:hidden;background:#000;padding:5px;border-radius:4px;display:none;"></div>
    `;
    document.body.appendChild(modal);

    const toast = document.createElement('div');
    toast.id = 'dot-toast';
    toast.style.cssText = `
        position: fixed; top: 200px; left: 50%; transform: translateX(-50%);
        padding: 10px 20px; border-radius: 8px; z-index: 100002;
        font-family: Arial, sans-serif; font-size: 18px; font-weight: bold;
        display: none; text-shadow: 0 2px 4px rgba(0,0,0,0.8); pointer-events: none;`;
    document.body.appendChild(toast);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    function resizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
    addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ============ State ============
    let stockfish = null, engineReady = false, engineLoaded = false;
    let analyzing = false, searching = false, searchFen = '';
    let activeSearchFen = '';
    let multiPV = [null, null, null];
    let currentBestMove = null, currentDepth = 0, currentScore = null;
    let lastAutoPlayFen = '', autoPlayEnabled = false, autoPlayLock = false;
    let prevEval = null, myLastMoveFen = '';
    let lastSearchDepth = 0;
    let avgDepthRecent = [];

    function dbg(msg) {
        const d = document.getElementById('dot-debug');
        if (!d) return;
        d.style.display = 'block';
        const lines = d.innerText.split('\n').filter(x => x.trim() !== '');
        lines.push(msg);
        if (lines.length > 3) lines.shift();
        d.innerText = lines.join('\n');
    }

    // ============ Clock Parsing ============
    function getMyClockSeconds() {
        try {
            const myColor = document.getElementById('dot-color').value;
            // يبحث عن الساعة في واجهة chess.com
            const selector = myColor === 'w' ? '.clock-white' : '.clock-black';
            const clockEl = document.querySelector(selector + ' .clock-time-monospace, ' + selector + ' .clock-time, ' + selector + ' .move-time-content');
            if (!clockEl) return null;
            
            const text = clockEl.textContent.trim();
            const parts = text.split(':');
            let seconds = 0;
            if (parts.length === 3) seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
            else if (parts.length === 2) seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            else seconds = parseFloat(text);
            
            return isNaN(seconds) ? null : seconds;
        } catch (e) { return null; }
    }

    // ============ Engine Settings (ELO) ============
    function applyEngineSettings() {
        if (!stockfish) return;
        const elo = parseInt(document.getElementById('dot-elo').value);
        if (elo >= 3200) {
            stockfish.postMessage('setoption name UCI_LimitStrength value false');
            stockfish.postMessage('setoption name Skill Level value 20');
        } else {
            if (engineLoaded && document.getElementById('dot-status').innerText.includes('SF16')) {
                stockfish.postMessage('setoption name UCI_LimitStrength value true');
                stockfish.postMessage('setoption name UCI_Elo value ' + Math.max(1320, elo));
            } else {
                // SF10 fallback
                stockfish.postMessage('setoption name UCI_LimitStrength value false');
                const skill = Math.round((elo - 1200) / 100);
                stockfish.postMessage('setoption name Skill Level value ' + Math.min(20, Math.max(0, skill)));
            }
        }
    }

    // ============ Engine Init ============
    function initStockfish() {
        try {
            const workerCode = `
                self.Module = { locateFile: function(p) { if (p && p.indexOf('.wasm') !== -1) return ${JSON.stringify(SF_WASM)}; return p; } };
                importScripts(${JSON.stringify(SF_JS)});
            `;
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            stockfish = new Worker(URL.createObjectURL(blob));
            
            stockfish.onmessage = e => {
                const line = typeof e.data === 'string' ? e.data : (e.data && e.data.data) || '';
                if (!line) return;
                if (line === 'uciok') {
                    stockfish.postMessage('setoption name Hash value 128');
                    stockfish.postMessage('setoption name MultiPV value 3'); // 3 نقلات
                    applyEngineSettings();
                    stockfish.postMessage('isready');
                } else if (line === 'readyok') {
                    engineReady = true; engineLoaded = true;
                    document.getElementById('dot-status').innerText = 'Engine: SF16 Ready ✓';
                    dbg('SF16 ready');
                    if (analyzing) runAnalysis();
                } else if (line.startsWith('info') && line.indexOf(' score ') !== -1) {
                    handleInfo(line);
                } else if (line.startsWith('bestmove')) {
                    handleBestMove(line);
                }
            };
            stockfish.onerror = err => { dbg('SF16 ERR: ' + err.message); };
            stockfish.postMessage('uci');
            
            setTimeout(() => {
                if (!engineLoaded) {
                    dbg('SF16 timeout -> SF10');
                    try { stockfish.terminate(); } catch (e) {}
                    initLegacy();
                }
            }, 15000);
        } catch (err) { initLegacy(); }
    }

    function initLegacy() {
        try {
            const blob = new Blob([`importScripts('${SF_FALLBACK}');`], { type: 'application/javascript' });
            stockfish = new Worker(URL.createObjectURL(blob));
            
            stockfish.onmessage = e => {
                const line = typeof e.data === 'string' ? e.data : (e.data && e.data.data) || '';
                if (!line) return;
                if (line === 'uciok') {
                    stockfish.postMessage('setoption name Hash value 32');
                    stockfish.postMessage('setoption name MultiPV value 3');
                    applyEngineSettings();
                    stockfish.postMessage('isready');
                } else if (line === 'readyok') {
                    engineReady = true; engineLoaded = true;
                    document.getElementById('dot-status').innerText = 'Engine: SF10 (Fallback)';
                    dbg('SF10 ready');
                    if (analyzing) runAnalysis();
                } else if (line.startsWith('info') && line.indexOf(' score ') !== -1) {
                    handleInfo(line);
                } else if (line.startsWith('bestmove')) {
                    handleBestMove(line);
                }
            };
            stockfish.onerror = err => { dbg('SF10 ERR: ' + err.message); };
            stockfish.postMessage('uci');
        } catch (e) {
            document.getElementById('dot-status').innerText = 'Engine failed';
            dbg('initLegacy fail');
        }
    }

    initStockfish();

    function handleInfo(line) {
        if (getCleanFEN() !== activeSearchFen) return;

        const mpvMatch = line.match(/multipv (\d+)/);
        const mpvIdx = mpvMatch ? parseInt(mpvMatch[1]) - 1 : 0;
        if (mpvIdx < 0 || mpvIdx > 2) return;
        
        const dm = line.match(/depth (\d+)/);
        if (dm && mpvIdx === 0) {
            currentDepth = parseInt(dm[1]);
            lastSearchDepth = currentDepth;
        }
        
        let score = null;
        const cm = line.match(/score cp (-?\d+)/);
        if (cm) score = parseInt(cm[1]) / 100;
        const mm = line.match(/score mate (-?\d+)/);
        if (mm) score = 'M' + parseInt(mm[1]);
        
        const pm = line.match(/ pv (\S+)/);
        const move = pm ? pm[1] : null;
        
        if (score !== null && move) {
            multiPV[mpvIdx] = { score, move, depth: currentDepth };
            if (mpvIdx === 0) {
                currentScore = score;
                currentBestMove = move;
            }
            updateInfo();
            drawAll();
        }
    }

    function handleBestMove(line) {
        searching = false;
        const m = line.match(/bestmove\s+(\S+)/);
        if (!m || !m[1] || m[1] === '(none)' || m[1] === '0000') return;

        const currentFen = getCleanFEN();
        if (currentFen !== activeSearchFen) return;

        if (analyzing && autoPlayEnabled && document.getElementById('dot-color').value === getTurn()) {
            tryAutoPlay(m[1]);
        }
    }

    // ============ Board / FEN ============
    function getBoard() { return document.querySelector('wc-chess-board'); }
    function getTurn() {
        const moves = document.querySelectorAll('.node.main-line').length;
        return moves % 2 === 0 ? 'w' : 'b';
    }

    function getCleanFEN() {
        try {
            const board = getBoard();
            if (!board) return null;
            const pieces = board.querySelectorAll('.piece');
            if (!pieces.length) return null;

            const grid = Array(8).fill(null).map(() => Array(8).fill(''));
            pieces.forEach(p => {
                const cls = Array.from(p.classList);
                const sqCls = cls.find(c => c.startsWith('square-'));
                if (!sqCls) return;
                const sq = sqCls.replace('square-', '');
                const file = parseInt(sq[0]) - 1;
                const rank = parseInt(sq[1]) - 1;
                const pCls = cls.find(c => c.length === 2 && (c.startsWith('w') || c.startsWith('b')));
                if (!pCls) return;
                const ch = pCls[0] === 'w' ? pCls[1].toUpperCase() : pCls[1];
                if (file >= 0 && file < 8 && rank >= 0 && rank < 8) grid[7 - rank][file] = ch;
            });

            let rows = [];
            for (let r = 0; r < 8; r++) {
                let empty = 0, s = '';
                for (let f = 0; f < 8; f++) {
                    const pc = grid[r][f];
                    if (pc === '') empty++;
                    else { if (empty) { s += empty; empty = 0; } s += pc; }
                }
                if (empty) s += empty;
                rows.push(s);
            }

            const at = (f, r) => grid[8 - r][f] || '';
            let castling = '';
            if (at(4, 1) === 'K') { if (at(7, 1) === 'R') castling += 'K'; if (at(0, 1) === 'R') castling += 'Q'; }
            if (at(4, 8) === 'k') { if (at(7, 8) === 'r') castling += 'k'; if (at(0, 8) === 'r') castling += 'q'; }
            if (!castling) castling = '-';

            const mc = Math.floor(document.querySelectorAll('.node.main-line').length / 2) + 1;
            return rows.join('/') + ' ' + getTurn() + ' ' + castling + ' - 0 ' + mc;
        } catch (err) { return null; }
    }

    function isFlipped(board) {
        return board.classList.contains('flipped') || board.getAttribute('flipped') === 'true';
    }

    // ============ Drawing ============
    function getArrowCoords(move) {
        const board = getBoard();
        if (!board) return null;
        const rect = board.getBoundingClientRect();
        const sq = rect.width / 8;
        const flip = isFlipped(board);
        const from = move.substring(0, 2), to = move.substring(2, 4);
        const coords = (s) => {
            const f = s.charCodeAt(0) - 97;
            const r = parseInt(s[1]) - 1;
            const x = flip ? (7 - f) : f;
            const y = flip ? r : (7 - r);
            return { x: rect.left + x * sq + sq / 2, y: rect.top + y * sq + sq / 2 };
        };
        return { a: coords(from), b: coords(to), sq };
    }

    function drawOneArrow(move, color, opacity) {
        const c = getArrowCoords(move);
        if (!c) return;
        const ang = Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x);
        const headLen = c.sq * 0.45, tailWidth = c.sq * 0.2;
        const bx = c.b.x - headLen * Math.cos(ang);
        const by = c.b.y - headLen * Math.sin(ang);
        ctx.save();
        ctx.globalAlpha = opacity || 1;
        ctx.beginPath(); ctx.moveTo(c.a.x, c.a.y); ctx.lineTo(bx, by);
        ctx.strokeStyle = color; ctx.lineWidth = tailWidth; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.b.x, c.b.y);
        ctx.lineTo(bx - (headLen * 0.5) * Math.sin(ang), by + (headLen * 0.5) * Math.cos(ang));
        ctx.lineTo(bx + (headLen * 0.5) * Math.sin(ang), by - (headLen * 0.5) * Math.cos(ang));
        ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
    }

    function scoreToColor(score) {
        if (typeof score === 'number') {
            if (score >= 1) return 'rgba(0,220,100,0.95)';
            if (score <= -1) return 'rgba(255,60,60,0.95)';
        } else if (typeof score === 'string' && score.startsWith('M')) {
            return score.startsWith('M-') ? 'rgba(255,60,60,0.95)' : 'rgba(0,220,100,0.95)';
        }
        return 'rgba(0,160,255,0.9)';
    }

    function drawAll() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!document.getElementById('dot-show-arrows').checked) return;
        const myColor = document.getElementById('dot-color').value;
        const turn = getTurn();

        if (multiPV[0] && turn === myColor) {
            drawOneArrow(multiPV[0].move, scoreToColor(multiPV[0].score), 1);
            if (multiPV[1]) drawOneArrow(multiPV[1].move, 'rgba(0,160,255,0.5)', 0.5);
            if (multiPV[2]) drawOneArrow(multiPV[2].move, 'rgba(0,160,255,0.3)', 0.3);
        } else if (multiPV[0] && turn !== myColor && document.getElementById('dot-opp-best').checked) {
            drawOneArrow(multiPV[0].move, 'rgba(255,180,0,0.85)', 1); // Opponent best
        }
    }

    function updateInfo() {
        const el = document.getElementById('dot-info');
        const lines = document.getElementById('dot-lines');
        if (!el || !lines) return;
        let s = '';
        if (currentScore !== null) {
            if (typeof currentScore === 'number') s = (currentScore >= 0 ? '+' : '') + currentScore.toFixed(2);
            else s = currentScore;
        }
        const turn = getTurn();
        const tag = turn === document.getElementById('dot-color').value ? '' : '[OPP] ';
        
        const clockSec = getMyClockSeconds();
        const clockStr = clockSec !== null ? ` (${Math.round(clockSec)}s)` : '';

        el.textContent = tag + (currentDepth ? currentDepth + 'd ' : '') + (s || '?') + clockStr;
        
        let html = '';
        for (let i = 0; i < 3; i++) {
            const pv = multiPV[i];
            if (pv && pv.move) {
                const sc = typeof pv.score === 'number' ? (pv.score >= 0 ? '+' : '') + pv.score.toFixed(2) : pv.score;
                html += `<div style="display:flex; justify-content:space-between;"><span>${i+1}. ${pv.move}</span><span>${sc}</span></div>`;
            }
        }
        lines.innerHTML = html;
    }

    // ============ Move Classification ============
    function classifyMove(prevScore, currScore) {
        if (typeof prevScore === 'number' && typeof currScore === 'number') {
            const diff = currScore - prevScore;
            const d = diff * 100;
            if (d >= 150) return { label: 'Brilliant!!', color: '#00e5ff', bg: 'rgba(0,229,255,0.15)' };
            if (d >= 50)  return { label: 'Great!',      color: '#4CAF50', bg: 'rgba(76,175,80,0.15)' };
            if (d >= -30) return { label: 'Good',        color: '#9e9e9e', bg: 'rgba(158,158,158,0.15)' };
            if (d >= -80) return { label: 'Inaccuracy',  color: '#ff9800', bg: 'rgba(255,152,0,0.15)' };
            if (d >= -200) return { label: 'Mistake',    color: '#ff5722', bg: 'rgba(255,87,34,0.15)' };
            return { label: 'Blunder??', color: '#f44336', bg: 'rgba(244,67,54,0.15)' };
        }
        return null;
    }

    function showToast(text, color, bg) {
        toast.textContent = text;
        toast.style.color = color;
        toast.style.background = bg;
        toast.style.border = '1px solid ' + color;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }

    // ============ Dynamic Clock Calculation ============
    function calculateThinkTime() {
        const remainingSec = getMyClockSeconds();
        const reserve = parseInt(document.getElementById('dot-reserve').value);
        const pieceCount = document.querySelectorAll('.piece').length;
        const moveCount = Math.floor(document.querySelectorAll('.node.main-line').length / 2);

        // إذا ما قدرنا نقرأ الساعة (مثلاً ضد بوت بدون وقت)، نرجع للوقت الذكي
        if (remainingSec === null || remainingSec <= 0) {
            if (moveCount < 10) return 1500;
            if (pieceCount < 12) return 8000;
            if (typeof currentScore === 'number' && Math.abs(currentScore) < 1.5) return 10000;
            return 4000;
        }

        // Panic Mode: الوقت ضيق جداً
        if (remainingSec <= reserve + 10) return Math.min(1500, remainingSec * 100);

        const usableTime = remainingSec - reserve;
        const phase = pieceCount < 10 ? 'endgame' : (moveCount < 10 ? 'opening' : 'middlegame');
        const movesLeft = phase === 'opening' ? 28 : phase === 'middlegame' ? 18 : 12;
        
        let timePerMove = (usableTime / movesLeft) * 1000;

        // زيادة الوقت إذا كانت الوضعية حرجة
        if (typeof currentScore === 'number' && Math.abs(currentScore) < 1.5) {
            timePerMove *= 1.5;
        }

        // عدم استهلاك أكثر من 30% من الوقت المتبقي في نقلة واحدة
        const maxCap = remainingSec * 0.3 * 1000; 
        return Math.min(timePerMove, maxCap);
    }

    function runAnalysis() {
        if (!stockfish || !engineReady || !analyzing) return;
        const fen = getCleanFEN();
        if (!fen) return;
        if (fen === searchFen && searching) return;

        if (fen !== searchFen) {
            multiPV = [null, null, null];
            currentBestMove = null;
            searchFen = fen;
            activeSearchFen = fen;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (myLastMoveFen !== '' && prevEval !== null && currentScore !== null) {
                const cls = classifyMove(prevEval, currentScore);
                if (cls) showToast(cls.label, cls.color, cls.bg);
                if (lastSearchDepth > 0) {
                    avgDepthRecent.push(lastSearchDepth);
                    if (avgDepthRecent.length > 5) avgDepthRecent.shift();
                }
                myLastMoveFen = '';
                prevEval = null;
            }

            if (searching) stockfish.postMessage('stop');

            setTimeout(() => {
                if (!stockfish || !analyzing || searchFen !== fen) return;
                
                stockfish.postMessage('position fen ' + fen);
                const timeLimit = Math.max(500, Math.floor(calculateThinkTime()));
                dbg('think: ' + (timeLimit / 1000).toFixed(1) + 's');
                stockfish.postMessage('go movetime ' + timeLimit);
                searching = true;
            }, 80);
        }
    }

    // ============ Auto-play ============
    function tryAutoPlay(move) {
        if (!autoPlayEnabled || autoPlayLock) return;
        if (!move || move === '(none)' || move === '0000') return;
        const fenNow = getCleanFEN();
        if (!fenNow || fenNow === lastAutoPlayFen) return;
        if (fenNow.split(' ')[1] !== document.getElementById('dot-color').value) return;

        autoPlayLock = true;
        lastAutoPlayFen = fenNow;
        const fenAtStart = fenNow;
        
        setTimeout(() => {
            if (getCleanFEN() !== fenAtStart) { autoPlayLock = false; return; }
            prevEval = currentScore;
            myLastMoveFen = fenAtStart;
            try { playMove(move); } catch (e) { console.error(e); }
            setTimeout(() => { autoPlayLock = false; }, 1500);
        }, 300);
    }

    function fireTouch(el, type, x, y) {
        try {
            const touchObj = new Touch({ identifier: Date.now(), target: el, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y });
            el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, view: window, touches: type === 'touchend' ? [] : [touchObj], targetTouches: type === 'touchend' ? [] : [touchObj], changedTouches: [touchObj] }));
        } catch (e) {}
    }

    function clickSquare(sq) {
        const board = getBoard();
        if (!board) return;
        const rect = board.getBoundingClientRect();
        const flip = isFlipped(board);
        const f = sq.charCodeAt(0) - 97;
        const r = parseInt(sq[1]) - 1;
        const x = flip ? (7 - f) : f;
        const y = flip ? r : (7 - r);
        const px = rect.left + (x + 0.5) * rect.width / 8;
        const py = rect.top + (y + 0.5) * rect.height / 8;
        const el = document.elementFromPoint(px, py);
        if (!el) return;

        const base = { bubbles: true, cancelable: true, view: window, clientX: px, clientY: py, screenX: px, screenY: py, button: 0 };
        try {
            el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: 1 }));
            el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
        } catch (e) {}
        fireTouch(el, 'touchstart', px, py);

        setTimeout(() => {
            try {
                el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: 0 }));
                el.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
                el.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
            } catch (e) {}
            fireTouch(el, 'touchend', px, py);
        }, 40);
    }

    function playMove(move) {
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const promo = move.length > 4 ? move[4] : null;
        clickSquare(from);
        setTimeout(() => {
            clickSquare(to);
            if (promo) setTimeout(() => selectPromotion(promo), 350);
        }, 140);
    }

    function selectPromotion(promo) {
        const map = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
        const name = map[promo.toLowerCase()];
        if (!name) return;
        const c = [
            document.querySelector('.promotion-window .promotion-piece.' + name),
            document.querySelector('.promotion-piece[class*="' + name + '"]'),
        ];
        for (const el of c) if (el) { el.click(); return; }
    }

    // ============ Buttons ============
    const playBtn = document.getElementById('dot-play-btn');
    playBtn.addEventListener('click', () => {
        analyzing = !analyzing;
        playBtn.innerText = analyzing ? '❚❚' : '▶';
        playBtn.style.color = analyzing ? '#ff5252' : '#4CAF50';
        if (analyzing) {
            searchFen = '';
            runAnalysis();
        } else {
            if (stockfish) stockfish.postMessage('stop');
            searching = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            multiPV = [null, null, null];
            updateInfo();
        }
    });

    document.getElementById('dot-menu-btn').addEventListener('click', () => {
        modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    });
    document.getElementById('dot-modal-close').addEventListener('click', () => { modal.style.display = 'none'; });
    document.getElementById('dot-close-btn').addEventListener('click', () => {
        analyzing = false;
        if (stockfish) stockfish.postMessage('stop');
        if (stockfish) stockfish.terminate();
        pill.remove(); modal.remove(); canvas.remove(); toast.remove();
    });

    document.getElementById('dot-elo').addEventListener('input', e => {
        document.getElementById('elo-val').innerText = e.target.value >= 3200 ? 'Max' : e.target.value;
        applyEngineSettings();
    });

    document.getElementById('dot-reserve').addEventListener('input', e => {
        document.getElementById('reserve-val').innerText = e.target.value;
    });
    
    document.getElementById('dot-autoplay').addEventListener('change', e => {
        autoPlayEnabled = e.target.checked;
        if (!autoPlayEnabled) lastAutoPlayFen = '';
    });

    setInterval(() => { if (analyzing) runAnalysis(); }, 250);

})();
