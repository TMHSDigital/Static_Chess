# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
