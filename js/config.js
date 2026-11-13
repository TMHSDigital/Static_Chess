/**
 * @fileoverview Centralized configuration for Static Chess
 * Contains game settings, feature flags, and constants
 */

const CONFIG = {
    // Game settings
    BOARD_SIZE: 8,
    
    // Feature flags (for future enhancements)
    FEATURES: {
        DRAG_AND_DROP: true,
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
        ENABLE_SOUNDS: false,
    },
    
    // Animation durations (ms)
    ANIMATIONS: {
        PIECE_MOVE: 300,
        HIGHLIGHT_PULSE: 2000,
    },
    
    // Sound effects: each sound is a short run of synthesized tones
    // (frequency in Hz, duration in seconds, optional oscillator wave shape)
    SOUND_VOLUME: 0.15,
    SOUNDS: {
        MOVE: [{ frequency: 440, duration: 0.07 }],
        CAPTURE: [{ frequency: 220, duration: 0.1, wave: 'triangle' }],
        CHECK: [{ frequency: 660, duration: 0.08 }, { frequency: 880, duration: 0.12 }],
        CASTLE: [{ frequency: 392, duration: 0.07 }, { frequency: 523, duration: 0.09 }],
        PROMOTE: [{ frequency: 523, duration: 0.08 }, { frequency: 659, duration: 0.08 }, { frequency: 784, duration: 0.14 }],
        GAME_END: [{ frequency: 523, duration: 0.14 }, { frequency: 392, duration: 0.14 }, { frequency: 262, duration: 0.3 }],
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

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
} 