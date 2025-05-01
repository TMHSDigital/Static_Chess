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
 * @param {Object|null} movedPiece - Optional. The coordinates of a piece that just moved, for animation.
 */
function renderPieces(boardState, movedPiece = null) {
    // Clear existing pieces first
    document.querySelectorAll('.piece').forEach(p => p.remove());

    // Generate a cache-busting token
    const cacheBuster = Date.now();
    console.log("Rendering pieces with cache buster:", cacheBuster);

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            if (piece) {
                const squareElement = getSquareElement(row, col);
                if (squareElement) {
                    const pieceElement = document.createElement('div');
                    pieceElement.classList.add('piece');
                    
                    // Add piece color and type as classes for potential styling
                    pieceElement.classList.add(piece.color, piece.type);
                    
                    // Use absolute path with cache busting
                    const svgPath = `assets/${piece.color}${piece.type}.svg?v=${cacheBuster}`;
                    console.log(`Setting background for ${piece.color}${piece.type} at [${row},${col}] to: ${svgPath}`);
                    
                    pieceElement.style.backgroundImage = `url('${svgPath}')`;
                    pieceElement.style.backgroundSize = 'contain';
                    pieceElement.style.backgroundRepeat = 'no-repeat';
                    pieceElement.style.backgroundPosition = 'center';
                    
                    // Force image preload to debug loading issues
                    const img = new Image();
                    img.onload = () => console.log(`✓ Successfully loaded: ${svgPath}`);
                    img.onerror = () => console.error(`✗ Failed to load: ${svgPath}`);
                    img.src = svgPath;
                    
                    // Add animation class if this is the piece that just moved
                    if (movedPiece && movedPiece.row === row && movedPiece.col === col) {
                        pieceElement.classList.add('moved');
                        
                        // Remove the animation class after animation completes
                        setTimeout(() => {
                            pieceElement.classList.remove('moved');
                        }, 300); // Match with animation duration
                    }
                    
                    // Add data attributes for easier identification if needed
                    pieceElement.dataset.piece = `${piece.color}${piece.type}`;
                    pieceElement.dataset.color = piece.color;
                    pieceElement.dataset.type = piece.type;
                    
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
    document.querySelectorAll('.square.selected, .square.possible-move, .square.in-check, .square.last-move-from, .square.last-move-to').forEach(el => {
        el.classList.remove('selected', 'possible-move', 'in-check', 'last-move-from', 'last-move-to');
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

    // Highlight last move if available
    if (moveHistory && moveHistory.length > 0) {
        const lastMove = moveHistory[moveHistory.length - 1];
        
        // From square
        const fromElement = getSquareElement(lastMove.from.row, lastMove.from.col);
        if (fromElement) {
            fromElement.classList.add('last-move-from');
        }
        
        // To square
        const toElement = getSquareElement(lastMove.to.row, lastMove.to.col);
        if (toElement) {
            toElement.classList.add('last-move-to');
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