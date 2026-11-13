/**
 * @fileoverview Main entry point for the Static Chess application.
 * Initializes the game and sets up event listeners.
 */

// Ensure the DOM is fully loaded before initializing the game
document.addEventListener('DOMContentLoaded', () => {
    // --- Initialize Toggles --- 
    const coordsToggle = document.getElementById('coords-toggle');
    const possibleMovesToggle = document.getElementById('possible-moves-toggle');
    const lastMoveToggle = document.getElementById('last-move-toggle');
    const soundToggle = document.getElementById('sound-toggle');
    const body = document.body;
    const rootStyle = document.documentElement.style;

    // Storage can be blocked by the browser; settings then fall back to defaults
    const readSetting = (key) => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    };
    const writeSetting = (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Setting still applies for this visit; it just is not remembered
        }
    };

    // Load saved settings or set defaults
    const KEYS = CONFIG.STORAGE_KEYS;
    const DEFAULTS = CONFIG.DEFAULT_SETTINGS;
    const readFlag = (key, fallback) => {
        const saved = readSetting(key);
        return saved === null ? fallback : saved === 'true';
    };
    const showCoords = readFlag(KEYS.SHOW_COORDINATES, DEFAULTS.SHOW_COORDINATES);
    const showPossibleMoves = readFlag(KEYS.SHOW_POSSIBLE_MOVES, DEFAULTS.SHOW_POSSIBLE_MOVES);
    const showLastMove = readFlag(KEYS.SHOW_LAST_MOVE, DEFAULTS.SHOW_LAST_MOVE);
    const enableSounds = readFlag(KEYS.ENABLE_SOUNDS, DEFAULTS.ENABLE_SOUNDS);

    // Apply Coordinate setting
    if (coordsToggle) {
        coordsToggle.checked = showCoords;
        if (showCoords) {
            body.classList.add('coords-visible');
        }
        coordsToggle.addEventListener('change', function() {
            if (this.checked) {
                body.classList.add('coords-visible');
                writeSetting(KEYS.SHOW_COORDINATES, 'true');
            } else {
                body.classList.remove('coords-visible');
                writeSetting(KEYS.SHOW_COORDINATES, 'false');
            }
        });
    }

    // Apply Possible Moves setting
    if (possibleMovesToggle) {
        possibleMovesToggle.checked = showPossibleMoves;
        rootStyle.setProperty('--show-possible-moves', showPossibleMoves ? 'block' : 'none');

        possibleMovesToggle.addEventListener('change', function() {
            const displayValue = this.checked ? 'block' : 'none';
            rootStyle.setProperty('--show-possible-moves', displayValue);
            writeSetting(KEYS.SHOW_POSSIBLE_MOVES, this.checked.toString());
        });
    }

    // Apply Last Move setting
    if (lastMoveToggle) {
        lastMoveToggle.checked = showLastMove;
        rootStyle.setProperty('--show-last-move', showLastMove ? 'block' : 'none');

        lastMoveToggle.addEventListener('change', function() {
            const displayValue = this.checked ? 'block' : 'none';
            rootStyle.setProperty('--show-last-move', displayValue);
            writeSetting(KEYS.SHOW_LAST_MOVE, this.checked.toString());
        });
    }

    // Apply Sound setting
    if (soundToggle) {
        soundToggle.checked = enableSounds;
        CONFIG.FEATURES.SOUND_EFFECTS = enableSounds;
        soundToggle.addEventListener('change', function() {
            CONFIG.FEATURES.SOUND_EFFECTS = this.checked;
            writeSetting(KEYS.ENABLE_SOUNDS, this.checked.toString());
        });
    }

    // Apply Flip Board setting
    const flipToggle = document.getElementById('flip-toggle');
    if (flipToggle) {
        const flipBoard = readFlag(KEYS.FLIP_BOARD, DEFAULTS.FLIP_BOARD);
        flipToggle.checked = flipBoard;
        setBoardFlipped(flipBoard);
        flipToggle.addEventListener('change', function() {
            setBoardFlipped(this.checked);
            writeSetting(KEYS.FLIP_BOARD, this.checked.toString());
        });
    }

    // Apply the opponent settings
    const opponentSelect = document.getElementById('opponent-select');
    const sideSelect = document.getElementById('side-select');
    if (opponentSelect && sideSelect) {
        const opponentSetting = document.getElementById('opponent-setting');
        const sideSetting = document.getElementById('side-setting');
        if (!CONFIG.FEATURES.AI_OPPONENT) {
            if (opponentSetting) opponentSetting.hidden = true;
            if (sideSetting) sideSetting.hidden = true;
        } else {
            const levels = Array.from(opponentSelect.options).map(option => option.value);
            const savedOpponent = readSetting(KEYS.OPPONENT);
            opponentSelect.value = levels.includes(savedOpponent) ? savedOpponent : DEFAULTS.OPPONENT;
            sideSelect.value = (readSetting(KEYS.PLAYER_SIDE) || DEFAULTS.PLAYER_SIDE) === 'b' ? 'b' : 'w';

            const applyOpponent = () => {
                const againstComputer = opponentSelect.value !== 'human';
                if (sideSetting) sideSetting.hidden = !againstComputer; // Only matters against the computer
                setOpponent(againstComputer ? opponentSelect.value : null, sideSelect.value);
            };
            opponentSelect.addEventListener('change', () => {
                writeSetting(KEYS.OPPONENT, opponentSelect.value);
                applyOpponent();
            });
            sideSelect.addEventListener('change', () => {
                writeSetting(KEYS.PLAYER_SIDE, sideSelect.value);
                applyOpponent();
            });
            applyOpponent();
        }
    }

    // --- Initialize Game ---
    initializeGame();
    
    // --- Initialize Feature Modules ---
    initializeFeatureModules();
}); 

/**
 * Initialize optional feature modules based on feature flags.
 * Drag and drop is the only one that needs starting; the promotion chooser and
 * the computer opponent are started by game.js when they are needed.
 */
function initializeFeatureModules() {
    debugLog('Initializing optional feature modules...');
    
    // Initialize drag and drop if enabled
    if (CONFIG.FEATURES.DRAG_AND_DROP && typeof window.initDragAndDrop === 'function') {
        debugLog('Initializing drag and drop feature');
        window.initDragAndDrop();
    }
} 