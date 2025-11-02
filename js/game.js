/**
 * @fileoverview Manages the core chess game logic, state, and rules.
 */

let boardState = getInitialPieces();
let currentPlayer = WHITE;
let moveHistory = []; // Array of move objects { from: {row, col}, to: {row, col}, piece: Piece, captured: Piece|null }
let isGameOver = false;
let kingPositions = { // Keep track of king positions for check detection
    [WHITE]: { row: 7, col: 4 },
    [BLACK]: { row: 0, col: 4 }
};
let currentStatus = "White's turn";
let enPassantTarget = null; // Stores coords {row, col} of square vulnerable to en passant, or null
let positionHistory = []; // For undo and repetition detection

const moveHistoryElement = document.getElementById('move-history');
const gameStatusElement = document.getElementById('game-status');
const resetButton = document.getElementById('reset-button');
const undoButton = document.getElementById('undo-button');

/**
 * Initializes the game state, either from scratch or localStorage.
 */
function initializeGame() {
    loadGameState(); // Try loading saved state first
    if (moveHistory.length === 0) { // If no saved state or new game
        resetGame();
    }
    createBoard();
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState, findKingInCheck(currentPlayer));

    // Add event listener for board clicks (delegated)
    boardElement.removeEventListener('click', handleBoardClickEvent);
    boardElement.addEventListener('click', handleBoardClickEvent);

    // Add event listener for reset button
    resetButton.removeEventListener('click', resetGame);
    resetButton.addEventListener('click', resetGame);

    // Add event listener for undo button
    if (undoButton) {
        undoButton.removeEventListener('click', undoLastMove);
        undoButton.addEventListener('click', undoLastMove);
    }

    console.log("Game initialized.");
}

/**
 * Event handler for board clicks, delegates to handleBoardClick function
 * @param {Event} event - The click event
 */
function handleBoardClickEvent(event) {
    const target = event.target;
    const squareElement = target.closest('.square');
    
    if (squareElement) {
        const row = parseInt(squareElement.dataset.row, 10);
        const col = parseInt(squareElement.dataset.col, 10);
        handleBoardClick(row, col);
    }
}

/**
 * Resets the game to the initial state.
 */
function resetGame() {
    console.log("Resetting game...");
    boardState = getInitialPieces();
    currentPlayer = WHITE;
    moveHistory = [];
    isGameOver = false;
    kingPositions = {
        [WHITE]: { row: 7, col: 4 },
        [BLACK]: { row: 0, col: 4 }
    };
    currentStatus = "White's turn";
    enPassantTarget = null;
    positionHistory = [];
    clearSelectedSquare();
    clearPossibleMoves();
    localStorage.removeItem('chessGameState'); // Clear saved state
    // Re-render board and pieces
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState);
}

/**
 * Handles clicks on the board squares.
 * @param {number} row
 * @param {number} col
 */
function handleBoardClick(row, col) {
    if (isGameOver) return; // Don't allow moves if game is over

    const clickedPiece = boardState[row][col];

    if (selectedSquare) {
        // Attempting to make a move
        const move = {
            from: selectedSquare,
            to: { row, col }
        };

        // Check if the destination is a valid possible move
        const isPossible = possibleMoves.some(pm => pm.row === row && pm.col === col);

        if (isPossible) {
            makeMove(move.from.row, move.from.col, move.to.row, move.to.col);
        }
        // Always clear selection and possible moves after trying to move or clicking elsewhere
        clearSelectedSquare();
        clearPossibleMoves();
        updateBoardVisuals(boardState, findKingInCheck(currentPlayer));

    } else if (clickedPiece && clickedPiece.color === currentPlayer) {
        // Selecting a piece of the current player
        setSelectedSquare(row, col);
        const moves = generateLegalMovesForPiece(row, col);
        setPossibleMoves(moves);
        updateBoardVisuals(boardState, findKingInCheck(currentPlayer));
    }
}

