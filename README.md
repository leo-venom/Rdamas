# RDAMAS — Jogo de Damas Glass

Jogo de damas **dark glass** com:
- **3 níveis de IA** (Fácil / Médio / Difícil com **minimax alpha-beta**)
- **Multiplayer local** (2 jogadores no mesmo device)
- **Conquistas** persistentes (12 achievements, localStorage)
- **Histórico de jogadas** + **Undo/Redo** (Ctrl+Z)
- **PWA** (instalável, offline)
- Animações de captura e promoção a dama
- Sons via Web Audio API
- Atalhos de teclado

## Acesso
- Site: **https://rdamas.onrender.com**
- Local: `cd "..." && node server.js` → http://localhost:3000

## Estrutura
```
Rdamas/
├── index.html        # UI principal
├── style.css         # Tema dark glass
├── manifest.json     # PWA
├── sw.js             # Service worker
├── server.js         # Servidor zero-dep
├── js/
│   ├── storage.js    # localStorage (placar, conquistas)
│   ├── audio.js      # Efeitos sonoros
│   ├── ai.js         # IA com 3 níveis + minimax
│   ├── game.js       # Regras + motor do jogo
│   ├── ui.js         # Render do tabuleiro
│   ├── achievements.js
│   └── main.js       # Cola tudo
└── icons/            # Ícones PWA
```

## Atalhos
- `Z` Desfazer
- `Y` Refazer
- `N` Novo jogo
- `M` Trocar modo (IA ↔ local)
- 🔊 Botão de som

## Deploy (Render)
1. `gh repo create Rdamas --public --source . --push`
2. Render → New Web Service → conectar repo
3. Build vazio, Start `node server.js`, Instance Free
4. Subdomínio: `rdamas.onrender.com`
