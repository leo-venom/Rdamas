// ui.js — render do tabuleiro e elementos visuais
const UI = {
  els: {},
  lastMoveCells: [],

  init() {
    this.els.board = document.getElementById('board');
    this.els.turnBadge = document.getElementById('turnBadge');
    this.els.turnText = this.els.turnBadge?.querySelector('.turn-text');
    this.els.cyanCount = document.getElementById('cyanCount');
    this.els.magentaCount = document.getElementById('magentaCount');
    this.els.winsCount = document.getElementById('winsCount');
    this.els.lostCyan = document.getElementById('lost-cyan');
    this.els.lostMagenta = document.getElementById('lost-magenta');
    this.els.aiThink = document.getElementById('aiThink');
    this.els.achGrid = document.getElementById('achGrid');
    this.els.achUnlocked = document.getElementById('achUnlocked');
    this.els.achTotal = document.getElementById('achTotal');
    this.els.moveList = document.getElementById('moveList');
    this.els.moveCount = document.getElementById('moveCount');
  },

  render() {
    const s = Game.state;
    if (!s) return;
    this._renderBoard(s);
    this._renderInfo(s);
    this._renderCaptured(s);
  },

  _renderBoard(s) {
    const boardEl = this.els.board;
    boardEl.innerHTML = '';
    this.lastMoveCells = [];
    let cyanCount = 0, magentaCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        cell.dataset.r = r; cell.dataset.c = c;
        const piece = s.board[r][c];
        if (piece) {
          if (piece.player === 'cyan') cyanCount++;
          else magentaCount++;
          const p = document.createElement('div');
          p.className = 'piece ' + piece.player;
          if (piece.isKing) p.classList.add('king');
          if (s.selected && s.selected.r === r && s.selected.c === c) p.classList.add('selected');
          cell.appendChild(p);
        }
        // Highlight cells
        const isValid = s.validMoves.some(m => m.to.r === r && m.to.c === c);
        if (isValid) {
          cell.classList.add('highlight');
          if (s.validMoves.find(m => m.to.r === r && m.to.c === c && m.captured)) {
            cell.classList.add('highlight-capture');
          }
        }
        // Last move
        if (s.lastMove) {
          const isFrom = s.lastMove.from.r === r && s.lastMove.from.c === c;
          const isTo = s.lastMove.to.r === r && s.lastMove.to.c === c;
          if (isFrom || isTo) {
            cell.classList.add((r+c)%2 === 0 ? 'last-move-light' : 'last-move-dark');
            this.lastMoveCells.push(cell);
          }
        }
        cell.addEventListener('click', () => this._onCellClick(r, c));
        cell.addEventListener('touchend', (e) => { e.preventDefault(); this._onCellClick(r, c); });
        boardEl.appendChild(cell);
      }
    }
    this.els.cyanCount.textContent = cyanCount;
    this.els.magentaCount.textContent = magentaCount;
  },

  _onCellClick(r, c) {
    Audio.init();
    const s = Game.state;
    if (!s || s.winner) return;
    if (Game.isAiTurn()) return;
    if (s.mustContinue) {
      const res = Game.continueCapture(r, c);
      if (res.type === 'move') this._afterMove(res.move);
      return;
    }
    const res = Game.clickCell(r, c);
    if (res.type === 'move') {
      this._afterMove(res.move);
    } else if (res.type === 'select' || res.type === 'deselect') {
      Audio.play(res.type === 'select' ? 'select' : 'move');
      this.render();
    }
  },

  _afterMove(result) {
    if (!result) return;
    const move = result.move;
    if (!move) return;
    // Animação de captura
    if (move.captured) {
      const capCell = this.els.board.querySelector(`[data-r="${move.captured.r}"][data-c="${move.captured.c}"]`);
      const capPiece = capCell?.querySelector('.piece');
      if (capPiece) {
        capPiece.classList.add('capturing');
        Audio.play('capture');
        setTimeout(() => this._applyAndContinue(result), 480);
        return;
      }
    }
    Audio.play(result.kinged ? 'king' : 'move');
    this._applyAndContinue(result);
  },

  _applyAndContinue(result) {
    const move = result.move;
    if (move && result.kinged) {
      const newPiece = this.els.board.querySelector(`[data-r="${move.to.r}"][data-c="${move.to.c}"] .piece`);
      if (newPiece) {
        setTimeout(() => newPiece.classList.add('kinging'), 50);
        setTimeout(() => newPiece.classList.remove('kinging'), 900);
      }
    }
    this.render();
    this._renderInfo(Game.state);

    // Eventos de conquista
    if (result.events) {
      if (result.events.kinged) Main.onEvent({ type: 'king_created' });
      if (result.events.multiCapture) Main.onEvent({ type: 'multi_capture', count: result.events.multiCapture });
    }
    Main.onEvent({ type: 'move_made', totalMoves: Game.state.moveCount });
    Main.onEvent({ type: 'board_state', board: Game.state.board });

    if (result.mustContinue) {
      Audio.play('select');
      return; // espera próximo click
    }

    // Verifica vencedor
    const winner = Game.checkWinner();
    if (winner) {
      Main.onWin(winner, move);
      return;
    }
    // Próximo turno
    if (Game.isAiTurn()) {
      Main.runAi();
    }
  },

  _renderInfo(s) {
    if (!this.els.turnBadge) return;
    if (s.winner) {
      this.els.turnBadge.className = 'turn-badge ' + (s.winner === 'cyan' ? 'turn-cyan' : 'turn-magenta');
      this.els.turnText.textContent = (s.winner === 'cyan' ? 'Você venceu!' : 'IA venceu') + ' 🏆';
      this.els.aiThink.classList.add('hidden');
      return;
    }
    if (s.turn === 'cyan') {
      this.els.turnBadge.className = 'turn-badge turn-cyan';
      this.els.turnText.textContent = s.mustContinue ? 'Continue capturando (Cyan)' : 'Sua vez (Cyan)';
    } else {
      this.els.turnBadge.className = 'turn-badge turn-magenta';
      this.els.turnText.textContent = s.mode === 'ai' ? 'Vez da IA (Mag)' : 'Vez do Magenta';
    }
  },

  _renderCaptured(s) {
    if (!this.els.lostCyan) return;
    // Peças capturadas: peças do opponent que sumiram
    const initial = { cyan: 12, magenta: 12 };
    const nowCyan = Game.countPieces('cyan');
    const nowMag = Game.countPieces('magenta');
    const lostCyan = initial.cyan - nowCyan; // peças cyan perdidas
    const lostMag = initial.magenta - nowMag;
    this.els.lostCyan.innerHTML = '<span class="captured-label">Perdidas:</span>' +
      Array(lostCyan).fill(0).map(() => '<div class="mini-piece cyan"></div>').join('');
    this.els.lostMagenta.innerHTML = '<span class="captured-label">Perdidas pela IA:</span>' +
      Array(lostMag).fill(0).map(() => '<div class="mini-piece magenta"></div>').join('');
  },

  renderAchievements(state) {
    if (!this.els.achGrid) return;
    this.els.achGrid.innerHTML = '';
    let unlocked = 0;
    Achievements.list.forEach(a => {
      const isUnlocked = state.achievements.includes(a.id);
      if (isUnlocked) unlocked++;
      const el = document.createElement('div');
      el.className = 'ach' + (isUnlocked ? ' unlocked' : '');
      el.innerHTML = `<span class="ach-emoji">${a.emoji}</span><span class="ach-name">${a.name}</span><span class="ach-desc">${a.desc}</span>`;
      el.title = isUnlocked ? '✓ Desbloqueada' : '🔒 Bloqueada';
      this.els.achGrid.appendChild(el);
    });
    this.els.achUnlocked.textContent = unlocked;
    this.els.achTotal.textContent = Achievements.list.length;
  },

  renderHistory(s) {
    if (!this.els.moveList) return;
    this.els.moveCount.textContent = `(${s.moveCount})`;
    // We could track moves in detail, but for now just count
    this.els.moveList.innerHTML = Array.from({ length: s.moveCount }, (_, i) =>
      `<li><span class="move-num">${i + 1}.</span>${i % 2 === 0 ? 'Cyan' : 'Mag'}</li>`
    ).reverse().join('');
  },

  showToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show';
    if (type) t.style.background = type === 'win' ? 'linear-gradient(135deg, rgba(0, 255, 170, 0.95), rgba(0, 180, 216, 0.9))' : 'linear-gradient(135deg, rgba(255, 0, 127, 0.95), rgba(196, 24, 91, 0.9))';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 3000);
  }
};

window.UI = UI;