/**
 * Executes a move, updates the board state, and checks game status.
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 */
function makeMove(startRow, startCol, endRow, endCol) {
    const pieceToMove = boardState[startRow][startCol];
    if (!pieceToMove) return; // Should not happen if logic is correct

    const capturedPiece = boardState[endRow][endCol];
    const move = {
        from: { row: startRow, col: startCol },
        to: { row: endRow, col: endCol },
        piece: pieceToMove,
        captured: capturedPiece,
        notation: "", // Will be generated later
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isCastling: false,
        isEnPassant: false,
        promotion: null
    };

    // --- Handle Special Moves --- 
    let previousEnPassantTarget = enPassantTarget; // Store before modifying board
    enPassantTarget = null; // Reset en passant target by default

    // Pawn Double Move (Set En Passant Target)
    if (pieceToMove.type === PAWN && Math.abs(endRow - startRow) === 2) {
        enPassantTarget = { row: (startRow + endRow) / 2, col: startCol };
        console.log("En passant target set:", enPassantTarget);
    }

    // En Passant Capture
    if (pieceToMove.type === PAWN && previousEnPassantTarget &&
        endRow === previousEnPassantTarget.row && endCol === previousEnPassantTarget.col &&
        !capturedPiece) { // Capture must be on empty square for en passant

        const capturedPawnRow = startRow; // Pawn being captured is on same row
        const capturedPawnCol = endCol;
        move.captured = boardState[capturedPawnRow][capturedPawnCol]; // Record captured pawn
        boardState[capturedPawnRow][capturedPawnCol] = null; // Remove captured pawn
        move.isEnPassant = true;
        console.log("En passant capture executed.");
    }

    // Castling
    if (pieceToMove.type === KING && Math.abs(endCol - startCol) === 2) {
        move.isCastling = true;
        const rookStartCol = endCol > startCol ? 7 : 0;
        const rookEndCol = endCol > startCol ? endCol - 1 : endCol + 1;
        const rook = boardState[startRow][rookStartCol];
        if (rook && rook.type === ROOK) {
            boardState[startRow][rookEndCol] = rook;
            boardState[startRow][rookStartCol] = null;
            rook.hasMoved = true;
            console.log("Castling executed.");
        }
    }

    // --- Save snapshot for undo ---
    const preMoveSnapshot = {
        boardState: deepClone(boardState),
        currentPlayer,
        moveHistory: deepClone(moveHistory),
        isGameOver,
        kingPositions: deepClone(kingPositions),
        currentStatus,
        enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null
    };
    positionHistory.push(preMoveSnapshot);

    // --- Update Board State --- 
    boardState[endRow][endCol] = pieceToMove;
    boardState[startRow][startCol] = null;
    pieceToMove.hasMoved = true;

    // Update King Position if moved
    if (pieceToMove.type === KING) {
        kingPositions[pieceToMove.color] = { row: endRow, col: endCol };
    }

    // Pawn Promotion (simple auto-queen for now)
    if (pieceToMove.type === PAWN && (endRow === 0 || endRow === 7)) {
        const promotedPieceType = QUEEN; // TODO: Implement choice?
        boardState[endRow][endCol] = new Piece(promotedPieceType, pieceToMove.color);
        boardState[endRow][endCol].hasMoved = true; // Promoted piece counts as moved
        move.promotion = promotedPieceType;
        console.log("Pawn promoted to Queen.");
    }

    // --- Post-Move Updates --- 
    switchPlayer();
    move.notation = generateNotationWithDisambiguation(move, preMoveSnapshot.boardState); // Generate notation using pre-move state
    moveHistory.push(move);

    // Check for check, checkmate, stalemate
    const opponentKingInCheck = findKingInCheck(currentPlayer);
    if (opponentKingInCheck) {
        move.isCheck = true;
        console.log(currentPlayer, "king is in check.");
        if (isCheckmate(currentPlayer)) {
            move.isCheckmate = true;
            isGameOver = true;
            currentStatus = `Checkmate! ${currentPlayer === WHITE ? 'Black' : 'White'} wins.`;
            console.log("Checkmate!");
        }
    } else if (isStalemate(currentPlayer)) {
        move.isStalemate = true;
        isGameOver = true;
        currentStatus = "Stalemate! Game is a draw.";
        console.log("Stalemate!");
    }

    // --- Update UI --- 
    renderPieces(boardState, { row: endRow, col: endCol });
    if (!isGameOver) {
        currentStatus = `${currentPlayer === WHITE ? 'White' : 'Black'}'s turn`;
    }
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState, opponentKingInCheck);
    // Sounds
    try {
        if (move.isCastling) {
            playSound('castle');
        } else if (move.promotion) {
            playSound('promote');
        } else if (move.captured) {
            playSound('capture');
        } else if (move.isCheck || opponentKingInCheck) {
            playSound('check');
        } else {
            playSound('move');
        }
    } catch (_) { /* ignore sound errors */ }
    saveGameState(); // Save state after successful move
}

