/**
 * @fileoverview Manages the chessboard DOM representation and rendering.
 */

const boardElement = document.getElementById('chess-board');
let selectedSquare = null; // { row: number, col: number } | null
let possibleMoves = []; // Array<{ row: number, col: number }>

/**
 * Creates the initial chessboard squares in the DOM.
 */
function createBoard() {
    boardElement.innerHTML = ''; // Clear existing board
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;
            boardElement.appendChild(square);
        }
    }
}

/**
 * Renders the pieces on the board based on the current board state.
 * @param {Array<Array<Piece|null>>} boardState - The 2D array representing the board.
 */
function renderPieces(boardState) {
    // Clear existing pieces first
    document.querySelectorAll('.piece').forEach(p => p.remove());

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece) {
                const squareElement = getSquareElement(row, col);
                if (squareElement) {
                    const pieceElement = document.createElement('div');
                    pieceElement.classList.add('piece', piece.color, piece.type);
                    // Add data attributes for easier identification if needed
                    pieceElement.dataset.piece = `${piece.color}${piece.type}`;
                    squareElement.appendChild(pieceElement);
                }
            }
        }
    }
}

/**
 * Gets the DOM element for a specific square.
 * @param {number} row
 * @param {number} col
 * @returns {HTMLElement | null}
 */
function getSquareElement(row, col) {
    return boardElement.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
}

/**
 * Updates the visual state of the board (selection, possible moves, checks).
 * @param {Array<Array<Piece|null>>} boardState - Current board state.
 * @param {{row: number, col: number} | null} kingInCheckCoords - Coordinates of the king in check, or null.
 */
function updateBoardVisuals(boardState, kingInCheckCoords = null) {
    // Clear previous visual states
    document.querySelectorAll('.square.selected, .square.possible-move, .square.in-check').forEach(el => {
        el.classList.remove('selected', 'possible-move', 'in-check');
    });

    // Highlight selected square
    if (selectedSquare) {
        const selectedElement = getSquareElement(selectedSquare.row, selectedSquare.col);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
    }

    // Highlight possible moves
    possibleMoves.forEach(move => {
        const moveElement = getSquareElement(move.row, move.col);
        if (moveElement) {
            moveElement.classList.add('possible-move');
        }
    });

    // Highlight king in check
    if (kingInCheckCoords) {
        const checkElement = getSquareElement(kingInCheckCoords.row, kingInCheckCoords.col);
        if (checkElement) {
            checkElement.classList.add('in-check');
        }
    }

    // Re-render pieces to ensure they are on top of highlights if needed
    // (Commented out for performance, only needed if highlights obscure pieces)
    // renderPieces(boardState);
}

/**
 * Handles click events on the board.
 * @param {Event} event
 * @param {Function} handleSquareClickCallback - Callback function from game.js to handle logic.
 */
function delegateBoardClick(event, handleSquareClickCallback) {
    const target = event.target;
    const squareElement = target.closest('.square');

    if (squareElement) {
        const row = parseInt(squareElement.dataset.row, 10);
        const col = parseInt(squareElement.dataset.col, 10);
        handleSquareClickCallback(row, col);
    }
}

/**
 * Selects a square visually and stores its coordinates.
 * @param {number} row
 * @param {number} col
 */
function setSelectedSquare(row, col) {
    selectedSquare = { row, col };
}

/**
 * Clears the selected square.
 */
function clearSelectedSquare() {
    selectedSquare = null;
}

/**
 * Sets the possible moves to be highlighted.
 * @param {Array<{row: number, col: number}>} moves
 */
function setPossibleMoves(moves) {
    possibleMoves = moves;
}

/**
 * Clears the possible moves highlights.
 */
function clearPossibleMoves() {
    possibleMoves = [];
} 