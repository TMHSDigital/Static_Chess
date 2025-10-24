<pre align="center">
  ███████╗████████╗ █████╗ ████████╗██╗ ██████╗     ██████╗██╗  ██╗███████╗███████╗███████╗
  ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██║██╔════╝    ██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝
  ███████╗   ██║   ███████║   ██║   ██║██║         ██║     ███████║█████╗  ███████╗███████╗
  ╚════██║   ██║   ██╔══██║   ██║   ██║██║         ██║     ██╔══██║██╔══╝  ╚════██║╚════██║
  ███████║   ██║   ██║  ██║   ██║   ██║╚██████╗    ╚██████╗██║  ██║███████╗███████║███████║
  ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝     ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
</pre>

---

<!-- Center aligned content -->
<p align="center">
  <img src="https://images.unsplash.com/photo-1580541832626-2a7131ee809f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wzOTczOTZ8MHwxfHNlYXJjaHw1fHxjaGVzc3xlbnwwfHx8fDE3MTQ2MzY3ODh8MA&ixlib=rb-4.0.3&q=80&w=1080" alt="Static Chess Banner">
</p>

<p align="center">
  <a href="https://developer.mozilla.org/en-US/docs/Web/HTML"><img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/CSS"><img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript"><img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript"></a>
  <a href="https://www.apache.org/licenses/LICENSE-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge" alt="Apache 2.0 License"></a>
  <a href="https://tmhsdigital.github.io/Static_Chess/"><img src="https://img.shields.io/badge/GitHub%20Pages-222222?style=for-the-badge&logo=GitHub%20Pages&logoColor=white" alt="GitHub Pages"></a>
</p>

<p align="center">
  A lightweight chess game built with pure vanilla web technologies - no frameworks, no libraries, just clean code.
</p>