/**
 * Undo the last move and restore previous game state
 */
function undoLastMove() {
    if (positionHistory.length === 0 || isGameOver && moveHistory.length === 0) return;
    const snapshot = positionHistory.pop();
    boardState = snapshot.boardState;
    currentPlayer = snapshot.currentPlayer;
    moveHistory = snapshot.moveHistory;
    isGameOver = snapshot.isGameOver;
    kingPositions = snapshot.kingPositions;
    currentStatus = snapshot.currentStatus;
    enPassantTarget = snapshot.enPassantTarget;

    clearSelectedSquare();
    clearPossibleMoves();
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState, findKingInCheck(currentPlayer));
    saveGameState();
}

/**
 * Switches the current player.
 */
function switchPlayer() {
    currentPlayer = (currentPlayer === WHITE) ? BLACK : WHITE;
}

/**
 * Generates all legal moves for the current player.
 * @param {string} playerColor - The color of the player whose moves to generate.
 * @returns {Array<{from: {row, col}, to: {row, col}}>}
 */
function generateAllLegalMoves(playerColor) {
    let allMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.color === playerColor) {
                const pieceMoves = generateLegalMovesForPiece(r, c);
                allMoves = allMoves.concat(pieceMoves.map(to => ({ from: { row: r, col: c }, to })));
            }
        }
    }
    return allMoves;
}

/**
 * Generates legal moves for a specific piece at given coordinates.
 * Considers board state, obstacles, and checks.
 * @param {number} startRow
 * @param {number} startCol
 * @returns {Array<{row: number, col: number}>} Array of valid destination squares.
 */
