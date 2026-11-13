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
let positionHistory = []; // Undo stack: one pre-move snapshot per move played
let halfmoveClock = 0; // Half-moves since the last pawn move or capture (fifty-move rule)

const moveHistoryElement = document.getElementById('move-history');
const gameStatusElement = document.getElementById('game-status');
const resetButton = document.getElementById('reset-button');
const undoButton = document.getElementById('undo-button');
const pgnButton = document.getElementById('pgn-button');
const RESET_LABEL = resetButton ? resetButton.textContent : 'New Game';
let resetConfirmTimer = null; // Set while the New Game button is waiting for a second click

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
    resetButton.removeEventListener('click', handleResetClick);
    resetButton.addEventListener('click', handleResetClick);

    // Add event listener for the PGN export button
    if (pgnButton) {
        pgnButton.removeEventListener('click', copyPGN);
        pgnButton.addEventListener('click', copyPGN);
    }

    // Add event listener for undo button
    if (undoButton) {
        undoButton.removeEventListener('click', undoLastMove);
        if (CONFIG.FEATURES.UNDO_MOVE) {
            undoButton.addEventListener('click', undoLastMove);
        } else {
            undoButton.hidden = true;
        }
    }

    debugLog("Game initialized.");
}

/**
 * Event handler for board clicks, delegates to handleBoardClick function
 * @param {Event} event - The click event
 */
function handleBoardClickEvent(event) {
    // Ignore clicks that happen right after a drag operation
    if (typeof window.dragJustEnded !== 'undefined' && window.dragJustEnded) {
        return;
    }
    
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
    debugLog("Resetting game...");
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
    halfmoveClock = 0;
    cancelPendingPromotion();
    clearSelectedSquare();
    clearPossibleMoves();
    clearSavedGame();
    // Re-render board and pieces
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState, findKingInCheck(currentPlayer));
}

/**
 * Handles clicks on the board squares.
 * @param {number} row
 * @param {number} col
 */