<p align="center">
  <strong><a href="https://tmhsdigital.github.io/Static_Chess/">Play Now</a> | <a href="https://github.com/TMHSDigital/Static_Chess">View Source</a> | <a href="https://github.com/TMHSDigital/Static_Chess/issues">Report Issue</a></strong>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Demo](#demo)
- [Setup and Installation](#setup-and-installation)
- [How to Play](#how-to-play)
- [Code Structure](#code-structure)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Static Chess is a fully functional chess game playable in a web browser. It is built using pure vanilla JavaScript, HTML, and CSS, with no external frameworks or libraries. The game features standard chess rules, move validation, check/checkmate detection, move history in SAN with basic disambiguation, undo, accessibility improvements, and game state persistence using `localStorage`.

It is designed to be simple, lightweight, and easily deployable on static hosting platforms like GitHub Pages.

---

## Features

<details open>
<summary><b>Core Features</b></summary>
<br>

- **Standard Chess Rules:** Implements all standard piece movements (Pawn, Rook, Knight, Bishop, Queen, King)
- **Special Moves:** Supports castling (kingside and queenside), en passant, and pawn promotion
- **Move Validation:** Prevents illegal moves based on piece movement, obstacles, and check rules
- **Check/Checkmate Detection:** Identifies check situations and declares checkmate when appropriate
- **Stalemate Detection:** Detects stalemate conditions (no legal moves, but not in check)
- **Local Multiplayer:** Two players can play against each other on the same device
- **Visual Feedback:**
  - Highlights the selected piece
  - Shows possible legal moves for the selected piece
  - Highlights the king when in check
  - Highlights the last move made
- **Move History:** Displays moves in standard algebraic notation (SAN) with basic disambiguation
- **Undo Move:** Revert the last move with one click
- **Game Persistence:** Automatically saves game state to `localStorage`
- **Responsive Design:** Adapts layout for both desktop and mobile devices
- **Coordinate Toggle:** Option to display board coordinates
- **Professional UI:** Clean, minimalist design with subtle animations and visual cues
- **Customizable Settings:** Toggle visibility of coordinates, move indicators, last-move highlight, and sound effects

</details>

<details>
<summary><b>UI Features</b></summary>
<br>

- **Elegant Board Design:** Professional-looking chess board with subtle texturing
- **SVG Chess Pieces:** High-quality vector graphics for consistent piece rendering across all browsers
- **Responsive Layout:** Adapts to different screen sizes while maintaining playability
- **Visual Clarity:** Clean, uncluttered interface that focuses on the gameplay
- **Sophisticated Colors:** Carefully selected color palette for optimal contrast and reduced eye strain
- **Subtle Move Indicators:** Non-intrusive indicators for possible moves and last move played
- **Animated Pieces:** Smooth animations enhance the playing experience
- **Keyboard Navigation:** Navigate the board with arrow keys; Enter/Space to select/move
- **Accessibility:** ARIA roles on board and polite live-region updates for status
- **Sound Effects:** Optional audio feedback for moves, captures, check, castling, and promotion (toggle in settings)
- **Settings Panel:** Customizable display options with toggle switches
- **Mobile-Friendly Design:** Works well on touchscreens with appropriate sizing

</details>

---

## Demo

The game features an elegant, professional-looking interface with a dark theme and subtle visual cues:

<p align="center">
  <img src="ui-without-settings.png" alt="UI Without Settings Panel" width="45%" style="margin-right: 2%;">
  <img src="ui-with-settings.png" alt="UI With Settings Panel" width="45%">
</p>

<p align="center"><em>Game interface without settings panel (left) and with settings panel (right)</em></p>

---

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TMHSDigital/Static_Chess.git
   cd Static_Chess
   ```

2. **Open `index.html`:** Simply open the file in your web browser.

Optional (for contributors):

- Install dev tooling for linting/testing:
  ```bash
  npm install
  npm test
  npm run lint
  ```

That's it! No build process or dependencies are required.

---

## How to Play

1. Open `index.html` in your browser
2. The game starts with White's turn
3. Click on a piece to select it and see possible moves
4. Click on a highlighted square to move the selected piece
5. The board updates, move is added to the Move History, and turn switches
6. If a move results in check, the opponent's king will be highlighted in red
7. Game ends with checkmate or stalemate
8. Click "New Game" to reset the board
9. Toggle settings:
   - Show coordinates
   - Show possible moves
   - Highlight last move
   - Sound effects
10. Game state is saved automatically to localStorage

---

## Code Structure

<details>
<summary><b>View Project Structure</b></summary>
<br>

```
Static_Chess/
├── index.html           # Main HTML entry point
├── css/                 # CSS styles
│   ├── style.css        # General page styles
│   ├── board.css        # Chessboard specific styles
│   └── pieces.css       # Chess pieces styles
├── js/                  # JavaScript logic
│   ├── config.js        # Configuration and feature flags
│   ├── utils.js         # Utility functions
│   ├── pieces.js        # Piece definitions and movement rules
│   ├── board.js         # Board rendering and interaction
│   ├── game.js          # Core game logic
│   ├── main.js          # Application entry point
│   ├── drag.js          # Drag and drop functionality (integrated with click flow)
│   ├── ai.js            # AI opponent (skeleton)
│   └── promotion.js     # Pawn promotion UI (skeleton)
├── assets/              # SVG files for chess pieces
│   ├── wp.svg, bp.svg   # White and black pawns
│   ├── wr.svg, br.svg   # White and black rooks
│   ├── wn.svg, bn.svg   # White and black knights
│   ├── wb.svg, bb.svg   # White and black bishops
│   ├── wq.svg, bq.svg   # White and black queens
│   └── wk.svg, bk.svg   # White and black kings
├── docs/                # Documentation
│   ├── ARCHITECTURE.md  # Architecture and design documentation
│   └── ROADMAP.md       # Development roadmap
└── LICENSE              # Apache 2.0 License file
```

The project follows a clear separation of concerns:

- **`index.html`:** Main structure and layout
- **CSS files:** Visual presentation and animations
- **JS files:** Game logic and behavior
  - `config.js`: Feature flags and game settings
  - `utils.js`: Helper functions like coordinate conversions
  - `pieces.js`: Piece objects and basic movement rules
  - `board.js`: DOM rendering, keyboard navigation, and diff-based updates
  - `game.js`: Core chess logic including special moves, undo, SAN, check detection
  - `main.js`: Bootstraps the application
  - `drag.js`: Drag and drop integrated via existing click handlers
  - `ai.js`, `promotion.js`: Skeletons for upcoming features
- **SVG assets:** Vector graphics for all chess pieces, ensuring consistent rendering across browsers
- **Documentation:** Architecture guides and development roadmap

</details>

---

## Documentation

The project includes comprehensive documentation to help developers understand the architecture and implement new features:

- **Architecture Documentation:** `docs/ARCHITECTURE.md` explains components, data flow, and state.
- **Development Roadmap:** `docs/ROADMAP.md` outlines features, priorities, and timeline.
- **Release Process:** `docs/RELEASE.md` describes tagging, versioning, and triage.
- **Changelog:** `CHANGELOG.md` tracks notable changes.
- **Code Comments:** Files include JSDoc comments explaining functionality and usage.

To contribute to the project or implement new features, please review these documentation files first.

---

## Deployment

Since this is a purely static website, it can be easily deployed on any static hosting service.

**GitHub Pages Deployment:**

1. Push your project to GitHub
2. Go to repository settings
3. Navigate to "Pages" section
4. Set source to your preferred branch
5. Set folder to `/ (root)`
6. Your site will be available at `https://tmhsdigital.github.io/Static_Chess/`

Optional (CI-driven Pages): add a `pages.yml` workflow or keep manual Pages settings. CI (`.github/workflows/ci.yml`) runs lint and tests on PRs and pushes.

---

## Future Enhancements

See the [Development Roadmap](docs/ROADMAP.md) for a detailed plan of upcoming features.

<details>
<summary><b>Planned Features</b></summary>
<br>

- **Drag and Drop:** Completed integration with click-based flow
- **AI Opponent:** Implement basic chess AI using minimax algorithm
- **Promotion Choice:** UI for selecting which piece to promote a pawn to
- **Game Timer:** Optional chess clock functionality
- **Sound Effects:** Audio feedback for moves and events
- **Undo Move:** Ability to take back the last move
- **Multiple Saved Games:** Save and load multiple games
- **Advanced Draw Detection:** Implement threefold repetition and fifty-move rule
- **Full SAN Implementation:** Complete algebraic notation with disambiguation

</details>

---

## Contributing

Contributions are welcome! Please check the [Development Roadmap](docs/ROADMAP.md) for planned features and follow these steps:

1. Fork the repository
2. Create a feature branch
3. Implement your changes following project coding standards
4. Submit a pull request

For major changes, please open an issue first to discuss what you would like to change.

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by <a href="https://github.com/TMHSDigital">TMHSDigital</a>