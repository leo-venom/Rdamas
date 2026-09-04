// achievements.js — sistema de conquistas com persistência
const Achievements = {
  list: [
    { id: 'first_win', emoji: '🏆', name: 'Primeira Vitória', desc: 'Vença a IA pela primeira vez' },
    { id: 'easy_win', emoji: '🌱', name: 'Aquecimento', desc: 'Vença no fácil' },
    { id: 'medium_win', emoji: '⚔️', name: 'Desafiante', desc: 'Vença no médio' },
    { id: 'hard_win', emoji: '🧠', name: 'Mestre', desc: 'Vença no difícil' },
    { id: 'first_king', emoji: '👑', name: 'Coroação', desc: 'Crie sua primeira dama' },
    { id: 'triple_capture', emoji: '🔥', name: 'Combo Triplo', desc: 'Capture 3+ peças em 1 turno' },
    { id: 'multi_king', emoji: '✨', name: 'Exército Real', desc: 'Tenha 3+ damas ao mesmo tempo' },
    { id: 'wins_5', emoji: '🥉', name: 'Trilha de Vitórias', desc: 'Acumule 5 vitórias' },
    { id: 'wins_10', emoji: '🥈', name: 'Veterano', desc: 'Acumule 10 vitórias' },
    { id: 'wins_25', emoji: '🥇', name: 'Lenda', desc: 'Acumule 25 vitórias' },
    { id: 'long_game', emoji: '⏳', name: 'Maratona', desc: 'Uma partida com 60+ jogadas' },
    { id: 'perfect_game', emoji: '💎', name: 'Perfeição', desc: 'Vença sem perder nenhuma peça' },
  ],

  // Verifica e retorna as recém-desbloqueadas
  check(state, context) {
    const newly = [];
    const has = (id) => state.achievements.includes(id);

    const check = (id, condition) => {
      if (condition && !has(id)) {
        state.achievements.push(id);
        newly.push(this.list.find(a => a.id === id));
      }
    };

    if (context.event === 'win') {
      check('first_win', state.wins >= 1);
      if (context.difficulty === 'easy') check('easy_win', true);
      if (context.difficulty === 'medium') check('medium_win', true);
      if (context.difficulty === 'hard') check('hard_win', true);
      check('wins_5', state.wins >= 5);
      check('wins_10', state.wins >= 10);
      check('wins_25', state.wins >= 25);
      if (context.capturedPieces === 0) check('perfect_game', true);
    }

    if (context.event === 'king_created') {
      check('first_king', true);
    }

    if (context.event === 'multi_capture' && context.count >= 3) {
      check('triple_capture', true);
    }

    if (context.event === 'board_state') {
      let kingCount = 0;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (context.board[r][c] && context.board[r][c].isKing) kingCount++;
      }
      if (kingCount >= 3) check('multi_king', true);
    }

    if (context.event === 'move_made' && context.totalMoves >= 60) {
      check('long_game', true);
    }

    return newly;
  }
};

window.Achievements = Achievements;
