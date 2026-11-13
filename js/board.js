/**
 * @fileoverview Manages the chessboard DOM representation and rendering.
 */

const boardElement = document.getElementById('chess-board');
let selectedSquare = null; // { row: number, col: number } | null
let possibleMoves = []; // Array<{ row: number, col: number }>
let renderedState = null; // Cache of last rendered board signatures
let boardFlipped = false; // True when the board is shown from Black's side

/**
 * Creates the initial chessboard squares in the DOM.
 */
function createBoard() {
    boardElement.innerHTML = ''; // Clear existing board
    renderedState = null; // Reset render cache
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;
            square.setAttribute('role', 'gridcell');
            square.setAttribute('tabindex', '0');
            boardElement.appendChild(square);
        }
    }

    if (boardFlipped) {
        setBoardFlipped(true); // Keep the chosen orientation when the board is rebuilt
    }

    // Keyboard navigation for accessibility
    boardElement.removeEventListener('keydown', handleBoardKeydown);
    boardElement.addEventListener('keydown', handleBoardKeydown);
}

/**
 * Shows the board from White's side (default) or from Black's side.
 * Squares keep their data-row and data-col; only their order on screen changes,
 * so pieces, highlights and coordinate labels follow automatically.
 * @param {boolean} flipped - True to put Black at the bottom.
 */
function setBoardFlipped(flipped) {
    boardFlipped = !!flipped;
    boardElement.classList.toggle('flipped', boardFlipped);
    const index = (square) => Number(square.dataset.row) * 8 + Number(square.dataset.col);
    Array.from(boardElement.querySelectorAll('.square'))
        .sort((a, b) => (boardFlipped ? index(b) - index(a) : index(a) - index(b)))
        .forEach(square => boardElement.appendChild(square));
}

/**
 * Renders the pieces on the board based on the current board state.
 * @param {Array<Array<Piece|null>>} boardState - The 2D array representing the board.
 * @param {Object|null} movedPiece - Optional. The coordinates of a piece that just moved, for animation.
 */
function renderPieces(boardState, movedPiece = null) {
    const sig = (p) => (p ? `${p.color}${p.type}` : null);

    // First-time render: build all
    if (!renderedState) {
        renderedState = Array.from({ length: 8 }, () => Array(8).fill(null));
    }

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = boardState[row][col];
            const newSig = sig(piece);
            const oldSig = renderedState[row][col];
            const squareElement = getSquareElement(row, col);

            if (squareElement) {
                const alg = coordsToAlgebraic(row, col);
                const label = piece ? `${piece.color === 'w' ? 'white' : 'black'} ${piece.type} on ${alg}` : `${alg}`;
                squareElement.setAttribute('aria-label', label);
            }

            if (newSig === oldSig) continue; // no change

            // Remove existing piece child
            if (squareElement) {
                const existing = squareElement.querySelector('.piece');
                if (existing) existing.remove();
            }

            if (piece && squareElement) {
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece');
                pieceElement.classList.add(piece.color, piece.type);
                const svgPath = `assets/${piece.color}${piece.type}.svg`;
                pieceElement.style.backgroundImage = `url('${svgPath}')`;
                pieceElement.style.backgroundSize = 'contain';
                pieceElement.style.backgroundRepeat = 'no-repeat';
                pieceElement.style.backgroundPosition = 'center';

                if (movedPiece && movedPiece.row === row && movedPiece.col === col) {
                    pieceElement.classList.add('moved');
                    setTimeout(() => pieceElement.classList.remove('moved'), CONFIG.ANIMATIONS.PIECE_MOVE);
                }

                pieceElement.dataset.piece = `${piece.color}${piece.type}`;
                pieceElement.dataset.color = piece.color;
                pieceElement.dataset.type = piece.type;
                squareElement.appendChild(pieceElement);
            }

            renderedState[row][col] = newSig;
        }
    }
}

/**
 * Handle keyboard navigation and activation on the board
 * Arrow keys move focus; Enter/Space activates (simulates click)
 * @param {KeyboardEvent} event
 */
function handleBoardKeydown(event) {
    const active = document.activeElement;
    if (!active || !active.classList.contains('square')) return;

    const row = parseInt(active.dataset.row, 10);
    const col = parseInt(active.dataset.col, 10);

    const focusSquare = (r, c) => {
        const el = getSquareElement(Math.max(0, Math.min(7, r)), Math.max(0, Math.min(7, c)));
        if (el) el.focus();
    };

    // Arrow keys follow what is on screen, so they reverse on a flipped board
    const step = boardFlipped ? -1 : 1;

    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            focusSquare(row - step, col);
            break;
        case 'ArrowDown':
            event.preventDefault();
            focusSquare(row + step, col);
            break;
        case 'ArrowLeft':
            event.preventDefault();
            focusSquare(row, col - step);
            break;
        case 'ArrowRight':
            event.preventDefault();
            focusSquare(row, col + step);
            break;
        case 'Enter':
        case ' ': // Space
            event.preventDefault();
            active.click();
            break;
        default:
            break;
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

// Expose board functions and state globally for drag.js and other modules
if (typeof window !== 'undefined') {
    window.clearSelectedSquare = clearSelectedSquare;
    window.clearPossibleMoves = clearPossibleMoves;
    window.setSelectedSquare = setSelectedSquare;
    window.setPossibleMoves = setPossibleMoves;
    window.updateBoardVisuals = updateBoardVisuals;
    window.setBoardFlipped = setBoardFlipped;
    // Expose state getters
    Object.defineProperty(window, 'selectedSquare', {
        get: function() { return selectedSquare; }
    });
    Object.defineProperty(window, 'possibleMoves', {
        get: function() { return possibleMoves; }
    });
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        boardElement,
        createBoard,
        renderPieces,
        getSquareElement,
        updateBoardVisuals,
        setSelectedSquare,
        clearSelectedSquare,
        setPossibleMoves,
        clearPossibleMoves,
        setBoardFlipped,
        // Export state variables with getters for test access
        get selectedSquare() { return selectedSquare; },
        get possibleMoves() { return possibleMoves; },
        get renderedState() { return renderedState; }
    };
} 