// game.js — núcleo do jogo: estado, validação, execução
const Game = {
  CYAN: 'cyan',
  MAGENTA: 'magenta',

  state: null,

  newGame(opts = {}) {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) {
          if (r < 3) board[r][c] = { player: this.MAGENTA, isKing: false };
          else if (r > 4) board[r][c] = { player: this.CYAN, isKing: false };
        }
      }
    }
    this.state = {
      board,
      turn: this.CYAN, // humano sempre joga primeiro (cyan)
      mode: opts.mode || 'ai',
      difficulty: opts.difficulty || 'medium',
      selected: null,
      validMoves: [],
      mustContinue: false, // multi-capture em sequência
      continueFrom: null, // {r, c} da peça que deve continuar capturando
      history: [], // [{...state, move, captured:[]}]
      redoStack: [],
      moveCount: 0,
      capturedThisTurn: 0,
      lastMove: null,
      winner: null,
      lastCaptureCount: 0,
    };
    return this.state;
  },

  isPlayerTurn() {
    if (!this.state || this.state.winner) return false;
    if (this.state.mode === 'ai') return this.state.turn === this.CYAN;
    return true; // local 2P: sempre
  },

  isAiTurn() {
    return this.state.mode === 'ai' && this.state.turn === this.MAGENTA && !this.state.winner;
  },

  // Clicou numa peça do jogador atual
  select(r, c) {
    const s = this.state;
    if (!this.isPlayerTurn() || s.mustContinue) return false;
    const piece = s.board[r][c];
    if (!piece || piece.player !== s.turn) return false;
    const moves = this._legalMovesFrom(r, c);
    if (moves.length === 0) return false;
    s.selected = { r, c };
    s.validMoves = moves;
    return true;
  },

  deselect() {
    const s = this.state;
    if (!s) return;
    if (s.mustContinue) return; // não pode trocar
    s.selected = null;
    s.validMoves = [];
  },

  // Clicou numa célula vazia (tentativa de mover)
  clickCell(r, c) {
    const s = this.state;
    if (!this.isPlayerTurn() || s.winner) return { type: 'none' };

    // Se tem peça selecionada e clicou em movimento válido → move
    if (s.selected) {
      const move = s.validMoves.find(m => m.to.r === r && m.to.c === c);
      if (move) {
        return { type: 'move', move: this._executeMove(move) };
      }
    }

    // Tentou selecionar outra peça (se não em multi-capture)
    const piece = s.board[r][c];
    if (piece && piece.player === s.turn && !s.mustContinue) {
      const moves = this._legalMovesFrom(r, c);
      if (moves.length > 0) {
        s.selected = { r, c };
        s.validMoves = moves;
        return { type: 'select' };
      }
    }

    // Se clicou em outro lugar, desseleciona
    if (s.selected && !s.mustContinue) {
      s.selected = null;
      s.validMoves = [];
      return { type: 'deselect' };
    }
    return { type: 'none' };
  },

  // Movimentos legais de uma peça (com regra de captura obrigatória)
  _legalMovesFrom(r, c) {
    const s = this.state;
    const piece = s.board[r][c];
    if (!piece || piece.player !== s.turn) return [];
    const allCaptures = this._anyCapturesAvailable(s.turn);
    const moves = this._pieceMovesSeq(r, c, [], allCaptures);
    if (allCaptures) return moves.filter(m => m.captured);
    return moves;
  },

  _anyCapturesAvailable(player) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = this.state.board[r][c];
      if (!p || p.player !== player) continue;
      if (this._capturesFrom(r, c).length > 0) return true;
    }
    return false;
  },

  _capturesFrom(r, c) {
    const piece = this.state.board[r][c];
    if (!piece) return [];
    const dirs = piece.isKing
      ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : (piece.player === this.CYAN ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
    const caps = [];
    for (const [dr,dc] of dirs) {
      const tr = r+dr, tc = c+dc, jr = r+dr*2, jc = c+dc*2;
      if (jr<0||jr>7||jc<0||jc>7) continue;
      const target = this.state.board[tr][tc];
      if (target && target.player !== piece.player && !this.state.board[jr][jc]) {
        caps.push({ to:{r:jr,c:jc}, captured:{r:tr,c:tc} });
      }
    }
    return caps;
  },

  _pieceMovesSeq(r, c, path, mustCapture) {
    const s = this.state;
    const piece = s.board[r][c];
    if (!piece) return [];
    const dirs = piece.isKing
      ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : (piece.player === this.CYAN ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
    const moves = [];
    const caps = this._capturesFrom(r, c);
    if (caps.length > 0) {
      for (const cap of caps) {
        // Simula
        const fromR = r, fromC = c;
        const pieceBackup = JSON.parse(JSON.stringify(s.board[r][c]));
        const targetBackup = JSON.parse(JSON.stringify(s.board[cap.captured.r][cap.captured.c]));
        s.board[cap.to.r][cap.to.c] = s.board[r][c];
        s.board[r][c] = null;
        s.board[cap.captured.r][cap.captured.c] = null;
        const willKing = !s.board[cap.to.r][cap.to.c].isKing && (
          (s.board[cap.to.r][cap.to.c].player === this.CYAN && cap.to.r === 0) ||
          (s.board[cap.to.r][cap.to.c].player === this.MAGENTA && cap.to.r === 7)
        );
        if (willKing) {
          s.board[cap.to.r][cap.to.c].isKing = true;
          moves.push({ from:{r:fromR,c:fromC}, to:cap.to, captured:cap.captured, kingAfter:true, path:[...path, { from:{r:fromR,c:fromC}, to:cap.to }] });
        } else {
          const chain = this._pieceMovesSeq(cap.to.r, cap.to.c, [...path, { from:{r:fromR,c:fromC}, to:cap.to }], true);
          if (chain.length > 0) chain.forEach(m => moves.push(m));
          else moves.push({ from:{r:fromR,c:fromC}, to:cap.to, captured:cap.captured, kingAfter:false, path:[...path, { from:{r:fromR,c:fromC}, to:cap.to }] });
        }
        // Restaura
        s.board[fromR][fromC] = pieceBackup;
        s.board[cap.to.r][cap.to.c] = null;
        s.board[cap.captured.r][cap.captured.c] = targetBackup;
      }
    } else if (!mustCapture) {
      for (const [dr,dc] of dirs) {
        const tr = r+dr, tc = c+dc;
        if (tr<0||tr>7||tc<0||tc>7) continue;
        if (!s.board[tr][tc]) {
          const willKing = !s.board[r][c].isKing && (
            (s.board[r][c].player === this.CYAN && tr === 0) ||
            (s.board[r][c].player === this.MAGENTA && tr === 7)
          );
          moves.push({ from:{r,c}, to:{r:tr,c:tc}, captured:null, kingAfter:willKing, path:[{ from:{r,c}, to:{r:tr,c:tc} }] });
        }
      }
    }
    return moves;
  },

  _executeMove(move) {
    const s = this.state;
    // Snapshot pro histórico
    const snapshot = {
      board: JSON.parse(JSON.stringify(s.board)),
      turn: s.turn,
      moveCount: s.moveCount,
      capturedThisTurn: s.capturedThisTurn,
    };
    s.history.push(snapshot);
    s.redoStack = []; // limpa redo

    // Executa
    const piece = { ...s.board[move.from.r][move.from.c] };
    s.board[move.to.r][move.to.c] = piece;
    s.board[move.from.r][move.from.c] = null;
    s.lastMove = move;
    s.moveCount++;
    let captured = 0;
    let kinged = false;

    if (move.captured) {
      s.board[move.captured.r][move.captured.c] = null;
      captured = 1;
      // Conta capturas totais no path (multi-capture)
      if (move.path && move.path.length > 1) {
        captured = move.path.length - 1;
      }
      s.capturedThisTurn = captured;
    } else {
      s.capturedThisTurn = 0;
    }

    if (move.kingAfter) {
      s.board[move.to.r][move.to.c].isKing = true;
      kinged = true;
    }

    // Eventos para conquistas
    const events = { type: 'move' };
    if (kinged) events.kinged = true;
    if (captured >= 3) events.multiCapture = captured;

    s.selected = null;
    s.validMoves = [];
    s.lastCaptureCount = captured;

    // Verifica se pode continuar capturando (multi-capture)
    if (move.captured) {
      const moreCaps = this._capturesFrom(move.to.r, move.to.c);
      // Em checkers, virar dama no meio para capturas adicionais
      if (moreCaps.length > 0 && !kinged) {
        s.mustContinue = true;
        s.continueFrom = { r: move.to.r, c: move.to.c };
        s.validMoves = moreCaps.map(cap => ({ from: move.to, to: cap.to, captured: cap.captured, kingAfter: false, path: [{from: move.to, to: cap.to}] }));
        return { ok: true, captured, kinged, mustContinue: true, events };
      }
    }
    s.mustContinue = false;
    s.continueFrom = null;

    // Próximo turno
    s.turn = s.turn === this.CYAN ? this.MAGENTA : this.CYAN;
    return { ok: true, captured, kinged, mustContinue: false, events };
  },

  continueCapture(toR, toC) {
    const s = this.state;
    if (!s.mustContinue) return { type: 'none' };
    const move = s.validMoves.find(m => m.to.r === toR && m.to.c === toC);
    if (move) {
      const result = this._executeMove(move);
      return { type: 'move', move: move, result: result };
    }
    return { type: 'none' };
  },

  undo() {
    const s = this.state;
    if (s.history.length === 0) return false;
    const last = s.history.pop();
    s.redoStack.push({
      board: JSON.parse(JSON.stringify(s.board)),
      turn: s.turn,
      moveCount: s.moveCount,
      capturedThisTurn: s.capturedThisTurn,
    });
    s.board = last.board;
    s.turn = last.turn;
    s.moveCount = last.moveCount;
    s.capturedThisTurn = last.capturedThisTurn;
    s.selected = null;
    s.validMoves = [];
    s.mustContinue = false;
    s.continueFrom = null;
    s.winner = null;
    return true;
  },

  redo() {
    const s = this.state;
    if (s.redoStack.length === 0) return false;
    const next = s.redoStack.pop();
    s.history.push({
      board: JSON.parse(JSON.stringify(s.board)),
      turn: s.turn,
      moveCount: s.moveCount,
      capturedThisTurn: s.capturedThisTurn,
    });
    s.board = next.board;
    s.turn = next.turn;
    s.moveCount = next.moveCount;
    s.capturedThisTurn = next.capturedThisTurn;
    s.selected = null;
    s.validMoves = [];
    return true;
  },

  countPieces(player) {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (this.state.board[r][c] && this.state.board[r][c].player === player) n++;
    }
    return n;
  },

  hasAnyMoves(player) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = this.state.board[r][c];
      if (p && p.player === player) {
        const moves = this._legalMovesFrom(r, c);
        if (moves.length > 0) return true;
      }
    }
    return false;
  },

  checkWinner() {
    if (!this.state) return null;
    const cyanCount = this.countPieces(this.CYAN);
    const magentaCount = this.countPieces(this.MAGENTA);
    if (cyanCount === 0) return this.MAGENTA;
    if (magentaCount === 0) return this.CYAN;
    if (!this.hasAnyMoves(this.state.turn)) return this.state.turn === this.CYAN ? this.MAGENTA : this.CYAN;
    return null;
  }
};

window.Game = Game;
