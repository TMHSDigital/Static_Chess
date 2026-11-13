/**
 * @fileoverview The live game: its state, the flow of a move, undo, saving and
 * the page updates that follow. The rules of chess themselves are in rules.js.
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
let announcerElement = document.getElementById('announcer'); // Live region read out by screen readers
const resetButton = document.getElementById('reset-button');
const undoButton = document.getElementById('undo-button');
const pgnButton = document.getElementById('pgn-button');
const RESET_LABEL = resetButton ? resetButton.textContent : 'New Game';
let resetConfirmTimer = null; // Set while the New Game button is waiting for a second click

// Computer opponent
let opponentLevel = null; // null for two players, otherwise a key of AI_LEVELS ('easy', 'medium', 'hard')
let humanColor = WHITE;   // The side the person plays when there is a computer opponent
let aiRequestId = 0;      // Goes up whenever a pending computer move must be dropped
let aiThinking = false;
let aiWorker = null;      // The Web Worker, or false once it has proved unavailable

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

    requestAIMove(); // In case it is the computer's turn in the loaded game
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
    cancelAIMove();
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
    requestAIMove(); // The computer moves first when it plays White
}

/**
 * Handles clicks on the board squares.
 * @param {number} row
 * @param {number} col
 */
function handleBoardClick(row, col) {
    if (isGameOver) return; // Don't allow moves if game is over
    if (isPromotionPending()) return; // The promotion chooser has to be answered first
    if (currentPlayer === computerColor()) return; // Not the player's turn

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

/** @returns {object} The live game as a position for the functions in rules.js. */
function livePosition() {
    return { board: boardState, kingPositions, enPassantTarget };
}

/**
 * Plays a move in the live game: applies it, records it, works out whether the
 * game has ended, and then updates the page. The move is not checked for
 * legality; callers pick it from generateLegalMovesForPiece.
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 * @param {string} [promotionType] - Piece a pawn reaching the last rank becomes; queen by default.
 */
function makeMove(startRow, startCol, endRow, endCol, promotionType = QUEEN) {
    if (!boardState[startRow][startCol]) return; // Should not happen if logic is correct

    // --- Save snapshot for undo ---
    // applyMove builds a new position and leaves the old one untouched, so the
    // snapshot can keep the current objects as they are.
    const before = { boardState, currentPlayer, isGameOver, kingPositions, currentStatus, enPassantTarget, halfmoveClock };
    positionHistory.push(before);

    // --- Apply the move ---
    const result = applyMove(livePosition(), { row: startRow, col: startCol }, { row: endRow, col: endCol }, promotionType);
    const move = { ...result.move, notation: '', isCheck: false, isCheckmate: false, isStalemate: false };
    boardState = result.position.board;
    kingPositions = result.position.kingPositions;
    enPassantTarget = result.position.enPassantTarget;
    halfmoveClock = (move.piece.type === PAWN || move.captured) ? 0 : halfmoveClock + 1; // Fifty-move rule counter
    switchPlayer();
    move.notation = generateNotationWithDisambiguation(move, before.boardState);
    moveHistory.push(move);

    // --- Has the game ended? ---
    const opponentKingInCheck = findKingInCheck(currentPlayer);
    if (opponentKingInCheck) {
        move.isCheck = true;
        if (isCheckmate(currentPlayer)) {
            move.isCheckmate = true;
            isGameOver = true;
            currentStatus = `Checkmate! ${currentPlayer === WHITE ? 'Black' : 'White'} wins.`;
        }
    } else if (isStalemate(currentPlayer)) {
        move.isStalemate = true;
        isGameOver = true;
        currentStatus = "Stalemate! Game is a draw.";
    }
    if (!isGameOver) {
        const drawReason = findDrawReason();
        if (drawReason) {
            move.isDraw = true;
            isGameOver = true;
            currentStatus = `Draw by ${drawReason}.`;
        }
    }
    if (!isGameOver) {
        currentStatus = `${currentPlayer === WHITE ? 'White' : 'Black'}'s turn`;
    }
    debugLog(move.notation, '-', currentStatus);

    showMoveResult(move, opponentKingInCheck);
    saveGameState();
    requestAIMove();
}

/**
 * Brings the page up to date after a move: pieces, status, move list,
 * highlights, the screen reader announcement and the sound.
 * @param {object} move - The move just played.
 * @param {{row: number, col: number}|null} kingInCheck - Square of a checked king, if any.
 */
function showMoveResult(move, kingInCheck) {
    renderPieces(boardState, move.to);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState, kingInCheck);
    announce(describeMove(move));
    try {
        if (isGameOver) {
            playSound('game_end');
        } else if (move.isCastling) {
            playSound('castle');
        } else if (move.promotion) {
            playSound('promote');
        } else if (move.captured) {
            playSound('capture');
        } else if (move.isCheck) {
            playSound('check');
        } else {
            playSound('move');
        }
    } catch { /* ignore sound errors */ }
}

