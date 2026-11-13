# Contributing

Thanks for your interest in contributing! This project is a static site (no build). Please:

1. Fork the repo and create a feature branch
2. Keep changes focused and small
3. Run lint and tests locally (`npm run lint && npm test`)
4. Open a PR with a clear description and screenshots if UI changes

Guidelines:
- Keep vanilla JS, HTML, CSS (no runtime frameworks)
- Maintain accessibility (labels, keyboard, focus)
- Preserve GitHub Pages deployment from repository root
- Add tests for game logic changes

## Development

The app itself needs no tooling: open `index.html` or serve the folder. Node is only used for linting and tests.

- **Node:** version 22 or newer (CI uses 24).
- **Install:** `npm ci`
- **Scripts:**
  - `npm test` runs the Jest suite
  - `npm run coverage` runs it with a coverage report
  - `npm run lint` runs ESLint (`eslint.config.mjs` is the only ESLint config)
  - `npm run format` checks formatting with Prettier. It is not enforced in CI yet, and much of the existing code does not pass it, so do not reformat files you are not otherwise changing.

### How the scripts fit together

The files in `js/` are plain `<script>` files that share one global scope and load in the order listed in `index.html`. Two conventions follow from that:

1. **Calling a function from another file needs an ESLint entry.** `eslint.config.mjs` lists, per file, which names from other files that file may use. A new cross-file call fails lint with `no-undef` until you add the name to the block for the calling file.
2. **Anything a test needs must be exported.** Each file ends with a small CommonJS footer (`if (typeof module !== 'undefined' && module.exports) { ... }`). Add new functions there if tests call them. Browsers ignore the footer.

### Writing tests

Use the shared loader instead of setting up JSDOM by hand:

```js
const { loadGame } = require('../helpers/load-game');

test('castling moves the rook', () => {
  const g = loadGame();
  g.play('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1');
  expect(g.at('f1').type).toBe('r');
});
```

`loadGame()` gives every test a fresh page and game. It returns helpers for playing moves (`play`), setting up a position (`setPosition`), and reading the board (`at`, `movesFrom`); see `tests/helpers/load-game.js`. If a new source file exposes globals that other files read, add it to that helper.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please do not open public issues for vulnerabilities.
