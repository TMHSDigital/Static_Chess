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

    // Storage can be blocked by the browser: a setting then falls back to its
    // default, and a change still applies for this visit without being remembered
    const readSetting = readStored;
    const writeSetting = writeStored;

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
        coordsToggle.addEventListener('change', function () {
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

        possibleMovesToggle.addEventListener('change', function () {
            const displayValue = this.checked ? 'block' : 'none';
            rootStyle.setProperty('--show-possible-moves', displayValue);
            writeSetting(KEYS.SHOW_POSSIBLE_MOVES, this.checked.toString());
        });
    }

    // Apply Last Move setting
    if (lastMoveToggle) {
        lastMoveToggle.checked = showLastMove;
        rootStyle.setProperty('--show-last-move', showLastMove ? 'block' : 'none');

        lastMoveToggle.addEventListener('change', function () {
            const displayValue = this.checked ? 'block' : 'none';
            rootStyle.setProperty('--show-last-move', displayValue);
            writeSetting(KEYS.SHOW_LAST_MOVE, this.checked.toString());
        });
    }

    // Apply Sound setting
    if (soundToggle) {
        soundToggle.checked = enableSounds;
        CONFIG.FEATURES.SOUND_EFFECTS = enableSounds;
        soundToggle.addEventListener('change', function () {
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
        flipToggle.addEventListener('change', function () {
            setBoardFlipped(this.checked);
            writeSetting(KEYS.FLIP_BOARD, this.checked.toString());
        });
    }

    // Apply the board theme. The saved theme is applied even without the selector.
    const boardThemes = CONFIG.BOARD_THEMES;
    const applyBoardTheme = (name) => {
        const theme = boardThemes[name] || boardThemes[DEFAULTS.BOARD_THEME];
        for (const [property, value] of Object.entries(theme.colors)) {
            rootStyle.setProperty(property, value);
        }
    };
    const knownTheme = (name) => Object.prototype.hasOwnProperty.call(boardThemes, name);
    const savedBoardTheme = readSetting(KEYS.BOARD_THEME);
    const boardTheme = knownTheme(savedBoardTheme) ? savedBoardTheme : DEFAULTS.BOARD_THEME;
    applyBoardTheme(boardTheme);
    const boardThemeSelect = document.getElementById('board-theme-select');
    if (boardThemeSelect) {
        for (const [name, theme] of Object.entries(boardThemes)) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = theme.label;
            boardThemeSelect.appendChild(option);
        }
        boardThemeSelect.value = boardTheme;
        boardThemeSelect.addEventListener('change', () => {
            applyBoardTheme(boardThemeSelect.value);
            writeSetting(KEYS.BOARD_THEME, boardThemeSelect.value);
        });
    }

    // Apply the page theme: dark, light, or whichever the system asks for
    const pageThemes = ['dark', 'light', 'auto'];
    const savedPageTheme = readSetting(KEYS.PAGE_THEME);
    const pageTheme = pageThemes.includes(savedPageTheme) ? savedPageTheme : DEFAULTS.PAGE_THEME;
    document.documentElement.dataset.theme = pageTheme;
    const pageThemeSelect = document.getElementById('page-theme-select');
    if (pageThemeSelect) {
        pageThemeSelect.value = pageTheme;
        pageThemeSelect.addEventListener('change', () => {
            document.documentElement.dataset.theme = pageThemeSelect.value;
            writeSetting(KEYS.PAGE_THEME, pageThemeSelect.value);
        });
    }

    // Apply the clock setting. It takes effect from the next new game.
    const clockSelect = document.getElementById('clock-select');
    if (clockSelect) {
        const clockSetting = document.getElementById('clock-setting');
        if (!CONFIG.FEATURES.GAME_TIMER) {
            if (clockSetting) clockSetting.hidden = true;
        } else {
            const controls = CONFIG.TIME_CONTROLS;
            for (const [key, control] of Object.entries(controls)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = control.label;
                clockSelect.appendChild(option);
            }
            const savedControl = readSetting(KEYS.TIME_CONTROL);
            clockSelect.value = Object.prototype.hasOwnProperty.call(controls, savedControl)
                ? savedControl
                : DEFAULTS.TIME_CONTROL;
            setTimeControl(clockSelect.value);
            clockSelect.addEventListener('change', () => {
                writeSetting(KEYS.TIME_CONTROL, clockSelect.value);
                setTimeControl(clockSelect.value);
            });
        }
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
            const levels = Array.from(opponentSelect.options).map((option) => option.value);
            const savedOpponent = readSetting(KEYS.OPPONENT);
            opponentSelect.value = levels.includes(savedOpponent)
                ? savedOpponent
                : DEFAULTS.OPPONENT;
            const sides = Array.from(sideSelect.options).map((option) => option.value);
            const savedSide = readSetting(KEYS.PLAYER_SIDE);
            sideSelect.value = sides.includes(savedSide) ? savedSide : DEFAULTS.PLAYER_SIDE;

            // Sit behind the pieces of a side; "Flip board" can still turn the board afterwards
            const faceSide = (color) => {
                const flipped = color === 'b';
                if (flipToggle) flipToggle.checked = flipped;
                setBoardFlipped(flipped);
                writeSetting(KEYS.FLIP_BOARD, flipped.toString());
            };
            // With "Random" the game draws the side, and the board follows it
            setSideListener(faceSide);

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
                if (sideSelect.value !== 'random') faceSide(sideSelect.value);
                applyOpponent();
            });
            applyOpponent();
        }
    }

    // --- Initialize Game ---
    initializeGame();

    // --- Initialize Feature Modules ---
    initializeFeatureModules();

    // --- A shared link: "#fen=..." or "#pgn=..." ---
    // It goes through the Load dialog, which checks it and asks before a game
    // in progress is replaced. The fragment is then removed, so a reload does
    // not load it again.
    const openSharedLink = () => {
        const text = sharedTextFromHash(window.location.hash);
        if (text === null) return;
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        openSharedText(text);
    };
    openSharedLink();
    window.addEventListener('hashchange', openSharedLink);

    // --- Offline support ---
    // Service workers need http(s); a page opened straight from a file plays without one
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch((error) => {
            debugLog('Service worker not registered:', error);
        });
    }
});

/**
 * Initialize optional feature modules based on feature flags.
 * Drag and drop is the only one that needs starting; the promotion chooser and
 * the computer opponent are started by game.js when they are needed.
 */
function initializeFeatureModules() {
    debugLog('Initializing optional feature modules...');

    // Initialize drag and drop if enabled
    if (CONFIG.FEATURES.DRAG_AND_DROP) {
        debugLog('Initializing drag and drop feature');
        initDragAndDrop({
            isBoardLocked,
            isOwnPiece,
            legalTargets: generateLegalMovesForPiece,
            playMove: playChosenMove,
            refresh: refreshBoardVisuals,
        });
    }
}