/**
 * Undo the last move and restore previous game state
 */
function undoLastMove() {
    if (positionHistory.length === 0 || isGameOver && moveHistory.length === 0) return;
    cancelPendingPromotion();
    cancelAIMove();
    const takeBack = () => {
        const snapshot = positionHistory.pop();
        boardState = snapshot.boardState;
        currentPlayer = snapshot.currentPlayer;
        moveHistory.pop(); // Each snapshot is taken right before exactly one move is recorded
        isGameOver = snapshot.isGameOver;
        kingPositions = snapshot.kingPositions;
        currentStatus = snapshot.currentStatus;
        enPassantTarget = snapshot.enPassantTarget;
        halfmoveClock = snapshot.halfmoveClock || 0;
    };
    takeBack();
    // Against the computer, also take back its reply so it is the player's turn again
    if (currentPlayer === computerColor() && positionHistory.length > 0) {
        takeBack();
    }

    clearSelectedSquare();
    clearPossibleMoves();
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    updateBoardVisuals(boardState, findKingInCheck(currentPlayer));
    announce(`Move taken back. ${currentStatus}`);
    saveGameState();
    requestAIMove(); // Only happens when the computer's first move was taken back
}

/** @returns {boolean} True while the promotion chooser is waiting for an answer. */
function isPromotionPending() {
    return typeof isPromotionChooserOpen === 'function' && isPromotionChooserOpen();
}

/** Closes the promotion chooser without playing the held move. */
function cancelPendingPromotion() {
    if (isPromotionPending()) closePromotionChooser(null);
}

// --- Computer opponent ---

/** @returns {string|null} The colour the computer plays, or null in a two-player game. */
function computerColor() {
    if (!opponentLevel || !CONFIG.FEATURES.AI_OPPONENT || typeof chooseAIMove !== 'function') return null;
    return opponentOf(humanColor);
}

/** @returns {boolean} True while the player cannot move: game over, chooser open, or the computer's turn. */
function isBoardLocked() {
    return isGameOver || isPromotionPending() || currentPlayer === computerColor();
}

/**
 * Chooses who plays the other side. Takes effect at once, also in the middle
 * of a game: if it is now the computer's turn, it moves.
 * @param {string|null} level - 'easy', 'medium' or 'hard'; anything else means two players.
 * @param {string} [color] - The side the person plays.
 */
function setOpponent(level, color = WHITE) {
    opponentLevel = typeof AI_LEVELS !== 'undefined' && Object.prototype.hasOwnProperty.call(AI_LEVELS, level) ? level : null;
    humanColor = color === BLACK ? BLACK : WHITE;
    cancelAIMove();
    clearSelectedSquare();
    clearPossibleMoves();
    updateBoardVisuals(boardState, findKingInCheck(currentPlayer));
    updateStatusDisplay();
    requestAIMove();
}

/** Drops a computer move that is being worked out or waiting to be played. */
function cancelAIMove() {
    aiRequestId++;
    aiThinking = false;
}

/** @returns {Worker|null} The search worker, or null where workers are not available. */
function getAIWorker() {
    if (aiWorker === null) {
        try {
            aiWorker = typeof Worker === 'function' ? new Worker('js/ai-worker.js') : false;
        } catch {
            aiWorker = false; // For example a page opened straight from a file
        }
    }
    return aiWorker || null;
}

/**
 * If it is the computer's turn, works out its move and plays it. The search
 * runs in a Web Worker so the page stays responsive; without one it runs here
 * after the page has had a chance to draw the player's move.
 */
function requestAIMove() {
    const color = computerColor();
    if (!color || isGameOver || currentPlayer !== color) return;

    const id = ++aiRequestId;
    const position = livePosition();
    const level = opponentLevel;
    const started = Date.now();
    aiThinking = true;
    updateStatusDisplay();

    const play = (move) => {
        // A short pause, so the reply does not land in the same instant as the player's move
        const wait = Math.max(0, CONFIG.AI_MOVE_DELAY_MS - (Date.now() - started));
        setTimeout(() => {
            if (id !== aiRequestId) return; // Undone, reset or switched off in the meantime
            aiThinking = false;
            if (move) {
                makeMove(move.from.row, move.from.col, move.to.row, move.to.col, move.promotion);
            } else {
                updateStatusDisplay();
            }
        }, wait);
    };
    const thinkHere = () => setTimeout(() => {
        if (id === aiRequestId) play(chooseAIMove(position, color, level));
    }, 0);

    const worker = getAIWorker();
    if (!worker) {
        thinkHere();
        return;
    }
    worker.onmessage = (event) => {
        if (event.data.id === id) play(event.data.move);
    };
    worker.onerror = (event) => {
        if (event && event.preventDefault) event.preventDefault();
        aiWorker = false; // Do not try the worker again
        thinkHere();
    };
    worker.postMessage({ id, position, color, level });
}

