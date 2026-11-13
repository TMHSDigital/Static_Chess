/**
 * @fileoverview Centralized configuration for Static Chess
 * Contains game settings, feature flags, and constants
 */

const CONFIG = {
    // Feature flags. Every flag here is read by the code.
    FEATURES: {
        DRAG_AND_DROP: true,   // Move pieces by dragging (drag.js)
        UNDO_MOVE: true,       // Show and enable the Undo button
        SOUND_EFFECTS: false,  // Runtime state: set from the "Sound effects" toggle at startup
        // The next two only take effect once their script is added to index.html
        // and wired into game.js; see docs/ARCHITECTURE.md.
        AI_OPPONENT: false,    // ai.js (skeleton)
        PROMOTION_UI: false,   // promotion.js (skeleton)
    },

    // Defaults for the settings panel, used until the player changes a toggle
    DEFAULT_SETTINGS: {
        SHOW_COORDINATES: false,
        SHOW_POSSIBLE_MOVES: true,
        SHOW_LAST_MOVE: true,
        ENABLE_SOUNDS: false,
        AI_DIFFICULTY: 'easy', // For the future AI opponent
    },

    // Animation durations (ms)
    ANIMATIONS: {
        PIECE_MOVE: 300,
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

    // localStorage keys. Changing a value here orphans what players have
    // already saved under the old key, so migrate before renaming.
    STORAGE_KEYS: {
        GAME_STATE: 'chessGameState',
        SHOW_COORDINATES: 'showCoords',
        SHOW_POSSIBLE_MOVES: 'showPossibleMoves',
        SHOW_LAST_MOVE: 'showLastMove',
        ENABLE_SOUNDS: 'enableSounds',
    },

    // Debug mode: when true, debugLog() prints to the console
    DEBUG: false,
};

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
}