function handleBoardClick(row, col) {
    if (isGameOver) return; // Don't allow moves if game is over
    if (isPromotionPending()) return; // The promotion chooser has to be answered first

    const clickedPiece = boardState[row][col];

    if (selectedSquare && Array.isArray(possibleMoves)) {
        // Attempting to make a move
        const move = {
            from: selectedSquare,
            to: { row, col }
        };

        // Check if the destination is a valid possible move
        const isPossible = possibleMoves.some(pm => pm.row === row && pm.col === col);

        if (isPossible) {
            const mover = boardState[move.from.row][move.from.col];
            const promotes = mover && mover.type === PAWN && (row === 0 || row === 7);
            if (promotes && CONFIG.FEATURES.PROMOTION_UI && typeof showPromotionChooser === 'function') {
                // Hold the move until the player has picked a piece
                showPromotionChooser(mover.color, (type) => {
                    makeMove(move.from.row, move.from.col, move.to.row, move.to.col, type);
                });
            } else {
                makeMove(move.from.row, move.from.col, move.to.row, move.to.col);
            }
        } else if (clickedPiece && clickedPiece.color === currentPlayer &&
                   (selectedSquare.row !== row || selectedSquare.col !== col)) {
            // Clicked another of the player's own pieces: switch the selection to it
            setSelectedSquare(row, col);
            setPossibleMoves(generateLegalMovesForPiece(row, col));
            updateBoardVisuals(boardState, findKingInCheck(currentPlayer));
            return;
        }
        // Otherwise clear the selection (after a move, or a click elsewhere or on the same square)
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
 * @param {string} [promotionType] - Piece a pawn reaching the last rank becomes; queen by default.
 */
function makeMove(startRow, startCol, endRow, endCol, promotionType = QUEEN) {
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

    // --- Save snapshot for undo ---
    // Taken before anything is mutated, so undo restores the exact prior position.
    const preMoveSnapshot = {
        boardState: deepClone(boardState),
        currentPlayer,
        isGameOver,
        kingPositions: deepClone(kingPositions),
        currentStatus,
        enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
        halfmoveClock
    };
    positionHistory.push(preMoveSnapshot);

    // --- Handle Special Moves ---
    let previousEnPassantTarget = enPassantTarget; // Store before modifying board
    enPassantTarget = null; // Reset en passant target by default

    // Pawn Double Move (Set En Passant Target)
    if (pieceToMove.type === PAWN && Math.abs(endRow - startRow) === 2) {
        enPassantTarget = { row: (startRow + endRow) / 2, col: startCol };
        debugLog("En passant target set:", enPassantTarget);
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
        debugLog("En passant capture executed.");
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
            debugLog("Castling executed.");
        }
    }

    // --- Update Board State ---
    boardState[endRow][endCol] = pieceToMove;
    boardState[startRow][startCol] = null;
    pieceToMove.hasMoved = true;

    // Update King Position if moved
    if (pieceToMove.type === KING) {
        kingPositions[pieceToMove.color] = { row: endRow, col: endCol };
    }

    // Pawn Promotion
    if (pieceToMove.type === PAWN && (endRow === 0 || endRow === 7)) {
        const promotedPieceType = [QUEEN, ROOK, BISHOP, KNIGHT].includes(promotionType) ? promotionType : QUEEN;
        boardState[endRow][endCol] = new Piece(promotedPieceType, pieceToMove.color);
        boardState[endRow][endCol].hasMoved = true; // Promoted piece counts as moved
        move.promotion = promotedPieceType;
        debugLog("Pawn promoted to", promotedPieceType);
    }

    // Fifty-move rule counter
    halfmoveClock = (pieceToMove.type === PAWN || move.captured) ? 0 : halfmoveClock + 1;

    // --- Post-Move Updates --- 
    switchPlayer();
    move.notation = generateNotationWithDisambiguation(move, preMoveSnapshot.boardState); // Generate notation using pre-move state
    moveHistory.push(move);

    // Check for check, checkmate, stalemate
    const opponentKingInCheck = findKingInCheck(currentPlayer);
    if (opponentKingInCheck) {
        move.isCheck = true;
        debugLog(currentPlayer, "king is in check.");
        if (isCheckmate(currentPlayer)) {
            move.isCheckmate = true;
            isGameOver = true;
            currentStatus = `Checkmate! ${currentPlayer === WHITE ? 'Black' : 'White'} wins.`;
            debugLog("Checkmate!");
        }
    } else if (isStalemate(currentPlayer)) {
        move.isStalemate = true;
        isGameOver = true;
        currentStatus = "Stalemate! Game is a draw.";
        debugLog("Stalemate!");
    }
    if (!isGameOver) {
        const drawReason = findDrawReason();
        if (drawReason) {
            move.isDraw = true;
            isGameOver = true;
            currentStatus = `Draw by ${drawReason}.`;
            debugLog(currentStatus);
        }
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
        if (isGameOver) {
            playSound('game_end');
        } else if (move.isCastling) {
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
    cancelPendingPromotion();
    const snapshot = positionHistory.pop();
    boardState = snapshot.boardState;
    currentPlayer = snapshot.currentPlayer;
    moveHistory.pop(); // Each snapshot is taken right before exactly one move is recorded
    isGameOver = snapshot.isGameOver;
    kingPositions = snapshot.kingPositions;
    currentStatus = snapshot.currentStatus;
    enPassantTarget = snapshot.enPassantTarget;
    halfmoveClock = snapshot.halfmoveClock || 0;

    clearSelectedSquare();
    clearPossibleMoves();
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState, findKingInCheck(currentPlayer));
    saveGameState();
}

/** @returns {boolean} True while the promotion chooser is waiting for an answer. */
function isPromotionPending() {
    return typeof isPromotionChooserOpen === 'function' && isPromotionChooserOpen();
}

/** Closes the promotion chooser without playing the held move. */
function cancelPendingPromotion() {
    if (isPromotionPending()) closePromotionChooser(null);
}

// --- Draw detection ---

/**
 * A key that is equal for two positions exactly when they count as the same
 * position for the repetition rule: same placement, side to move, castling
 * rights and en passant possibility.
 */
function positionKey(board, player, epTarget) {
    let key = player;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            key += piece ? piece.color + piece.type : '-';
        }
    }
    for (const color of [WHITE, BLACK]) {
        const row = color === WHITE ? 7 : 0;
        const king = board[row][4];
        const kingReady = !!king && king.type === KING && king.color === color && !king.hasMoved;
        for (const col of [7, 0]) {
            const rook = board[row][col];
            key += kingReady && rook && rook.type === ROOK && rook.color === color && !rook.hasMoved ? '1' : '0';
        }
    }
    // The en passant square only matters if a pawn is placed to capture on it
    if (epTarget) {
        const pawnRow = epTarget.row + (player === WHITE ? 1 : -1);
        const canCapture = [epTarget.col - 1, epTarget.col + 1].some((col) => {
            const piece = isWithinBounds(pawnRow, col) ? board[pawnRow][col] : null;
            return !!piece && piece.type === PAWN && piece.color === player;
        });
        if (canCapture) key += coordsToAlgebraic(epTarget.row, epTarget.col);
    }
    return key;
}

