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

// Add more utility functions as needed, e.g.,
// - Deep cloning objects/arrays
// - Formatting move history entries 