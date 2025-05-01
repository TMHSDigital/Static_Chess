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
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License"></a>
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

Static Chess is a fully functional chess game playable in a web browser. It is built using pure vanilla JavaScript, HTML, and CSS, with no external frameworks or libraries. The game features standard chess rules, move validation, check/checkmate detection, move history, and game state persistence using `localStorage`.

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
- **Move History:** Displays moves in standard algebraic notation (SAN)
- **Game Persistence:** Automatically saves game state to `localStorage`
- **Responsive Design:** Adapts layout for both desktop and mobile devices
- **Coordinate Toggle:** Option to display board coordinates
- **Professional UI:** Clean, minimalist design with subtle animations and visual cues
- **Customizable Settings:** Toggle visibility of coordinates, move indicators, and highlights

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
- **Settings Panel:** Customizable display options with toggle switches
- **Mobile-Friendly Design:** Works well on touchscreens with appropriate sizing

</details>

---

## Demo

The game features an elegant, professional-looking interface with a dark theme and subtle visual cues:

<p align="center">
  <img src="https://i.imgur.com/XdatvSm.gif" alt="Static Chess Gameplay GIF">
</p>

<p align="center"><em>Gameplay demonstration</em></p>

<p align="center">
  <img src="ui-without-settings.png" alt="UI Without Settings Panel" width="45%" style="margin-right: 2%;">
  <img src="ui-with-settings.png" alt="UI With Settings Panel" width="45%">
</p>

<p align="center"><em>Game interface without settings panel (left) and with settings panel (right)</em></p>

*Note: The above GIF may show an earlier version. The current version features enhanced aesthetics.*

---

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TMHSDigital/Static_Chess.git
   cd Static_Chess
   ```

2. **Open `index.html`:** Simply open the file in your web browser.

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
9. Toggle "Show coordinates" to display board coordinates
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
│   ├── drag.js          # Drag and drop functionality
│   ├── ai.js            # AI opponent
│   └── promotion.js     # Pawn promotion UI
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
└── LICENSE              # MIT License file
```

The project follows a clear separation of concerns:

- **`index.html`:** Main structure and layout
- **CSS files:** Visual presentation and animations
- **JS files:** Game logic and behavior
  - `config.js`: Feature flags and game settings
  - `utils.js`: Helper functions like coordinate conversions
  - `pieces.js`: Piece objects and basic movement rules
  - `board.js`: DOM manipulation for the board interface
  - `game.js`: Core chess logic including special moves, check detection, etc.
  - `main.js`: Bootstraps the application
  - Additional files for upcoming feature implementations
- **SVG assets:** Vector graphics for all chess pieces, ensuring consistent rendering across browsers
- **Documentation:** Architecture guides and development roadmap

</details>

---

## Documentation

The project includes comprehensive documentation to help developers understand the architecture and implement new features:

- **Architecture Documentation:** The `docs/ARCHITECTURE.md` file explains the component interactions, data flow, and state management approach.
- **Development Roadmap:** The `docs/ROADMAP.md` file outlines planned features, priorities, and implementation timeline.
- **Code Comments:** All files include thorough JSDoc comments explaining functionality and usage.
- **Feature Implementation Guides:** The architecture document includes detailed guides for implementing each planned feature.

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

---

## Future Enhancements

See the [Development Roadmap](docs/ROADMAP.md) for a detailed plan of upcoming features.

<details>
<summary><b>Planned Features</b></summary>
<br>

- **Drag and Drop:** Allow moving pieces by dragging
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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by <a href="https://github.com/TMHSDigital">TMHSDigital</a>