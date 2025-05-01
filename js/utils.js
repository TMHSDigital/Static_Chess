/**
 * @fileoverview Utility functions for the chess game.
 */

/**
 * Converts algebraic notation (e.g., "e4") to board coordinates.
 * @param {string} algebraic - The algebraic notation (e.g., "a1", "h8").
 * @returns {{row: number, col: number} | null} The 0-indexed row and column, or null if invalid.
 */
function algebraicToCoords(algebraic) {
    if (typeof algebraic !== 'string' || algebraic.length !== 2) {
        console.error("Invalid algebraic notation:", algebraic);
        return null;
    }
    const file = algebraic[0].toLowerCase();
    const rank = algebraic[1];

    const col = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(rank, 10);

    if (col < 0 || col > 7 || isNaN(row) || row < 0 || row > 7) {
        console.error("Invalid algebraic notation coordinates:", algebraic);
        return null;
    }

    return { row, col };
}

/**
 * Converts board coordinates (0-indexed) to algebraic notation.
 * @param {number} row - The 0-indexed row.
 * @param {number} col - The 0-indexed column.
 * @returns {string | null} The algebraic notation (e.g., "a1", "h8"), or null if invalid.
 */
function coordsToAlgebraic(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) {
        console.error("Invalid coordinates:", { row, col });
        return null;
    }
    const file = String.fromCharCode('a'.charCodeAt(0) + col);
    const rank = (8 - row).toString();
    return file + rank;
}

/**
 * Checks if coordinates are within the board bounds.
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
function isWithinBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

/**
 * Creates a deep clone of an object or array.
 * @param {object|array} source - The source object or array to clone.
 * @returns {object|array} A deep clone of the source.
 */
function deepClone(source) {
    if (source === null || typeof source !== 'object') {
        return source;
    }
    
    // Handle Date
    if (source instanceof Date) {
        return new Date(source.getTime());
    }
    
    // Handle Array
    if (Array.isArray(source)) {
        return source.map(item => deepClone(item));
    }
    
    // Handle Object
    const clone = {};
    Object.keys(source).forEach(key => {
        clone[key] = deepClone(source[key]);
    });
    
    return clone;
}

/**
 * Save data to localStorage with error handling.
 * @param {string} key - The key to store under.
 * @param {any} data - Data to store (will be JSON serialized).
 * @returns {boolean} True if successful, false if failed.
 */
function saveToLocalStorage(key, data) {
    try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        return true;
    } catch (err) {
        console.error('Error saving to localStorage:', err);
        return false;
    }
}

/**
 * Load data from localStorage with error handling.
 * @param {string} key - The key to retrieve.
 * @param {any} defaultValue - Default value if key doesn't exist or error occurs.
 * @returns {any} The retrieved data or defaultValue.
 */
function loadFromLocalStorage(key, defaultValue = null) {
    try {
        const serialized = localStorage.getItem(key);
        if (serialized === null) {
            return defaultValue;
        }
        return JSON.parse(serialized);
    } catch (err) {
        console.error('Error loading from localStorage:', err);
        return defaultValue;
    }
}

/**
 * Format a move in Standard Algebraic Notation (SAN).
 * This is a simplified version - future enhancements will make this more complete.
 * @param {object} move - The move object with from, to, piece, etc.
 * @param {boolean} isCheck - Whether the move results in check.
 * @param {boolean} isCheckmate - Whether the move results in checkmate.
 * @returns {string} The move in SAN format.
 */
function formatSAN(move, isCheck = false, isCheckmate = false) {
    if (!move) return '';
    
    const piece = move.piece;
    
    // Special case for castling
    if (move.isCastling) {
        return move.isKingsideCastling ? 'O-O' : 'O-O-O';
    }
    
    // Piece letter (uppercase) - omit for pawns
    let notation = '';
    if (piece.type !== 'p') {
        notation += piece.type.toUpperCase();
    }
    
    // Add 'x' for captures
    if (move.isCapture) {
        // If pawn, add file of origin
        if (piece.type === 'p') {
            notation += coordsToAlgebraic(move.from.row, move.from.col)[0];
        }
        notation += 'x';
    }
    
    // Add destination square
    notation += coordsToAlgebraic(move.to.row, move.to.col);
    
    // Add promotion piece
    if (move.promotion) {
        notation += '=' + move.promotion.toUpperCase();
    }
    
    // Add check/checkmate symbol
    if (isCheckmate) {
        notation += '#';
    } else if (isCheck) {
        notation += '+';
    }
    
    return notation;
}

/**
 * Creates a sound effect for a chess move.
 * Will be used when sound effects feature is enabled.
 * @param {string} soundType - Type of sound ('move', 'capture', 'check', etc.)
 */
function playSound(soundType) {
    if (!CONFIG.FEATURES.SOUND_EFFECTS) return;
    
    const soundPath = CONFIG.ASSETS.SOUNDS[soundType.toUpperCase()];
    if (!soundPath) return;
    
    try {
        const sound = new Audio(soundPath);
        sound.volume = 0.5; // 50% volume
        sound.play().catch(err => {
            // Handle autoplay restrictions gracefully
            console.log('Sound playback prevented:', err);
        });
    } catch (err) {
        console.error('Error playing sound:', err);
    }
}

/**
 * Get the opposite color.
 * @param {string} color - 'w' for white or 'b' for black.
 * @returns {string} The opposite color ('w' or 'b').
 */
function getOppositeColor(color) {
    return color === WHITE ? BLACK : WHITE;
}

/**
 * Debug logging function that only logs when debug mode is enabled.
 * @param {...any} args - Arguments to log.
 */
function debugLog(...args) {
    if (CONFIG.DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Add more utility functions as needed, e.g.,
// - Deep cloning objects/arrays
// - Formatting move history entries 