/** @returns {boolean} True if the current position has now occurred three times. */
function isThreefoldRepetition() {
    const current = positionKey(boardState, currentPlayer, enPassantTarget);
    let occurrences = 1;
    // A pawn move or capture makes every earlier position unreachable, so only
    // the positions since the last one can repeat.
    const oldest = Math.max(0, positionHistory.length - halfmoveClock);
    for (let i = positionHistory.length - 1; i >= oldest; i--) {
        const past = positionHistory[i];
        if (positionKey(past.boardState, past.currentPlayer, past.enPassantTarget) === current) {
            occurrences++;
            if (occurrences >= 3) return true;
        }
    }
    return false;
}

/**
 * @returns {boolean} True if neither side can possibly give checkmate: bare
 * kings, a single bishop or knight, or only bishops that all stand on one colour.
 */
function hasInsufficientMaterial(board = boardState) {
    const others = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type !== KING) others.push({ type: piece.type, shade: (r + c) % 2 });
        }
    }
    if (others.length === 0) return true;
    if (others.length === 1) return others[0].type === BISHOP || others[0].type === KNIGHT;
    return others.every(p => p.type === BISHOP && p.shade === others[0].shade);
}

/** @returns {string|null} Why the current position is drawn, or null if it is not. */
function findDrawReason() {
    if (hasInsufficientMaterial()) return 'insufficient material';
    if (isThreefoldRepetition()) return 'threefold repetition';
    if (halfmoveClock >= 100) return 'the fifty-move rule';
    return null;
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
                // There must be an enemy pawn to capture beside this pawn
                const victim = boardState[startRow][enPassantTarget.col];
                if (victim && victim.type === PAWN && victim.color === opponentColor) {
                    pseudoLegalMoves.push({ row: enPassantTarget.row, col: enPassantTarget.col });
                }
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

        // Simulate en passant capture removal
        const isSimulatedEnPassant = tempPiece && tempPiece.type === PAWN && enPassantTarget &&
                                     move.row === enPassantTarget.row && move.col === enPassantTarget.col &&
                                     !tempCaptured;
        if (isSimulatedEnPassant) {
            const capturedPawnRow = startRow;
            const capturedPawnCol = move.col;
            tempBoard[capturedPawnRow][capturedPawnCol] = null;
        }

        // Simulate castling rook move
        const isSimulatedCastling = tempPiece && tempPiece.type === KING && Math.abs(move.col - startCol) === 2;
        if (isSimulatedCastling) {
            const tempRookStartCol = move.col > startCol ? 7 : 0;
            const tempRookEndCol = move.col > startCol ? move.col - 1 : move.col + 1;
            const tempRook = tempBoard[startRow][tempRookStartCol];
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
        const kingInCheck = isKingInCheck(playerColor, tempBoard, simulatedKingPositions);

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
 * @param {Array<Array<Piece|null>>} [board] - Board to check; defaults to the live board.
 * @returns {boolean} True if the path is obstructed.
 */
function isPathObstructed(startRow, startCol, endRow, endCol, board = boardState) {
    const rowStep = Math.sign(endRow - startRow);
    const colStep = Math.sign(endCol - startCol);
    let currentRow = startRow + rowStep;
    let currentCol = startCol + colStep;

    while (currentRow !== endRow || currentCol !== endCol) {
        if (!isWithinBounds(currentRow, currentCol)) break; // Should not happen for valid moves
        if (board[currentRow][currentCol] !== null) {
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
                        if (!isPathObstructed(r, c, targetRow, targetCol, currentBoardState)) {
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
 * @param {object} [kPos] - King positions to use; defaults to the live ones (pass others for simulations).
 * @returns {boolean}
 */
function isKingInCheck(playerColor, currentBoardState, kPos = kingPositions) {
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
   // The b-file square only has to be empty (checked above); the king never
   // crosses it, so it may be attacked.

   return true;
}


// --- Persistence --- 

const SAVED_GAME_KEY = CONFIG.STORAGE_KEYS.GAME_STATE;
const SAVED_GAME_VERSION = 1;

/**
 * Saves the current game state to localStorage.
 */
function saveGameState() {
    const gameState = {
        version: SAVED_GAME_VERSION,
        boardState: boardState,
        currentPlayer: currentPlayer,
        moveHistory: moveHistory,
        isGameOver: isGameOver,
        kingPositions: kingPositions,
        currentStatus: currentStatus,
        enPassantTarget: enPassantTarget,
        halfmoveClock: halfmoveClock,
        positionHistory: positionHistory // Undo stack, so Undo still works after a reload
    };
    try {
        localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(gameState));
    } catch (e) {
        console.error("Error saving game state:", e);
    }
}

/** Removes the saved game. Storage may be unavailable, which must not stop the game. */
function clearSavedGame() {
    try {
        localStorage.removeItem(SAVED_GAME_KEY);
    } catch (e) {
        console.error("Error clearing saved game:", e);
    }
}

/** @returns {boolean} True for a {row, col} pair that is on the board. */
function isValidCoords(coords) {
    return !!coords && Number.isInteger(coords.row) && Number.isInteger(coords.col) &&
        isWithinBounds(coords.row, coords.col);
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
            if (typeof cell !== 'object' || !types.includes(cell.type) || !(cell.color in kings)) return false;
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
 * Checks a parsed saved game and returns a clean state object, or null if it
 * cannot be trusted. Nothing in the live game is touched here.
 */
function validateSavedGame(saved) {
    if (!saved || typeof saved !== 'object') return null;
    if (saved.version !== undefined && saved.version !== SAVED_GAME_VERSION) return null;
    if (!isValidBoard(saved.boardState)) return null;
    if (saved.currentPlayer !== WHITE && saved.currentPlayer !== BLACK) return null;

    const history = saved.moveHistory === undefined ? [] : saved.moveHistory;
    if (!Array.isArray(history)) return null;
    for (const move of history) {
        if (!move || !isValidCoords(move.from) || !isValidCoords(move.to) || typeof move.notation !== 'string') {
            return null;
        }
    }

    const target = saved.enPassantTarget === undefined ? null : saved.enPassantTarget;
    if (target !== null && !isValidCoords(target)) return null;

    // The undo stack is optional: saves from older versions do not have one.
    // If it is missing or damaged the game still loads, with nothing to undo.
    let undoStack = [];
    if (Array.isArray(saved.positionHistory) && saved.positionHistory.length === history.length) {
        const usable = saved.positionHistory.every(s => s && isValidBoard(s.boardState) &&
            (s.currentPlayer === WHITE || s.currentPlayer === BLACK) &&
            (s.enPassantTarget === null || isValidCoords(s.enPassantTarget)));
        if (usable) {
            undoStack = saved.positionHistory.map(s => ({
                boardState: s.boardState,
                currentPlayer: s.currentPlayer,
                isGameOver: !!s.isGameOver,
                kingPositions: findKingPositions(s.boardState),
                currentStatus: typeof s.currentStatus === 'string' ? s.currentStatus : '',
                enPassantTarget: s.enPassantTarget,
                halfmoveClock: cleanClock(s.halfmoveClock)
            }));
        }
    }

    return {
        boardState: saved.boardState,
        currentPlayer: saved.currentPlayer,
        moveHistory: history,
        isGameOver: !!saved.isGameOver,
        kingPositions: findKingPositions(saved.boardState),
        currentStatus: typeof saved.currentStatus === 'string' ? saved.currentStatus : "Game loaded",
        enPassantTarget: target,
        halfmoveClock: cleanClock(saved.halfmoveClock),
        positionHistory: undoStack
    };
}

/**
 * Loads game state from localStorage. The live game is only changed once the
 * saved value has passed validation; anything else is discarded.
 * @returns {boolean} True if a saved game was loaded.
 */
function loadGameState() {
    let state = null;
    try {
        const savedState = localStorage.getItem(SAVED_GAME_KEY);
        if (!savedState) return false;
        state = validateSavedGame(JSON.parse(savedState));
    } catch (e) {
        console.error("Error loading game state:", e);
    }
    if (!state) {
        clearSavedGame(); // Unusable saved state: start fresh next time too
        return false;
    }

    boardState = state.boardState;
    currentPlayer = state.currentPlayer;
    moveHistory = state.moveHistory;
    isGameOver = state.isGameOver;
    kingPositions = state.kingPositions;
    currentStatus = state.currentStatus;
    enPassantTarget = state.enPassantTarget;
    halfmoveClock = state.halfmoveClock;
    positionHistory = state.positionHistory;
    return true;
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
    // Undo is only available while there is a move to take back
    if (undoButton) {
        undoButton.disabled = positionHistory.length === 0;
    }
    if (pgnButton) {
        pgnButton.disabled = moveHistory.length === 0;
    }
}

/** Puts the New Game button back to its normal state. */
function cancelResetConfirm() {
    if (resetConfirmTimer !== null) {
        clearTimeout(resetConfirmTimer);
        resetConfirmTimer = null;
    }
    resetButton.textContent = RESET_LABEL;
    resetButton.classList.remove('confirming');
}

/**
 * Handles the New Game button. A game in progress needs a second click within
 * a few seconds, so a mis-tap next to Undo cannot wipe it. With no moves played,
 * or once the game is over, there is nothing to lose and it resets at once.
 */
function handleResetClick() {
    const gameInProgress = moveHistory.length > 0 && !isGameOver;
    if (gameInProgress && resetConfirmTimer === null) {
        resetButton.textContent = 'Discard game?';
        resetButton.classList.add('confirming');
        resetConfirmTimer = setTimeout(cancelResetConfirm, CONFIG.RESET_CONFIRM_MS);
        return;
    }
    cancelResetConfirm();
    resetGame();
}

/**
 * Builds the game as PGN text: the seven standard tags followed by the moves.
 * @returns {string}
 */
function buildPGN() {
    const lastMove = moveHistory[moveHistory.length - 1];
    let result = '*'; // Game still in progress
    if (isGameOver && lastMove) {
        if (lastMove.isCheckmate) {
            result = lastMove.piece.color === WHITE ? '1-0' : '0-1';
        } else {
            result = '1/2-1/2';
        }
    }

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${today.getFullYear()}.${pad(today.getMonth() + 1)}.${pad(today.getDate())}`;
    const tags = [
        ['Event', 'Static Chess game'],
        ['Site', '?'],
        ['Date', date],
        ['Round', '-'],
        ['White', 'White'],
        ['Black', 'Black'],
        ['Result', result]
    ].map(([name, value]) => `[${name} "${value}"]`);

    const moves = moveHistory.map((move, index) => {
        const san = move.notation.replace(' e.p.', ''); // Not valid in PGN
        return index % 2 === 0 ? `${index / 2 + 1}. ${san}` : san;
    });

    return `${tags.join('\n')}\n\n${[...moves, result].join(' ')}\n`;
}

/**
 * Copies the game to the clipboard as PGN. If the clipboard is not available
 * (older browser, or a page opened from a file), downloads it as a file instead.
 */
function copyPGN() {
    const pgn = buildPGN();
    const flash = (text) => {
        const original = 'Copy PGN';
        pgnButton.textContent = text;
        setTimeout(() => { pgnButton.textContent = original; }, 1500);
    };
    const download = () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([pgn], { type: 'application/x-chess-pgn' }));
        link.download = 'static-chess-game.pgn';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
        flash('Downloaded');
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pgn).then(() => flash('Copied!'), download);
    } else {
        download();
    }
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
        const rivals = []; // Other pieces of the same type that could also reach the square
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
                            if (isPathObstructed(r, c, move.to.row, move.to.col, boardBefore)) continue;
                        }
                        rivals.push({ row: r, col: c });
                    }
                }
            }
        }
        // SAN rule: the file if it is enough to tell the pieces apart, else the
        // rank, else both.
        if (rivals.length > 0) {
            const from = coordsToAlgebraic(move.from.row, move.from.col);
            if (!rivals.some(o => o.col === move.from.col)) disambiguation = from[0];
            else if (!rivals.some(o => o.row === move.from.row)) disambiguation = from[1];
            else disambiguation = from;
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

// Expose handleBoardClick and related functions globally for drag.js and other modules
if (typeof window !== 'undefined') {
    window.handleBoardClick = handleBoardClick;
    window.generateLegalMovesForPiece = generateLegalMovesForPiece;
    window.findKingInCheck = findKingInCheck;
    window.makeMove = makeMove;
    // Expose state getters (selectedSquare and possibleMoves are in board.js)
    Object.defineProperty(window, 'boardState', {
        get: function() { return boardState; }
    });
    Object.defineProperty(window, 'currentPlayer', {
        get: function() { return currentPlayer; }
    });
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeGame,
        handleBoardClick,
        makeMove,
        resetGame,
        generateLegalMovesForPiece,
        generateAllLegalMoves,
        undoLastMove,
        findKingInCheck,
        isKingInCheck,
        isCheckmate,
        isStalemate,
        canCastle,
        generateNotationWithDisambiguation,
        handleResetClick,
        buildPGN,
        hasInsufficientMaterial,
        // Export state variables for test access
        get boardState() { return boardState; },
        get currentPlayer() { return currentPlayer; },
        get moveHistory() { return moveHistory; },
        get isGameOver() { return isGameOver; },
        get kingPositions() { return kingPositions; },
        get currentStatus() { return currentStatus; },
        get enPassantTarget() { return enPassantTarget; },
        get positionHistory() { return positionHistory; },
        get halfmoveClock() { return halfmoveClock; }
    };
} 