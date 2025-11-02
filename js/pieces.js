/**
 * @fileoverview Defines chess pieces and their basic movement rules.
 */

// Piece Types (use constants for clarity)
const PAWN = 'p';
const ROOK = 'r';
const KNIGHT = 'n';
const BISHOP = 'b';
const QUEEN = 'q';
const KING = 'k';

// Colors
const WHITE = 'w';
const BLACK = 'b';

/**
 * Represents a chess piece.
 * @param {string} type - Piece type (e.g., PAWN, ROOK).
 * @param {string} color - Piece color (WHITE or BLACK).
 */
function Piece(type, color) {
    this.type = type;
    this.color = color;
    this.hasMoved = false; // Important for castling and pawn double moves
}

/**
 * Checks if a move is valid for a specific piece type, considering only
 * the piece's movement rules and the start/end squares.
 * Does NOT consider board state (other pieces, checks, etc.) yet.
 *
 * @param {Piece} piece - The piece being moved.
 * @param {number} startRow - The starting row (0-indexed).
 * @param {number} startCol - The starting column (0-indexed).
 * @param {number} endRow - The ending row (0-indexed).
 * @param {number} endCol - The ending column (0-indexed).
 * @param {boolean} isCapture - Whether the move is a capture.
 * @returns {boolean} True if the move is potentially valid according to piece rules.
 */
function isPseudoLegalMove(piece, startRow, startCol, endRow, endCol, isCapture) {
    if (!isWithinBounds(endRow, endCol)) return false;
    if (startRow === endRow && startCol === endCol) return false; // Cannot move to the same square

    const rowDiff = endRow - startRow;
    const colDiff = endCol - startCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);

    switch (piece.type) {
        case PAWN: {
            const direction = piece.color === WHITE ? -1 : 1;

            if (isCapture) {
                // Capture diagonally one square forward
                return rowDiff === direction && absColDiff === 1;
            } else {
                // Move forward one square
                if (rowDiff === direction && colDiff === 0) return true;
                // Move forward two squares from starting position
                if (!piece.hasMoved && rowDiff === 2 * direction && colDiff === 0) {
                    return (piece.color === WHITE && startRow === 6) || (piece.color === BLACK && startRow === 1);
                }
            }
            return false;
        }

        case ROOK:
            // Move horizontally or vertically
            return (absRowDiff > 0 && absColDiff === 0) || (absRowDiff === 0 && absColDiff > 0);

        case KNIGHT:
            // L-shape move
            return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);

        case BISHOP:
            // Move diagonally
            return absRowDiff === absColDiff;

        case QUEEN:
            // Move like a rook or bishop
            return (absRowDiff > 0 && absColDiff === 0) || (absRowDiff === 0 && absColDiff > 0) || (absRowDiff === absColDiff);

        case KING:
            // Move one square in any direction
            // Basic castling check (will need more validation in game.js)
            if (absColDiff === 2 && absRowDiff === 0 && !piece.hasMoved) {
                 return true; // Potential castle
            }
            return absRowDiff <= 1 && absColDiff <= 1;

        default:
            console.error("Unknown piece type:", piece.type);
            return false;
    }
}

// Add functions here for special moves like en passant, promotion, castling checks
// These often require board state, so might live partially in game.js or be passed board state.

/**
 * Gets the initial piece setup for a standard chess game.
 * @returns {Array<Array<Piece|null>>} A 2D array representing the board state.
 */
function getInitialPieces() {
    console.log("Initializing pieces...");
    const board = Array(8).fill(null).map(() => Array(8).fill(null));

    // Place pawns
    for (let col = 0; col < 8; col++) {
        board[1][col] = new Piece(PAWN, BLACK);
        board[6][col] = new Piece(PAWN, WHITE);
        console.log(`Created pawns at: [1,${col}] (Black) and [6,${col}] (White)`);
    }

    // Place other pieces
    const backRank = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];
    for (let col = 0; col < 8; col++) {
        board[0][col] = new Piece(backRank[col], BLACK);
        board[7][col] = new Piece(backRank[col], WHITE);
        console.log(`Created ${backRank[col]} at: [0,${col}] (Black) and [7,${col}] (White)`);
    }

    // Log the first row to validate
    console.log("First row (black pieces):", board[0].map(p => p ? p.type : 'null'));
    console.log("Last row (white pieces):", board[7].map(p => p ? p.type : 'null'));

    return board;
} 