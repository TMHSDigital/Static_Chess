/**
 * @fileoverview Checking a saved game read from storage before the game
 * trusts it. Nothing here touches the DOM, storage or the live game: it takes
 * what was parsed and gives back a clean copy, or null.
 */

const SAVED_GAME_VERSION = 1;

// How a game begins unless it is started from another position: White to move, move 1
const STANDARD_START = { player: WHITE, halfmoveClock: 0, fullmove: 1, fen: null };

/** @returns {boolean} True for a {row, col} pair that is on the board. */
function isValidCoords(coords) {
    return (
        !!coords &&
        Number.isInteger(coords.row) &&
        Number.isInteger(coords.col) &&
        isWithinBounds(coords.row, coords.col)
    );
}

/** @returns {boolean} True for an 8x8 board of known pieces with exactly one king per side. */
function isValidBoard(board) {
    if (!Array.isArray(board) || board.length !== 8) return false;
    const types = [PAWN, ROOK, KNIGHT, BISHOP, QUEEN, KING];
    const kings = { [WHITE]: 0, [BLACK]: 0 };
    for (const row of board) {
        if (!Array.isArray(row) || row.length !== 8) return false;
        for (const cell of row) {
            if (cell === null) continue;
            if (typeof cell !== 'object' || !types.includes(cell.type) || !(cell.color in kings))
                return false;
            if (cell.type === KING) kings[cell.color]++;
        }
    }
    return kings[WHITE] === 1 && kings[BLACK] === 1;
}

/** @returns {number} A saved half-move counter, or 0 if it is missing or not a count. */
function cleanClock(value) {
    return Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Finds both kings on a board. */
function findKingPositions(board) {
    const positions = {};
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type === KING) positions[piece.color] = { row: r, col: c };
        }
    }
    return positions;
}

/**
 * Checks a position record read from storage, either the saved game itself or
 * an entry of its undo stack.
 * @param {object} saved
 * @param {string} statusIfMissing - Status line to use when none was saved.
 * @returns {object|null} A record for restoreSnapshot, or null if it cannot be trusted.
 */
function cleanSnapshot(saved, statusIfMissing) {
    if (!saved || typeof saved !== 'object') return null;
    if (!isValidBoard(saved.boardState)) return null;
    if (saved.currentPlayer !== WHITE && saved.currentPlayer !== BLACK) return null;
    const target = saved.enPassantTarget === undefined ? null : saved.enPassantTarget;
    if (target !== null && !isValidCoords(target)) return null;
    return {
        boardState: saved.boardState,
        currentPlayer: saved.currentPlayer,
        isGameOver: !!saved.isGameOver,
        kingPositions: findKingPositions(saved.boardState),
        currentStatus:
            typeof saved.currentStatus === 'string' ? saved.currentStatus : statusIfMissing,
        enPassantTarget: target,
        halfmoveClock: cleanClock(saved.halfmoveClock),
    };
}

/**
 * Checks a parsed saved game and returns a clean state object, or null if it
 * cannot be trusted. Nothing in the live game is touched here.
 */
function validateSavedGame(saved) {
    if (!saved || typeof saved !== 'object') return null;
    if (saved.version !== undefined && saved.version !== SAVED_GAME_VERSION) return null;
    const position = cleanSnapshot(saved, 'Game loaded');
    if (!position) return null;

    const history = saved.moveHistory === undefined ? [] : saved.moveHistory;
    if (!Array.isArray(history)) return null;
    for (const move of history) {
        if (
            !move ||
            !isValidCoords(move.from) ||
            !isValidCoords(move.to) ||
            typeof move.notation !== 'string'
        ) {
            return null;
        }
    }

    // The undo stack is optional: saves from older versions do not have one.
    // If it is missing or damaged the game still loads, with nothing to undo.
    let undoStack = [];
    if (Array.isArray(saved.positionHistory) && saved.positionHistory.length === history.length) {
        const snapshots = saved.positionHistory.map((entry) =>
            entry && entry.enPassantTarget !== undefined ? cleanSnapshot(entry, '') : null
        );
        if (snapshots.every(Boolean)) undoStack = snapshots;
    }

    // Saves from before results were stored: work the result out from the last move
    const over = position.isGameOver;
    let result = null;
    if (over) {
        const last = history[history.length - 1];
        if (['1-0', '0-1', '1/2-1/2'].includes(saved.gameResult)) result = saved.gameResult;
        else if (last && last.isCheckmate) result = saved.currentPlayer === WHITE ? '0-1' : '1-0';
        else result = '1/2-1/2';
    }

    // The clock is optional; a damaged one is dropped and the game goes on without
    let savedClock = null;
    const c = saved.clock;
    const isTime = (value) => Number.isFinite(value) && value >= 0;
    if (
        c &&
        typeof c === 'object' &&
        c.remaining &&
        [c.base, c.increment, c.remaining[WHITE], c.remaining[BLACK]].every(isTime)
    ) {
        savedClock = {
            control: typeof c.control === 'string' ? c.control : '',
            base: c.base,
            increment: c.increment,
            remaining: { [WHITE]: c.remaining[WHITE], [BLACK]: c.remaining[BLACK] },
            turnStartedAt: c.running === true && !over ? Date.now() : null,
        };
    }

    // How the game began is optional: saves from older versions began in the usual way
    const begun = saved.gameStart;
    const start =
        begun &&
        typeof begun === 'object' &&
        (begun.player === WHITE || begun.player === BLACK) &&
        Number.isInteger(begun.fullmove) &&
        begun.fullmove >= 1
            ? {
                  player: begun.player,
                  halfmoveClock: cleanClock(begun.halfmoveClock),
                  fullmove: begun.fullmove,
                  fen: typeof begun.fen === 'string' ? begun.fen : null,
              }
            : STANDARD_START;

    // Who played is optional: saves from older versions name the players from the settings
    const p = saved.players;
    let players = null;
    if (p && typeof p === 'object') {
        if (p.computer === null && p.level === null) players = { level: null, computer: null };
        else if (
            (p.computer === WHITE || p.computer === BLACK) &&
            typeof p.level === 'string' &&
            /^[a-z]{1,16}$/.test(p.level)
        ) {
            players = { level: p.level, computer: p.computer };
        }
    }

    return {
        ...position,
        gameStart: start,
        clock: savedClock,
        gameResult: result,
        endedWithoutMove: over && saved.endedWithoutMove === true,
        players,
        moveHistory: history,
        positionHistory: undoStack,
    };
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SAVED_GAME_VERSION,
        STANDARD_START,
        isValidCoords,
        isValidBoard,
        cleanClock,
        findKingPositions,
        cleanSnapshot,
        validateSavedGame,
    };
}
