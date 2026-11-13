# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Sound Effects**: The settings toggle now plays short synthesized tones for moves, captures, check, castling, promotion and game end
- Undo is kept across page reloads, and the Undo button is disabled when there is nothing to undo
- Clicking another of your own pieces switches the selection to it
- Tests for the rules engine, undo, persistence, and mouse and touch input

### Fixed
- An unmoved king could make illegal two-square moves that bypassed the castling rules
- Queenside castling was refused when only the b-file square was attacked
- Undo restored a wrong position after castling, en passant or a double pawn push
- Click-to-move with a mouse and tap-to-move on touch screens did not work while drag and drop was enabled
- A malformed saved game, or a browser that blocks storage, stopped the app from starting
- Move notation picked the wrong disambiguation when three or more pieces could reach a square

### Changed
- CI installs from a lockfile on Node 24 with pinned actions; the release workflow runs lint and tests first
- Removed unused notation helpers, duplicate path and check functions, and the legacy ESLint config

## [0.1.0] - 2025-11-02

### Added
- **Drag and Drop**: Fully functional drag-and-drop interface for moving pieces, integrated with click-based flow
- **Undo Move**: Ability to undo the last move with full state restoration
- **Accessibility**: ARIA roles, live regions, and keyboard navigation (arrow keys, Enter/Space)
- **Sound Effects**: Toggle and event wiring ready (audio files can be added to `assets/sounds/`)
- **SAN Improvements**: Standard Algebraic Notation with basic disambiguation for move history
- **Performance Optimizations**: 
  - Diff-based rendering (only updates changed squares)
  - Optimized move simulation (lightweight board copies)
- **Testing Infrastructure**: Jest unit and integration tests with jsdom
- **CI/CD**: Automated linting and testing via GitHub Actions
- **Repository Hardening**: 
  - CODE_OF_CONDUCT, SECURITY, CONTRIBUTING documentation
  - Issue and PR templates
  - CODEOWNERS file
  - Dependabot configuration
- **Code Quality**: ESLint, Prettier, and EditorConfig for consistent formatting
- **Documentation**: Comprehensive architecture docs, roadmap, and release process

### Changed
- Game state persistence improved with snapshot-based undo system
- Move history now uses proper SAN notation with disambiguation
- Board rendering performance significantly improved

### Fixed
- Fixed move validation edge cases
- Improved check/checkmate detection accuracy