// --- Draw detection ---

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

/** @returns {string|null} Why the current position is drawn, or null if it is not. */
function findDrawReason() {
    if (hasInsufficientMaterial(boardState)) return 'insufficient material';
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

// --- Rules, asked of the live game ---
// The rules themselves live in rules.js and work on any position. These are
// the same questions put to the game on the board.

/**
 * @param {string} playerColor
 * @returns {Array<{from: {row, col}, to: {row, col}}>} Every legal move for that colour.
 */
function generateAllLegalMoves(playerColor) {
    return allLegalMoves(livePosition(), playerColor);
}

/**
 * @param {number} startRow
 * @param {number} startCol
 * @returns {Array<{row: number, col: number}>} Squares the piece there can legally move to.
 */
function generateLegalMovesForPiece(startRow, startCol) {
    return legalMovesFrom(livePosition(), startRow, startCol);
}

/**
 * @param {string} playerColor
 * @returns {{row: number, col: number} | null} The king's square if it is in check, else null.
 */
function findKingInCheck(playerColor) {
    return isInCheck(livePosition(), playerColor) ? kingPositions[playerColor] : null;
}

/**
 * @param {string} playerColor
 * @param {Array<Array<Piece|null>>} [board] - Defaults to the live board.
 * @param {object} [kPos] - King positions that go with the board.
 * @returns {boolean} True if that colour's king is in check.
 */
function isKingInCheck(playerColor, board = boardState, kPos = kingPositions) {
    return isInCheck({ board, kingPositions: kPos }, playerColor);
}

/** @returns {boolean} True if the player is in check and has no legal move. */
function isCheckmate(playerColor) {
    const position = livePosition();
    return isInCheck(position, playerColor) && allLegalMoves(position, playerColor).length === 0;
}

/** @returns {boolean} True if the player is not in check and has no legal move. */
function isStalemate(playerColor) {
    const position = livePosition();
    return !isInCheck(position, playerColor) && allLegalMoves(position, playerColor).length === 0;
}

/**
 * @param {string} playerColor
 * @param {'kingside' | 'queenside'} side
 * @returns {boolean} True if that castling move is legal right now.
 */
function canCastle(playerColor, side) {
    return canCastleIn(livePosition(), playerColor, side);
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
 * Has screen readers read a message out. The status line is not a live region
 * itself, so a move and the status that follows it are read as one sentence.
 * @param {string} message
 */
function announce(message) {
    if (!announcerElement) {
        announcerElement = document.createElement('div');
        announcerElement.id = 'announcer';
        announcerElement.className = 'visually-hidden';
        announcerElement.setAttribute('role', 'status');
        announcerElement.setAttribute('aria-live', 'polite');
        document.body.appendChild(announcerElement);
    }
    announcerElement.textContent = message;
}

/**
 * Puts a move into words, followed by the new status:
 * "White knight takes on f3. Check. Black's turn".
 * @param {object} move - An entry of moveHistory.
 * @returns {string}
 */
function describeMove(move) {
    const side = move.piece.color === WHITE ? 'White' : 'Black';
    let text;
    if (move.isCastling) {
        text = `${side} castles ${move.to.col > move.from.col ? 'kingside' : 'queenside'}`;
    } else {
        const square = coordsToAlgebraic(move.to.row, move.to.col);
        text = `${side} ${PIECE_NAMES[move.piece.type]} ${move.captured ? 'takes on' : 'to'} ${square}`;
        if (move.isEnPassant) text += ' en passant';
        if (move.promotion) text += `, promotes to ${PIECE_NAMES[move.promotion]}`;
    }
    text += '.';
    if (move.isCheck && !move.isCheckmate) text += ' Check.';
    return `${text} ${currentStatus}`;
}

/**
 * Updates the game status message in the DOM.
 */
function updateStatusDisplay() {
    gameStatusElement.textContent = aiThinking ? `${currentStatus} (computer is thinking)` : currentStatus;
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
    announce(`New game. ${currentStatus}`);
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
        ['White', computerColor() === WHITE ? `Computer (${opponentLevel})` : 'White'],
        ['Black', computerColor() === BLACK ? `Computer (${opponentLevel})` : 'Black'],
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
    window.isBoardLocked = isBoardLocked;
    window.setOpponent = setOpponent;
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
        livePosition,
        setOpponent,
        computerColor,
        isBoardLocked,
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