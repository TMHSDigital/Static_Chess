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
        PLAYER_SIDE: 'w', // The side the person plays against the computer: 'w', 'b' or 'random'
        TIME_CONTROL: 'off', // A key of TIME_CONTROLS
        BOARD_THEME: 'classic', // A key of BOARD_THEMES
        PAGE_THEME: 'dark', // 'dark', 'light', or 'auto' to follow the system setting
    },

    // Board colour schemes. Each sets the square colours and the highlight
    // colours that have to stay visible on them (CSS custom properties). The
    // highlights are laid over the square colour: yellow for the piece picked
    // up, a dot or ring for where it can go, red for a king in check.
    BOARD_THEMES: {
        classic: {
            label: 'Classic',
            colors: {
                '--light-square': '#f0d9b5',
                '--dark-square': '#b58863',
                '--selected-square': 'rgba(255, 221, 0, 0.5)',
                '--possible-move-square': 'rgba(0, 0, 0, 0.25)',
                '--check-square': 'rgba(225, 30, 30, 0.6)',
            },
        },
        green: {
            label: 'Green',
            colors: {
                '--light-square': '#eeeed2',
                '--dark-square': '#769656',
                '--selected-square': 'rgba(255, 240, 0, 0.5)',
                '--possible-move-square': 'rgba(0, 0, 0, 0.22)',
                '--check-square': 'rgba(225, 30, 30, 0.6)',
            },
        },
        blue: {
            label: 'Blue',
            colors: {
                '--light-square': '#dee3e6',
                '--dark-square': '#8ca2ad',
                '--selected-square': 'rgba(255, 221, 0, 0.5)',
                '--possible-move-square': 'rgba(0, 0, 0, 0.25)',
                '--check-square': 'rgba(225, 30, 30, 0.6)',
            },
        },
        contrast: {
            label: 'High contrast',
            colors: {
                '--light-square': '#ffffff',
                '--dark-square': '#6b6b6b',
                '--selected-square': 'rgba(255, 220, 0, 0.7)',
                '--possible-move-square': 'rgba(0, 90, 255, 0.55)',
                '--check-square': 'rgba(255, 0, 0, 0.7)',
            },
        },
    },

    // Shortest time between the player's move and the computer's reply (ms)
    AI_MOVE_DELAY_MS: 400,

    // The computer agrees to a draw unless it is at least this far ahead (hundredths of a pawn)
    AI_DRAW_MARGIN: 50,

    // With less than this on its own clock the computer moves without its usual pause (ms)
    AI_HURRY_BELOW_MS: 10000,

    // How long "Copied!", "Downloaded" and "Saved" stay on a button (ms)
    NOTICE_MS: 1500,

    // How far a pressed piece has to be moved before it counts as a drag (px), and how
    // long after a drop the click the browser may still send is ignored (ms)
    DRAG_THRESHOLD_PX: 5,
    DRAG_CLICK_GUARD_MS: 100,

    // The level the engine plays at when asked for a hint
    HINT_LEVEL: 'hard',

    // After a game, a move is marked in the move list when the engine's score for
    // the side that played it fell by at least this much (hundredths of a pawn)
    REVIEW_MISTAKE_DROP: 150,

    // How long New Game, Resign, Load, Play from here, and Delete and Clear all in
    // the past games wait for a confirming second click (ms)
    CONFIRM_MS: 4000,

    // Animation durations (ms). The CSS takes them from here (board.js)
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
        LOW_TIME: [
            { frequency: 880, duration: 0.06, wave: 'square' },
            { frequency: 880, duration: 0.06, wave: 'square' },
        ],
    },

    // A player on the clock is warned, once each, when this much time is left (ms)
    LOW_TIME_WARNINGS: [20000, 10000],

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
        GAME_ARCHIVE: 'chessGameArchive',
    },

    // Longest text the Load dialog reads, in characters. A long game with
    // comments is a few thousand; this only keeps a mistaken paste from being worked on.
    IMPORT_MAX_LENGTH: 200000,

    // How long the Play button under the move list shows each position, in ms
    AUTOPLAY_STEP_MS: 1000,

    // Longest link "Copy link" makes with the whole game in it, in characters.
    // A longer game is shared as the position on the board, which always fits.
    SHARE_LINK_MAX_LENGTH: 4000,

    // How many past games are kept; the oldest make room for new ones
    ARCHIVE_LIMIT: 20,

    // What the page and the engine worker say to each other (engine-bridge.js,
    // ai-worker.js). Raise it with any change to those messages or to the
    // positions in them. A worker started after a release was deployed loads
    // the new files while an open tab still runs the old ones; its answers
    // carry its own number, and on a mismatch the page stops using workers.
    ENGINE_PROTOCOL: 1,

    // Debug mode: when true, debugLog() prints to the console
    DEBUG: false,
};

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG };
}
