/**
 * @fileoverview Centralized configuration for Static Chess
 * Contains game settings, feature flags, and constants
 */

const CONFIG = {
    // Feature flags. Every flag here is read by the code.
    FEATURES: {
        DRAG_AND_DROP: true, // Move pieces by dragging (drag.js)
        UNDO_MOVE: true, // Show and enable the Undo button
        SOUND_EFFECTS: false, // Runtime state: set from the "Sound effects" toggle at startup
        AI_OPPONENT: true, // Offer a computer opponent in the settings (ai.js)
        PROMOTION_UI: true, // Ask which piece a pawn promotes to (off: always a queen)
        GAME_TIMER: true, // Offer a chess clock in the settings
    },

    // Clock settings on offer: minutes each, plus seconds added after every move
    TIME_CONTROLS: {
        off: { label: 'No clock' },
        '1+0': { label: '1 minute', minutes: 1, increment: 0 },
        '3+2': { label: '3 min + 2 s', minutes: 3, increment: 2 },
        '5+0': { label: '5 minutes', minutes: 5, increment: 0 },
        '10+0': { label: '10 minutes', minutes: 10, increment: 0 },
        '15+10': { label: '15 min + 10 s', minutes: 15, increment: 10 },
    },

    // How often a running clock is redrawn and checked (ms)
    CLOCK_TICK_MS: 200,

    // Defaults for the settings panel, used until the player changes a toggle
    DEFAULT_SETTINGS: {
        SHOW_COORDINATES: false,
        SHOW_POSSIBLE_MOVES: true,
        SHOW_LAST_MOVE: true,
        ENABLE_SOUNDS: false,
        FLIP_BOARD: false, // true shows the board from Black's side
        OPPONENT: 'human', // 'human' for two players, or 'easy', 'medium', 'hard' for the computer
        PLAYER_SIDE: 'w', // The side the person plays against the computer: 'w' or 'b'
        TIME_CONTROL: 'off', // A key of TIME_CONTROLS
        BOARD_THEME: 'classic', // A key of BOARD_THEMES
        PAGE_THEME: 'dark', // 'dark', 'light', or 'auto' to follow the system setting
    },

    // Board colour schemes. Each sets the square colours and the highlight
    // colours that have to stay visible on them (CSS custom properties).
    BOARD_THEMES: {
        classic: {
            label: 'Classic',
            colors: {
                '--light-square': '#f0d9b5',
                '--dark-square': '#b58863',
                '--selected-square': 'rgba(255, 255, 0, 0.3)',
                '--possible-move-square': 'rgba(20, 150, 20, 0.3)',
                '--check-square': 'rgba(220, 20, 20, 0.4)',
            },
        },
        green: {
            label: 'Green',
            colors: {
                '--light-square': '#eeeed2',
                '--dark-square': '#769656',
                '--selected-square': 'rgba(255, 255, 0, 0.4)',
                '--possible-move-square': 'rgba(0, 0, 0, 0.22)',
                '--check-square': 'rgba(220, 20, 20, 0.5)',
            },
        },
        blue: {
            label: 'Blue',
            colors: {
                '--light-square': '#dee3e6',
                '--dark-square': '#8ca2ad',
                '--selected-square': 'rgba(255, 255, 0, 0.35)',
                '--possible-move-square': 'rgba(20, 120, 20, 0.35)',
                '--check-square': 'rgba(220, 20, 20, 0.45)',
            },
        },
        contrast: {
            label: 'High contrast',
            colors: {
                '--light-square': '#ffffff',
                '--dark-square': '#6b6b6b',
                '--selected-square': 'rgba(255, 220, 0, 0.55)',
                '--possible-move-square': 'rgba(0, 90, 255, 0.4)',
                '--check-square': 'rgba(255, 0, 0, 0.6)',
            },
        },
    },

    // Shortest time between the player's move and the computer's reply (ms)
    AI_MOVE_DELAY_MS: 400,

    // The level the engine plays at when asked for a hint
    HINT_LEVEL: 'hard',

    // How long the New Game button waits for a confirming second click (ms)
    RESET_CONFIRM_MS: 4000,

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
        CHECK: [
            { frequency: 660, duration: 0.08 },
            { frequency: 880, duration: 0.12 },
        ],
        CASTLE: [
            { frequency: 392, duration: 0.07 },
            { frequency: 523, duration: 0.09 },
        ],
        PROMOTE: [
            { frequency: 523, duration: 0.08 },
            { frequency: 659, duration: 0.08 },
            { frequency: 784, duration: 0.14 },
        ],
        GAME_END: [
            { frequency: 523, duration: 0.14 },
            { frequency: 392, duration: 0.14 },
            { frequency: 262, duration: 0.3 },
        ],
    },

    // localStorage keys. Changing a value here orphans what players have
    // already saved under the old key, so migrate before renaming.
    STORAGE_KEYS: {
        GAME_STATE: 'chessGameState',
        SHOW_COORDINATES: 'showCoords',
        SHOW_POSSIBLE_MOVES: 'showPossibleMoves',
        SHOW_LAST_MOVE: 'showLastMove',
        ENABLE_SOUNDS: 'enableSounds',
        FLIP_BOARD: 'flipBoard',
        OPPONENT: 'opponent',
        PLAYER_SIDE: 'playerSide',
        TIME_CONTROL: 'timeControl',
        BOARD_THEME: 'boardTheme',
        PAGE_THEME: 'pageTheme',
    },

    // Debug mode: when true, debugLog() prints to the console
    DEBUG: false,
};

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
}