function generateLegalMovesForPiece(startRow, startCol) {
    const piece = boardState[startRow][startCol];
    if (!piece) return [];

    let pseudoLegalMoves = []; // Moves valid based on piece movement rules only
    const playerColor = piece.color;
    const opponentColor = playerColor === WHITE ? BLACK : WHITE;

    // 1. Generate Pseudo-Legal Moves (based on piece type)
    // This part needs detailed implementation for each piece type,
    // checking for obstacles along paths for sliders (Rook, Bishop, Queen).

    for (let endRow = 0; endRow < 8; endRow++) {
        for (let endCol = 0; endCol < 8; endCol++) {
            const targetSquare = boardState[endRow][endCol];
            const isCapture = targetSquare !== null && targetSquare.color === opponentColor;
            const isEmpty = targetSquare === null;

            // Basic check: Can't capture own piece
            if (targetSquare && targetSquare.color === playerColor) continue;

            if (isPseudoLegalMove(piece, startRow, startCol, endRow, endCol, isCapture)) {
                // Check for obstructions for sliding pieces
                if ([ROOK, BISHOP, QUEEN].includes(piece.type)) {
                    if (isPathObstructed(startRow, startCol, endRow, endCol)) {
                        continue;
                    }
                }
                 // Special check for pawn non-capture forward moves
                if (piece.type === PAWN && !isCapture && !isEmpty && startCol === endCol) {
                     continue; // Cannot move pawn forward onto occupied square
                }
                 // Special check for pawn initial double move obstruction
                if (piece.type === PAWN && Math.abs(endRow - startRow) === 2 && !isCapture) {
                    const intermediateRow = (startRow + endRow) / 2;
                    if (boardState[intermediateRow][startCol] !== null) {
                         continue; // Path blocked for double move
                    }
                }
                // Check for en passant validity (target square must be empty)
                const isEnPassantMove = piece.type === PAWN && enPassantTarget &&
                                       endRow === enPassantTarget.row && endCol === enPassantTarget.col &&
                                       Math.abs(startCol - endCol) === 1; // Must be diagonal
                if(isEnPassantMove && !isEmpty) continue; // En passant target must be empty
                if(!isEnPassantMove && piece.type === PAWN && Math.abs(startCol - endCol) === 1 && isEmpty) continue; // Standard pawn diagonal requires capture

                pseudoLegalMoves.push({ row: endRow, col: endCol });
            }
        }
    }

    // Add En Passant move explicitly if valid
    if (piece.type === PAWN && enPassantTarget) {
        const direction = piece.color === WHITE ? -1 : 1;
        if (startRow === (enPassantTarget.row - direction)) { // Is the pawn on the correct rank?
             if (Math.abs(startCol - enPassantTarget.col) === 1) { // Is the pawn adjacent?
                // Check if the move resolves check before adding
                 pseudoLegalMoves.push({ row: enPassantTarget.row, col: enPassantTarget.col });
             }
        }
    }

    // Add Castling moves explicitly if valid
    if (piece.type === KING && !piece.hasMoved) {
        // Kingside
        if (canCastle(playerColor, 'kingside')) {
            pseudoLegalMoves.push({ row: startRow, col: startCol + 2 });
        }
        // Queenside
        if (canCastle(playerColor, 'queenside')) {
            pseudoLegalMoves.push({ row: startRow, col: startCol - 2 });
        }
    }


    // 2. Filter out moves that leave the king in check
    const legalMoves = pseudoLegalMoves.filter(move => {
        // --- Simulation --- 
        // Temporarily make the move on a deep copy of the board
        // to see if the player's own king would be in check.
        const tempBoard = boardState.map(row => row.map(cell => cell ? { ...cell } : null));
        const tempPiece = tempBoard[startRow][startCol];
        const tempCaptured = tempBoard[move.row][move.col];
        let tempEnPassantCapturedPawn = null;

        // Simulate en passant capture removal
        const isSimulatedEnPassant = tempPiece && tempPiece.type === PAWN && enPassantTarget &&
                                     move.row === enPassantTarget.row && move.col === enPassantTarget.col &&
                                     !tempCaptured;
        if (isSimulatedEnPassant) {
            const capturedPawnRow = startRow;
            const capturedPawnCol = move.col;
            tempEnPassantCapturedPawn = tempBoard[capturedPawnRow][capturedPawnCol];
            tempBoard[capturedPawnRow][capturedPawnCol] = null;
        }

        // Simulate castling rook move
        let tempRook = null;
        let tempRookStartCol = -1;
        let tempRookEndCol = -1;
        const isSimulatedCastling = tempPiece && tempPiece.type === KING && Math.abs(move.col - startCol) === 2;
         if (isSimulatedCastling) {
            tempRookStartCol = move.col > startCol ? 7 : 0;
            tempRookEndCol = move.col > startCol ? move.col - 1 : move.col + 1;
            tempRook = tempBoard[startRow][tempRookStartCol];
            tempBoard[startRow][tempRookEndCol] = tempRook;
            tempBoard[startRow][tempRookStartCol] = null;
        }

        tempBoard[move.row][move.col] = tempPiece;
        tempBoard[startRow][startCol] = null;

        // Temporarily update king position if king moved
        const originalKingPos = { ...kingPositions[playerColor] };
        const simulatedKingPositions = { ...kingPositions, [playerColor]: originalKingPos };
        if (tempPiece && tempPiece.type === KING) {
            simulatedKingPositions[playerColor] = { row: move.row, col: move.col };
        }

        // Check if the king is now in check after the simulated move
        const kingInCheck = isKingInCheckWithPositions(playerColor, tempBoard, simulatedKingPositions);

        // If the king is NOT in check after this move, it's a legal move.
        return !kingInCheck;
    });

    return legalMoves;
}

/**
 * Checks if a path between two squares is obstructed for sliding pieces.
 * Assumes the move is purely horizontal, vertical, or diagonal.
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 * @returns {boolean} True if the path is obstructed.
 */
function isPathObstructed(startRow, startCol, endRow, endCol) {
    const rowStep = Math.sign(endRow - startRow);
    const colStep = Math.sign(endCol - startCol);
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;

    while (currentRow !== endRow || currentCol !== endCol) {
        if (!isWithinBounds(currentRow, currentCol)) break; // Should not happen for valid moves
        if (boardState[currentRow][currentCol] !== null) {
            return true; // Path is blocked
        }
        currentRow += rowStep;
        currentCol += colStep;
    }
    return false;
}

/**
 * Checks if a square is attacked by the opponent.
 * @param {number} targetRow
 * @param {number} targetCol
 * @param {string} attackerColor - The color of the attacking player.
 * @param {Array<Array<Piece|null>>} currentBoardState - The board state to check against.
 * @returns {boolean}
 */
