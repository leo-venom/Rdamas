// ai.js — IA com 3 níveis (easy = random, medium = greedy, hard = minimax alpha-beta)

const AI = {
  CYAN: 'cyan',
  MAGENTA: 'magenta',

  // --- 1. Geração de todos os movimentos possíveis (regras oficiais) ---
  // Returns: [{ from:{r,c}, to:{r,c}, captured:null|{r,c}, path:[...], kingAfter:bool, isMulti:bool }]
  getAllMoves(board, player) {
    const moves = [];
    const capturesExist = this._anyCapturesAvailable(board, player);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.player !== player) continue;
        const pmoves = this._pieceMoves(board, r, c, capturesExist, []);
        pmoves.forEach(m => moves.push(m));
      }
    }
    return moves;
  },

  _anyCapturesAvailable(board, player) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.player !== player) continue;
        if (this._capturesFrom(board, r, c).length > 0) return true;
      }
    }
    return false;
  },

  _capturesFrom(board, r, c) {
    const p = board[r][c];
    if (!p) return [];
    const dirs = p.isKing
      ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : (p.player === 'cyan' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
    const caps = [];
    for (const [dr,dc] of dirs) {
      const tr = r + dr, tc = c + dc;
      const jr = r + dr*2, jc = c + dc*2;
      if (jr<0||jr>7||jc<0||jc>7) continue;
      if (board[tr][tc] && board[tr][tc].player !== p.player && !board[jr][jc]) {
        caps.push({ from:{r,c}, to:{r:jr,c:jc}, captured:{r:tr,c:tc} });
      }
    }
    return caps;
  },

  // Recursive: builds multi-capture paths
  _pieceMoves(board, r, c, mustCapture, path) {
    const p = board[r][c];
    if (!p) return [];
    const dirs = p.isKing
      ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : (p.player === 'cyan' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
    const moves = [];

    // Captures (mandatory if any)
    const caps = this._capturesFrom(board, r, c);
    if (caps.length > 0) {
      for (const cap of caps) {
        // Simulate
        const nb = board.map(row => row.slice());
        nb[cap.to.r][cap.to.c] = { ...p, isKing: p.isKing };
        nb[cap.from.r][cap.from.c] = null;
        nb[cap.captured.r][cap.captured.c] = null;

        // Kinging mid-sequence doesn't allow extra captures in checkers (rule)
        const willKing = !nb[cap.to.r][cap.to.c].isKing && (
          (p.player === 'cyan' && cap.to.r === 0) ||
          (p.player === 'magenta' && cap.to.r === 7)
        );
        if (willKing) {
          nb[cap.to.r][cap.to.c].isKing = true;
          moves.push({
            from:{r,c}, to:cap.to, captured:cap.captured,
            kingAfter: true, path: [...path, { from:{r,c}, to:cap.to }]
          });
        } else {
          // Continue chain
          const chain = this._pieceMoves(nb, cap.to.r, cap.to.c, true, [...path, { from:{r,c}, to:cap.to }]);
          if (chain.length > 0) {
            chain.forEach(m => moves.push(m));
          } else {
            moves.push({
              from:{r,c}, to:cap.to, captured:cap.captured,
              kingAfter: false, path: [...path, { from:{r,c}, to:cap.to }]
            });
          }
        }
      }
    } else if (!mustCapture) {
      // Plain moves (no capture)
      for (const [dr,dc] of dirs) {
        const tr = r + dr, tc = c + dc;
        if (tr<0||tr>7||tc<0||tc>7) continue;
        if (!board[tr][tc]) {
          const willKing = !p.isKing && (
            (p.player === 'cyan' && tr === 0) ||
            (p.player === 'magenta' && tr === 7)
          );
          moves.push({
            from:{r,c}, to:{r:tr,c:tc}, captured:null,
            kingAfter: willKing, path: [{ from:{r,c}, to:{r:tr,c:tc} }]
          });
        }
      }
    }
    return moves;
  },

  // --- 2. Aplica um movimento e devolve novo board ---
  applyMove(board, move) {
    const nb = board.map(row => row.slice());
    const piece = nb[move.from.r][move.from.c];
    if (!piece) return nb;
    nb[move.to.r][move.to.c] = { ...piece };
    nb[move.from.r][move.from.c] = null;
    if (move.captured) nb[move.captured.r][move.captured.c] = null;
    if (move.kingAfter) nb[move.to.r][move.to.c].isKing = true;
    return nb;
  },

  // --- 3. Avaliação (para o hard) ---
  // Valores:
  //   peça normal: 10
  //   dama: 35
  //   bônus por posição centralizada
  //   penalidade por estar na borda
  //   bônus por mobilidade
  evaluate(board) {
    let score = 0;
    let cyanMobility = 0, magentaMobility = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        let val = p.isKing ? 35 : 10;
        // Centro vale mais
        const distCenter = Math.abs(r - 3.5) + Math.abs(c - 3.5);
        val -= distCenter * 0.4;
        // Borda vale menos (exceto pra quem vai virar dama)
        if ((r === 0 || r === 7) && !p.isKing) {
          if ((p.player === 'cyan' && r === 0) || (p.player === 'magenta' && r === 7)) {
            val += 8; // perto de virar dama
          }
        }
        if (p.player === 'magenta') score += val;
        else score -= val;
      }
    }
    // Mobilidade
    cyanMobility = this.getAllMoves(board, 'cyan').length;
    magentaMobility = this.getAllMoves(board, 'magenta').length;
    score += (magentaMobility - cyanMobility) * 0.5;
    return score;
  },

  // --- 4. Escolha do movimento conforme dificuldade ---
  chooseMove(board, player, difficulty) {
    const moves = this.getAllMoves(board, player);
    if (moves.length === 0) return null;

    if (difficulty === 'easy') {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    if (difficulty === 'medium') {
      // Greedy: prefere capturas e dama, com randomização
      const captures = moves.filter(m => m.captured);
      if (captures.length > 0) {
        // 80% escolhe a melhor captura (mais perto de virar dama ou mais capturas)
        if (Math.random() < 0.8) {
          captures.sort((a, b) => (b.kingAfter?1:0) - (a.kingAfter?1:0));
          return captures[0];
        }
        return captures[Math.floor(Math.random() * captures.length)];
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Hard: minimax com alpha-beta
    const depth = 6;
    const result = this.minimax(board, depth, -Infinity, Infinity, true, 0);
    return result.move;
  },

  minimax(board, depth, alpha, beta, isMaximizing, startTime) {
    // Time check (safety)
    if (Date.now() - (startTime || Date.now()) > 2000) {
      return { value: this.evaluate(board), move: null };
    }
    if (depth === 0) return { value: this.evaluate(board), move: null };

    const player = isMaximizing ? 'magenta' : 'cyan';
    const moves = this.getAllMoves(board, player);
    if (moves.length === 0) {
      // Sem movimentos: quem ficou sem perde
      return { value: isMaximizing ? -9999 : 9999, move: null };
    }

    let bestMove = moves[0];
    if (isMaximizing) {
      let best = -Infinity;
      for (const m of moves) {
        const nb = this.applyMove(board, m);
        const r = this.minimax(nb, depth - 1, alpha, beta, false, startTime || Date.now());
        if (r.value > best) { best = r.value; bestMove = m; }
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return { value: best, move: bestMove };
    } else {
      let best = Infinity;
      for (const m of moves) {
        const nb = this.applyMove(board, m);
        const r = this.minimax(nb, depth - 1, alpha, beta, true, startTime || Date.now());
        if (r.value < best) { best = r.value; bestMove = m; }
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return { value: best, move: bestMove };
    }
  }
};

window.AI = AI;
