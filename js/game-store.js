/**
 * @fileoverview What the game keeps in the browser's storage: the game being
 * played, so it is there after a reload, and the past games. A value read
 * back is checked before it is handed on. Nothing here touches the DOM or
 * the live game.
 */

const SAVED_GAME_KEY = CONFIG.STORAGE_KEYS.GAME_STATE;
const ARCHIVE_KEY = CONFIG.STORAGE_KEYS.GAME_ARCHIVE;

/**
 * Saves a game. Storage may be blocked or full, which must not stop the game.
 * @param {object} record - The game as validateSavedGame in saved-game.js expects it.
 */
function storeGame(record) {
    if (!writeStored(SAVED_GAME_KEY, JSON.stringify(record))) {
        console.error('The game could not be saved: storage is blocked or full.');
    }
}

/** Removes the saved game. Storage may be unavailable, which must not stop the game. */
function clearStoredGame() {
    removeStored(SAVED_GAME_KEY);
}

/**
 * Reads the saved game. A value that does not pass validation is removed, so
 * the next visit starts afresh too.
 * @returns {object|null} The game as validateSavedGame gives it, or null if
 *   there is none that can be used.
 */
function readStoredGame() {
    const saved = readStored(SAVED_GAME_KEY);
    if (!saved) return null;
    let state = null;
    try {
        state = validateSavedGame(JSON.parse(saved));
    } catch (e) {
        console.error('Error loading game state:', e);
    }
    if (!state) clearStoredGame();
    return state;
}

/**
 * Reads the past games from localStorage. A missing or damaged value gives an
 * empty list, and entries that are not complete are left out.
 * @returns {Array<{pgn: string, result: string, opponent: string, date: string, moves: number}>}
 *   Newest first.
 */
function readArchive() {
    try {
        const saved = JSON.parse(readStored(ARCHIVE_KEY));
        if (!Array.isArray(saved)) return [];
        return saved
            .filter(
                (entry) =>
                    entry &&
                    typeof entry.pgn === 'string' &&
                    typeof entry.result === 'string' &&
                    typeof entry.opponent === 'string' &&
                    typeof entry.date === 'string' &&
                    !Number.isNaN(Date.parse(entry.date)) &&
                    Number.isInteger(entry.moves)
            )
            .slice(0, CONFIG.ARCHIVE_LIMIT);
    } catch {
        return [];
    }
}

/**
 * Puts a game at the top of the past games. Only the newest
 * CONFIG.ARCHIVE_LIMIT games are kept, as PGN text of about a kilobyte each,
 * so the storage quota is not at risk.
 * @param {{pgn: string, result: string, opponent: string, date: string, moves: number}} game
 */
function addToArchive(game) {
    const same = (entry) => pgnMovetext(entry.pgn) === pgnMovetext(game.pgn);
    const archive = readArchive();
    // A game opened from the list and put back keeps its entry instead of appearing twice
    const entry = archive.find(same) || game;
    const updated = [entry, ...archive.filter((past) => !same(past))];
    if (!writeStored(ARCHIVE_KEY, JSON.stringify(updated.slice(0, CONFIG.ARCHIVE_LIMIT)))) {
        console.error('The past games could not be saved: storage is blocked or full.');
    }
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        storeGame,
        clearStoredGame,
        readStoredGame,
        readArchive,
        addToArchive,
    };
}
