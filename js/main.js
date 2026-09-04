// main.js — cola tudo: estado global, eventos, IA loop, modais
const Main = {
  storage: null,

  init() {
    this.storage = Storage.load();
    Audio.enabled = this.storage.sound;

    Game.newGame({ mode: this.storage.mode, difficulty: this.storage.difficulty });
    UI.init();
    UI.render();
    UI.renderAchievements(this.storage);
    UI.renderHistory(Game.state);
    this._updateWins();

    document.getElementById('mode').value = this.storage.mode;
    document.getElementById('difficulty').value = this.storage.difficulty;
    this._toggleDifficulty();

    this._bindEvents();
    this._registerServiceWorker();
  },

  _bindEvents() {
    document.getElementById('mode').addEventListener('change', (e) => {
      Game.state.mode = e.target.value;
      this.storage.mode = e.target.value;
      Storage.save(this.storage);
      this._toggleDifficulty();
      this.reset();
    });
    document.getElementById('difficulty').addEventListener('change', (e) => {
      Game.state.difficulty = e.target.value;
      this.storage.difficulty = e.target.value;
      Storage.save(this.storage);
    });
    document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.redo());
    document.getElementById('btn-sound').addEventListener('click', () => this.toggleSound());
    document.getElementById('btn-info').addEventListener('click', () => this._showModal('modalRules'));
    document.getElementById('btn-close-rules').addEventListener('click', () => this._hideModal('modalRules'));
    document.getElementById('btn-win-again').addEventListener('click', () => { this._hideModal('modalWin'); this.reset(); });
    document.getElementById('btn-win-share').addEventListener('click', () => this._shareResult());

    // Teclado
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); }
      else if (k === 'z' && !e.ctrlKey && !e.metaKey) { this.undo(); }
      else if (k === 'y') this.redo();
      else if (k === 'n') this.reset();
      else if (k === 'm') {
        const sel = document.getElementById('mode');
        sel.value = sel.value === 'ai' ? 'local' : 'ai';
        sel.dispatchEvent(new Event('change'));
      }
    });
  },

  _toggleDifficulty() {
    const wrap = document.getElementById('difficulty-wrap');
    wrap.style.display = Game.state.mode === 'ai' ? 'flex' : 'none';
  },

  reset() {
    Game.newGame({ mode: Game.state.mode, difficulty: Game.state.difficulty });
    UI.render();
    UI.renderHistory(Game.state);
    Audio.play('move');
  },

  undo() {
    if (Game.isAiTurn()) return;
    if (Game.undo()) {
      UI.render();
      UI.renderHistory(Game.state);
      Audio.play('move');
    }
  },

  redo() {
    if (Game.isAiTurn()) return;
    if (Game.redo()) {
      UI.render();
      UI.renderHistory(Game.state);
      Audio.play('move');
    }
  },

  toggleSound() {
    const on = Audio.toggle();
    this.storage.sound = on;
    Storage.save(this.storage);
    const btn = document.getElementById('btn-sound');
    if (on) btn.classList.remove('muted'); else btn.classList.add('muted');
    UI.showToast(on ? '🔊 Som ligado' : '🔇 Som mudo');
  },

  _updateWins() {
    document.getElementById('winsCount').textContent = this.storage.wins;
  },

  // Eventos de conquista
  onEvent(ctx) {
    const newOnes = Achievements.check(this.storage, ctx);
    if (newOnes.length > 0) {
      newOnes.forEach(a => {
        Audio.play('achievement');
        UI.showToast(`🏅 ${a.name}!`, 'win');
      });
      Storage.save(this.storage);
      UI.renderAchievements(this.storage);
    }
  },

  // Vitória
  onWin(winner, lastMove) {
    const s = Game.state;
    s.winner = winner;
    const isCyan = winner === 'cyan';
    const isAi = s.mode === 'ai';
    const cyanCount = Game.countPieces('cyan');
    const magCount = Game.countPieces('magenta');

    if (isCyan) {
      this.storage.wins++;
      Audio.play('win');
    } else if (isAi) {
      this.storage.losses++;
      Audio.play('lose');
    } else {
      this.storage.draws++;
    }
    Storage.save(this.storage);
    this._updateWins();

    UI.render();
    UI.renderHistory(s);

    // Verifica conquistas
    this.onEvent({ type: 'win', difficulty: s.difficulty, capturedPieces: 12 - magCount });

    setTimeout(() => {
      const modal = document.getElementById('modalWin');
      const emoji = document.getElementById('winEmoji');
      const title = document.getElementById('winTitle');
      const sub = document.getElementById('winSubtitle');
      const stats = document.getElementById('winStats');
      emoji.textContent = isCyan ? '🏆' : (isAi ? '🤖' : '🎯');
      title.textContent = isCyan ? 'Você venceu!' : (isAi ? 'A IA venceu' : `${winner} venceu`);
      sub.textContent = isCyan
        ? `Parabéns! Vitória no ${s.difficulty}.`
        : (isAi ? 'Tente novamente, talvez no fácil primeiro.' : `Partida local — ${winner} ganhou.`);
      stats.innerHTML = `
        <div class="stat">Jogadas<strong>${s.moveCount}</strong></div>
        <div class="stat">Cyan<strong>${cyanCount}</strong></div>
        <div class="stat">Mag<strong>${magCount}</strong></div>
      `;
      modal.classList.remove('hidden');
    }, 400);
  },

  runAi() {
    if (Game.state.winner) return;
    UI.els.aiThink.classList.remove('hidden');
    setTimeout(() => {
      const move = AI.chooseMove(Game.state.board, Game.state.turn, Game.state.difficulty);
      UI.els.aiThink.classList.add('hidden');
      if (!move) {
        // Sem movimentos = IA perdeu
        Game.state.winner = 'cyan';
        Main.onWin('cyan', null);
        return;
      }
      // Aplica o movimento (path inteiro se multi-capture)
      if (move.path && move.path.length > 1) {
        // Multi-capture: aplica cada passo
        this._applyAiMultiPath(move);
      } else {
        const result = Game._executeMove(move);
        result.move = move;
        UI._afterMove(result);
      }
    }, 600);
  },

  _applyAiMultiPath(move) {
    // Executa cada passo do path com delay
    let i = 0;
    const steps = move.path;
    const captured = move.captured;
    const next = () => {
      if (i >= steps.length) {
        // Final
        const winner = Game.checkWinner();
        if (winner) { Main.onWin(winner, move); return; }
        if (Game.isAiTurn()) Main.runAi();
        return;
      }
      const step = steps[i];
      // Reconstrói o move com capture info
      const stepMove = {
        from: step.from,
        to: step.to,
        captured: i === steps.length - 1 ? captured : { r: (step.from.r + step.to.r) / 2, c: (step.from.c + step.to.c) / 2 },
        kingAfter: move.kingAfter && i === steps.length - 1,
        path: [step],
      };
      const result = Game._executeMove(stepMove);
      result.move = stepMove;
      // Animação
      if (stepMove.captured) {
        const capCell = UI.els.board.querySelector(`[data-r="${stepMove.captured.r}"][data-c="${stepMove.captured.c}"]`);
        const capPiece = capCell?.querySelector('.piece');
        if (capPiece) {
          capPiece.classList.add('capturing');
          Audio.play('capture');
        }
      } else {
        Audio.play('move');
      }
      setTimeout(() => {
        UI.render();
        i++;
        if (result.mustContinue && i < steps.length) {
          // continua
        }
        setTimeout(next, 250);
      }, 350);
    };
    next();
  },

  _shareResult() {
    const s = Game.state;
    const text = `🎮 RDAMAS — ${s.winner === 'cyan' ? 'Vitória!' : 'Derrota'} | ${Game.countPieces('cyan')}×${Game.countPieces('magenta')} | Modo: ${s.mode} | rdamas.onrender.com`;
    if (navigator.share) {
      navigator.share({ title: 'RDAMAS', text, url: 'https://rdamas.onrender.com' }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => UI.showToast('📋 Resultado copiado!')).catch(() => UI.showToast('Não foi possível compartilhar'));
    }
  },

  _showModal(id) { document.getElementById(id).classList.remove('hidden'); },
  _hideModal(id) { document.getElementById(id).classList.add('hidden'); },

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    // Install prompt
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      const btn = document.getElementById('btn-install');
      btn.classList.remove('hidden');
      btn.addEventListener('click', () => {
        btn.classList.add('hidden');
        deferred.prompt();
        deferred.userChoice.then(() => { deferred = null; });
      });
    });
  }
};

window.Main = Main;

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Main.init());
} else {
  Main.init();
}