function isSquareAttacked(targetRow, targetCol, attackerColor, currentBoardState) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = currentBoardState[r][c];
            if (piece && piece.color === attackerColor) {
                // Check if this piece can attack the target square
                // Need to consider captures for pawns specifically
                const isCaptureAttempt = true; // Assume any move to target is potential capture
                if (isPseudoLegalMove(piece, r, c, targetRow, targetCol, isCaptureAttempt)) {
                    // Check for obstructions for sliding pieces
                    if ([ROOK, BISHOP, QUEEN].includes(piece.type)) {
                        if (!isPathObstructedForAttack(r, c, targetRow, targetCol, currentBoardState)) {
                            return true;
                        }
                    } else {
                        // For non-sliding pieces, pseudo-legal check is enough
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

/**
 * Checks obstruction specifically for attack checks (path must be clear up to target).
 */
function isPathObstructedForAttack(startRow, startCol, endRow, endCol, currentBoardState) {
    const rowStep = Math.sign(endRow - startRow);
    const colStep = Math.sign(endCol - startCol);
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;

    while (currentRow !== endRow || currentCol !== endCol) {
        if (!isWithinBounds(currentRow, currentCol)) break; 
        if (currentBoardState[currentRow][currentCol] !== null) {
            return true; // Path is blocked before reaching target
        }
        currentRow += rowStep;
        currentCol += colStep;
    }
    return false;
}


/**
 * Finds the coordinates of the player's king if it's in check.
 * @param {string} playerColor - The color of the king to check.
 * @returns {{row: number, col: number} | null} Coordinates if in check, else null.
 */
function findKingInCheck(playerColor) {
    if (!isKingInCheck(playerColor, boardState)) {
        return null;
    }
    return kingPositions[playerColor];
}

/**
 * Checks if the specified player's king is currently in check.
 * @param {string} playerColor - The color of the king to check.
 * @param {Array<Array<Piece|null>>} currentBoardState - The board state to check.
 * @returns {boolean}
 */
function isKingInCheck(playerColor, currentBoardState) {
    const kingPos = kingPositions[playerColor];
    const opponentColor = playerColor === WHITE ? BLACK : WHITE;
    return isSquareAttacked(kingPos.row, kingPos.col, opponentColor, currentBoardState);
}

/**
 * Variant of isKingInCheck that accepts provided king positions (for simulations)
 */
function isKingInCheckWithPositions(playerColor, currentBoardState, kPos) {
    const kingPos = kPos[playerColor];
    const opponentColor = playerColor === WHITE ? BLACK : WHITE;
    return isSquareAttacked(kingPos.row, kingPos.col, opponentColor, currentBoardState);
}

/**
 * Checks if the current player is in checkmate.
 * Assumes the player is already in check.
 * @param {string} playerColor - The player potentially checkmated.
 * @returns {boolean}
 */
function isCheckmate(playerColor) {
    if (!isKingInCheck(playerColor, boardState)) {
        return false; // Not in check, so cannot be checkmate
    }
    // If there are no legal moves, it's checkmate
    return generateAllLegalMoves(playerColor).length === 0;
}

/**
 * Checks if the current player is in stalemate.
 * Assumes the player is NOT in check.
 * @param {string} playerColor - The player potentially stalemated.
 * @returns {boolean}
 */
function isStalemate(playerColor) {
    if (isKingInCheck(playerColor, boardState)) {
        return false; // If in check, it's checkmate or playable, not stalemate
    }
    // If not in check, but no legal moves, it's stalemate
    return generateAllLegalMoves(playerColor).length === 0;
}

/**
* Checks if castling is legal.
* @param {string} playerColor
* @param {'kingside' | 'queenside'} side
* @returns {boolean}
*/
function canCastle(playerColor, side) {
   const kingRow = playerColor === WHITE ? 7 : 0;
   const kingCol = 4;
   const king = boardState[kingRow][kingCol];

   if (!king || king.type !== KING || king.hasMoved || isKingInCheck(playerColor, boardState)) {
       return false;
   }

   const rookCol = side === 'kingside' ? 7 : 0;
   const rook = boardState[kingRow][rookCol];

   if (!rook || rook.type !== ROOK || rook.hasMoved) {
       return false;
   }

   // Check path clear
   const pathCols = side === 'kingside' ? [5, 6] : [1, 2, 3];
   for (const col of pathCols) {
       if (boardState[kingRow][col] !== null) {
           return false; // Path obstructed
       }
   }

   // Check squares king moves through are not attacked
   const checkCols = side === 'kingside' ? [kingCol, 5, 6] : [kingCol, 3, 2]; // Check king's current, intermediate, and final square
   const opponentColor = playerColor === WHITE ? BLACK : WHITE;
   for (const col of checkCols) {
        // Only need to check intermediate and final square attack if path is clear
        if (col !== kingCol && isSquareAttacked(kingRow, col, opponentColor, boardState)) {
            return false;
        }
   }
   // Special check for col 1 attack on queenside, which isn't explicitly moved *through*
   if (side === 'queenside' && isSquareAttacked(kingRow, 1, opponentColor, boardState)) {
        return false;
   }


   return true;
}


// --- Persistence --- 

/**
 * Saves the current game state to localStorage.
 */
function saveGameState() {
    const gameState = {
        boardState: boardState,
        currentPlayer: currentPlayer,
        moveHistory: moveHistory,
        isGameOver: isGameOver,
        kingPositions: kingPositions,
        currentStatus: currentStatus,
        enPassantTarget: enPassantTarget
        // Note: Piece methods are not saved, need to reconstruct pieces on load if using classes
        // Using plain objects here avoids this issue
    };
    try {
        localStorage.setItem('chessGameState', JSON.stringify(gameState));
        // console.log("Game state saved.");
    } catch (e) {
        console.error("Error saving game state:", e);
    }
}

/**
 * Loads game state from localStorage.
 */
function loadGameState() {
    const savedState = localStorage.getItem('chessGameState');
    if (savedState) {
        try {
            const gameState = JSON.parse(savedState);
            // Basic validation
            if (gameState && gameState.boardState && gameState.currentPlayer) {
                boardState = gameState.boardState;
                currentPlayer = gameState.currentPlayer;
                moveHistory = gameState.moveHistory || [];
                isGameOver = gameState.isGameOver || false;
                kingPositions = gameState.kingPositions || { [WHITE]: { row: -1, col: -1 }, [BLACK]: { row: -1, col: -1 } }; // Recalculate if missing?
                currentStatus = gameState.currentStatus || "Game loaded";
                enPassantTarget = gameState.enPassantTarget || null;

                // Important: Reconstruct piece objects if they had methods or used classes
                // Since we used plain objects {type, color, hasMoved}, direct load is okay here.
                // If Piece was a class: boardState = boardState.map(row => row.map(p => p ? new Piece(p.type, p.color, p.hasMoved) : null));

                 // Find king positions if they weren't saved properly
                if(kingPositions[WHITE].row === -1 || kingPositions[BLACK].row === -1) {
                    recalculateKingPositions();
                }

                console.log("Game state loaded.");
                return true;
            }
        } catch (e) {
            console.error("Error loading game state:", e);
            localStorage.removeItem('chessGameState'); // Clear corrupted state
        }
    }
    return false;
}

/** Recalculates king positions by scanning the board */
function recalculateKingPositions() {
    let foundW = false;
    let foundB = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = boardState[r][c];
            if (piece && piece.type === KING) {
                kingPositions[piece.color] = { row: r, col: c };
                if (piece.color === WHITE) foundW = true;
                if (piece.color === BLACK) foundB = true;
            }
            if(foundW && foundB) return; // Stop early
        }
    }
}

// --- UI Updates --- 

/**
 * Updates the move history display in the DOM.
 */
function updateMoveHistoryDisplay() {
    moveHistoryElement.innerHTML = ''; // Clear existing
    let listItems = {}; // Store list items by turn number

    moveHistory.forEach((move, index) => {
        const turnNumber = Math.floor(index / 2) + 1;
        const isWhiteMove = index % 2 === 0;

        let listItem;
        if (!listItems[turnNumber]) {
            // Create new list item for the turn
            listItem = document.createElement('li');
            const turnSpan = document.createElement('span');
            turnSpan.classList.add('turn-number');
            turnSpan.textContent = `${turnNumber}.`;
            
            const whiteMoveSpan = document.createElement('span');
            whiteMoveSpan.classList.add('move', 'white-move');
            
            const blackMoveSpan = document.createElement('span');
            blackMoveSpan.classList.add('move', 'black-move');

            listItem.appendChild(turnSpan);
            listItem.appendChild(whiteMoveSpan);
            listItem.appendChild(blackMoveSpan);
            
            moveHistoryElement.appendChild(listItem);
            listItems[turnNumber] = listItem; // Store reference
        } else {
            listItem = listItems[turnNumber];
        }

        // Populate the correct move span
        if (isWhiteMove) {
            listItem.querySelector('.white-move').textContent = move.notation;
        } else {
            listItem.querySelector('.black-move').textContent = move.notation;
        }
    });
    
    // Highlight the last list item
    if (moveHistoryElement.lastElementChild) {
        moveHistoryElement.lastElementChild.classList.add('last-move-entry');
    }

    // Scroll to bottom
    moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
}

/**
 * Updates the game status message in the DOM.
 */
function updateStatusDisplay() {
    gameStatusElement.textContent = currentStatus;
}

/**
 * Generates standard algebraic notation (SAN) for a move.
 * This is a simplified version. Full SAN is complex (e.g., disambiguation).
 * @param {object} move - The move object.
 * @returns {string}
 */
function generateNotation(move) {
    const piece = move.piece;
    const toAlg = coordsToAlgebraic(move.to.row, move.to.col);
    let notation = '';

    if (move.isCastling) {
        return move.to.col > move.from.col ? 'O-O' : 'O-O-O';
    }

    if (piece.type !== PAWN) {
        notation += piece.type.toUpperCase();
        // TODO: Add disambiguation if needed (e.g., Raxd1 vs Rdx1)
    }

    if (move.captured) {
        if (piece.type === PAWN) {
            notation += coordsToAlgebraic(move.from.row, move.from.col)[0]; // Add file for pawn capture
        }
        notation += 'x'; // Capture indicator
    }

    notation += toAlg;

    if (move.promotion) {
        notation += '=' + move.promotion.toUpperCase();
    }

    // Add check/checkmate indicator based on *next* player's state
    const nextPlayer = currentPlayer; // Player has already been switched
    if (isCheckmate(nextPlayer)) {
         notation += '#';
     } else if (isKingInCheck(nextPlayer, boardState)) {
         notation += '+';
     }
     // Note: Stalemate doesn't usually have a symbol in SAN, status message handles it.
    if (move.isEnPassant) {
        notation += ' e.p.'; // Optional indicator
    }

    return notation;
}

/**
 * Generate SAN with basic disambiguation using pre-move board state
 */
function generateNotationWithDisambiguation(move, boardBefore) {
    const piece = move.piece;
    const toAlg = coordsToAlgebraic(move.to.row, move.to.col);
    if (move.isCastling) {
        return move.to.col > move.from.col ? 'O-O' : 'O-O-O';
    }

    let disambiguation = '';
    if (piece.type !== PAWN) {
        // Check for same-type pieces that could also move to the destination
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (r === move.from.row && c === move.from.col) continue;
                const other = boardBefore[r][c];
                if (other && other.type === piece.type && other.color === piece.color) {
                    const targetSquare = boardBefore[move.to.row][move.to.col];
                    const isCapture = !!targetSquare && targetSquare.color !== piece.color;
                    if (isPseudoLegalMove(other, r, c, move.to.row, move.to.col, isCapture)) {
                        if ([ROOK, BISHOP, QUEEN].includes(other.type)) {
                            // Respect obstructions on pre-move board
                            const blocked = (function() {
                                const rowStep = Math.sign(move.to.row - r);
                                const colStep = Math.sign(move.to.col - c);
                                let rr = r + rowStep, cc = c + colStep;
                                while (rr !== move.to.row || cc !== move.to.col) {
                                    if (boardBefore[rr][cc] !== null) return true;
                                    rr += rowStep; cc += colStep;
                                }
                                return false;
                            })();
                            if (blocked) continue;
                        }
                        // Need disambiguation
                        const needFile = move.from.col !== c;
                        const needRank = move.from.row !== r;
                        if (needFile && !needRank) disambiguation = coordsToAlgebraic(move.from.row, move.from.col)[0];
                        else if (!needFile && needRank) disambiguation = coordsToAlgebraic(move.from.row, move.from.col)[1];
                        else disambiguation = coordsToAlgebraic(move.from.row, move.from.col);
                    }
                }
            }
        }
    }

    let notation = '';
    if (piece.type !== PAWN) {
        notation += piece.type.toUpperCase() + disambiguation;
    }
    if (move.captured) {
        if (piece.type === PAWN) {
            notation += coordsToAlgebraic(move.from.row, move.from.col)[0];
        }
        notation += 'x';
    }
    notation += toAlg;
    if (move.promotion) notation += '=' + move.promotion.toUpperCase();
    const nextPlayer = currentPlayer;
    if (isCheckmate(nextPlayer)) notation += '#';
    else if (isKingInCheck(nextPlayer, boardState)) notation += '+';
    if (move.isEnPassant) notation += ' e.p.';
    return notation;
} 