# Static Chess - Development Roadmap

This document outlines the planned enhancements for the Static Chess project, organized by priority and estimated implementation complexity.

## Current Status

The current version includes:

- ✅ Standard chess rules with all piece movements
- ✅ Special moves (castling, en passant, pawn promotion with a choice of piece)
- ✅ Check/checkmate detection
- ✅ Stalemate detection
- ✅ Draw detection (insufficient material, threefold repetition, fifty-move rule), resignation and draw by agreement
- ✅ Computer opponent at three levels, and a hint for the side to move
- ✅ Chess clock with five time controls
- ✅ Visual feedback (highlights, move indicators)
- ✅ Move history in standard algebraic notation, with full disambiguation
- ✅ Game review: stepping through the moves, an engine score, and playing on from an earlier position
- ✅ PGN and FEN import and export, and a list of past games
- ✅ Game persistence using localStorage
- ✅ Board and page themes
- ✅ Responsive design for different devices
- ✅ SVG piece representation for consistent rendering
- ✅ Drag and drop, and undo move
- ✅ Keyboard navigation and ARIA enhancements
- ✅ Diff-based rendering performance improvements
- ✅ Sound effects (synthesized tones, toggle in settings)
- ✅ Offline play and install as an app

## Priority Queue

Features are prioritized as follows:

1. **Tier 1**: Essential gameplay enhancements
2. **Tier 2**: Improved user experience
3. **Tier 3**: Advanced features

## Planned Features

### Tier 1: Essential Gameplay Enhancements

| Feature           | Complexity | Dependencies | Description                                                 | Status       |
| ----------------- | ---------- | ------------ | ----------------------------------------------------------- | ------------ |
| **Drag and Drop** | Medium     | None         | Allow moving pieces by dragging instead of just clicking    | ✅ Completed |
| **Promotion UI**  | Medium     | None         | Display a UI for selecting which piece to promote a pawn to | ✅ Completed |
| **Undo Move**     | Medium     | None         | Add ability to take back the last move                      | ✅ Completed |
| **Full SAN**      | Medium     | None         | Algebraic notation with disambiguation                      | ✅ Completed |

### Tier 2: Improved User Experience

| Feature                     | Complexity | Dependencies | Description                                                     | Status                   |
| --------------------------- | ---------- | ------------ | --------------------------------------------------------------- | ------------------------ |
| **Sound Effects**           | Low        | None         | Add audio feedback for moves and events                         | Done (synthesized tones) |
| **Advanced Draw Detection** | Medium     | None         | Insufficient material, threefold repetition and fifty-move rule | ✅ Completed             |
| **Game Timer**              | Medium     | None         | Optional chess clock functionality                              | ✅ Completed             |
| **Theme Customization**     | Medium     | None         | Allow customization of board colors and styles                  | ✅ Completed             |

### Tier 3: Advanced Features

| Feature                  | Complexity | Dependencies | Description                                                                        | Status       |
| ------------------------ | ---------- | ------------ | ---------------------------------------------------------------------------------- | ------------ |
| **AI Opponent**          | High       | None         | Computer opponent with three levels (alpha-beta search)                            | ✅ Completed |
| **Multiple Saved Games** | Medium     | None         | The last 20 games are kept and can be reopened; named slots are to do              | In progress  |
| **Game Import/Export**   | Medium     | None         | PGN and FEN, both ways: copy, paste, and start from a position                     | ✅ Completed |
| **Game Analysis**        | High       | AI Opponent  | A score for the position being reviewed and Hint are in; marking mistakes is to do | In progress  |

## Implementation Timeline

This is a rough guideline for feature implementation:

### Phase 1: Core Experience Improvements (1-2 months)

- [x] **SVG Piece Images**
- [x] **Drag and Drop** _(fully implemented)_
- [x] **Promotion UI**
- [x] **Undo Move**

### Phase 2: Usability Enhancements (2-3 months)

- [x] **Sound Effects** _(synthesized tones; no audio assets needed)_
- [x] **SAN Disambiguation (full)**
- [x] **Advanced Draw Detection**
- [x] **Game Timer**

### Phase 3: Advanced Features (3-6 months)

- [ ] **Multiple Saved Games** _(the last 20 games are kept; named slots are to do)_
- [x] **Theme Customization**
- [x] **AI Opponent (basic)**
- [x] **Game Import/Export**

### Phase 4: Final Polish (Ongoing)

- [ ] **AI Opponent (advanced)**
- [ ] **Game Analysis** _(the Hint button and a score for the position being reviewed are in; marking mistakes is to do)_
- [ ] **Mobile App Conversion**
- [ ] **Multiplayer Support**

## Technical Debt

These are areas that need improvement in the current codebase:

1. **Splitting game.js** - At over 2,000 lines it holds the move flow, the clock, saving, the engine bridge, import and export and most of the page updates in one scope (`board.js`, at under 400 lines, is no longer the concern)
2. **Browser-level tests** - Jest suites cover the rules, undo, persistence, input, rendering, settings and accessibility in jsdom; there is no automated check in a real browser yet
3. **Performance optimization** - Improve rendering and move calculation performance
4. **Accessibility testing** - The board is keyboard-operable and moves are announced; it has not been tested with a range of screen readers

## Implementation Progress

How each feature is built, and which file holds it, is described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Contribution Guidelines

If you'd like to contribute to the project:

1. Check the roadmap for planned features
2. Create an issue discussing your planned contribution
3. Fork the repository and create a feature branch
4. Submit a pull request with your changes
5. Ensure your code follows the project's coding standards

## Feature Request Process

Have a feature idea not listed here? Please submit feature requests by:

1. Creating a new issue on GitHub
2. Using the "Feature Request" template
3. Describing the feature in detail
4. Explaining why it would be valuable to the project
