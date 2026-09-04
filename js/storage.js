// storage.js — persistência local (placar, conquistas, preferências)
const Storage = {
  KEY: 'rdamas_v1',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      return { ...this.defaults(), ...JSON.parse(raw) };
    } catch { return this.defaults(); }
  },

  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  },

  defaults() {
    return {
      wins: 0,
      losses: 0,
      draws: 0,
      achievements: [],
      sound: true,
      mode: 'ai',
      difficulty: 'medium',
      totalMoves: 0,
      kingsEver: 0,
      maxCapturesInTurn: 0,
    };
  }
};

window.Storage = Storage;
