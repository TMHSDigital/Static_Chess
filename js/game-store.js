/**
 * @fileoverview What the game keeps in the browser's storage: the game being
 * played, so it is there after a reload, and the past games. A value read
 * back is checked before it is handed on. Nothing here touches the DOM or
 * the live game.
 */

const SAVED_GAME_KEY = CONFIG.STORAGE_KEYS.GAME_STATE;
const ARCHIVE_KEY = CONFIG.STORAGE_KEYS.GAME_ARCHIVE;

// The saved game as this page last wrote or read it. Anything else found
// under the key was written by the game open in another tab.
let lastStoredGame = null;

/**
 * Saves a game. Storage may be blocked or full, which must not stop the game.
 * @param {object} record - The game as validateSavedGame in saved-game.js expects it.
 */
function storeGame(record) {
    const text = JSON.stringify(record);
    if (!writeStored(SAVED_GAME_KEY, text)) {
        console.error('The game could not be saved: storage is blocked or full.');
        return;
    }
    lastStoredGame = text;
}

/** Removes the saved game. Storage may be unavailable, which must not stop the game. */
function clearStoredGame() {
    removeStored(SAVED_GAME_KEY);
    lastStoredGame = null;
}

/**
 * Reads the saved game if another tab has written it since this page last
 * wrote or read it, so that game can be kept before this one is saved over it.
 * @returns {object|null} The game as validateSavedGame gives it, or null if
 *   the saved game is this page's own, or none that can be used.
 */
function readGameSavedElsewhere() {
    const saved = readStored(SAVED_GAME_KEY);
    return saved && saved !== lastStoredGame ? readStoredGame() : null;
}

/**
 * Reads the saved game. A value that does not pass validation is removed, so
 * the next visit starts afresh too.
 * @returns {object|null} The game as validateSavedGame gives it, or null if
 *   there is none that can be used.
 */
function readStoredGame() {
    const saved = readStored(SAVED_GAME_KEY);
    lastStoredGame = saved;
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
 * @param {string|null} [openedFrom] - The date of the entry the game was opened
 *   from, if it was. That entry is replaced instead of the game appearing twice:
 *   kept as it was if the game is unchanged, else updated under its own date.
 *   Other games with the same moves are separate games and are kept.
 */
function addToArchive(game, openedFrom = null) {
    const archive = readArchive();
    const own = openedFrom === null ? -1 : archive.findIndex((past) => past.date === openedFrom);
    let entry = game;
    if (own !== -1) {
        const original = archive[own];
        const unchanged = pgnMovetext(original.pgn) === pgnMovetext(game.pgn);
        entry = unchanged ? original : { ...game, date: original.date };
        archive.splice(own, 1);
    }
    const updated = [entry, ...archive];
    if (!writeStored(ARCHIVE_KEY, JSON.stringify(updated.slice(0, CONFIG.ARCHIVE_LIMIT)))) {
        console.error('The past games could not be saved: storage is blocked or full.');
    }
}

/**
 * Finds a past game in the list as it is now, which another tab may have
 * changed since the list was shown.
 * @param {number} index - Its place in the list as shown, newest first.
 * @param {string} [date] - Its date, which names it. Without one, the place alone decides.
 * @returns {number} Its place in the list readArchive gives now, or -1 if it is gone.
 */
function findInArchive(index, date) {
    const archive = readArchive();
    const shown = Number.isInteger(index) && index >= 0 && index < archive.length;
    if (date === undefined) return shown ? index : -1;
    if (shown && archive[index].date === date) return index;
    return archive.findIndex((entry) => entry.date === date);
}

/**
 * Removes one past game.
 * @param {number} index - Its place in the list as shown, newest first.
 * @param {string} [date] - Its date, so the right game goes even if the list changed.
 * @returns {boolean} False if there was no such game or storage could not be written.
 */
function removeFromArchive(index, date) {
    const archive = readArchive();
    const at = findInArchive(index, date);
    if (at === -1) return false;
    archive.splice(at, 1);
    return writeStored(ARCHIVE_KEY, JSON.stringify(archive));
}

/** Removes every past game. Storage may be unavailable, which must not stop the game. */
function clearArchive() {
    removeStored(ARCHIVE_KEY);
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        storeGame,
        clearStoredGame,
        readStoredGame,
        readGameSavedElsewhere,
        readArchive,
        addToArchive,
        findInArchive,
        removeFromArchive,
        clearArchive,
    };
}
