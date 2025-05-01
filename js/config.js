/**
 * @fileoverview Centralized configuration for Static Chess
 * Contains game settings, feature flags, and constants
 */

const CONFIG = {
    // Game settings
    BOARD_SIZE: 8,
    
    // Feature flags (for future enhancements)
    FEATURES: {
        DRAG_AND_DROP: false,
        AI_OPPONENT: false,
        PROMOTION_UI: false,
        GAME_TIMER: false,
        SOUND_EFFECTS: false,
        UNDO_MOVE: false,
        ADVANCED_DRAW_DETECTION: false,
    },
    
    // Default settings (user configurable)
    DEFAULT_SETTINGS: {
        SHOW_COORDINATES: false,
        SHOW_POSSIBLE_MOVES: true,
        SHOW_LAST_MOVE: true,
        AI_DIFFICULTY: 'easy', // For future AI opponent
    },
    
    // Animation durations (ms)
    ANIMATIONS: {
        PIECE_MOVE: 300,
        HIGHLIGHT_PULSE: 2000,
    },
    
    // Assets
    ASSETS: {
        SOUNDS: {
            MOVE: 'assets/sounds/move.mp3',
            CAPTURE: 'assets/sounds/capture.mp3',
            CHECK: 'assets/sounds/check.mp3',
            CASTLE: 'assets/sounds/castle.mp3',
            PROMOTE: 'assets/sounds/promote.mp3',
            GAME_END: 'assets/sounds/game-end.mp3',
        }
    },
    
    // Local storage keys
    STORAGE_KEYS: {
        GAME_STATE: 'staticChess.gameState',
        SETTINGS: 'staticChess.settings',
        SAVED_GAMES: 'staticChess.savedGames',
    },
    
    // Debug mode
    DEBUG: false,
}; 