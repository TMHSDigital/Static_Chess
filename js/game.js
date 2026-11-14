/**
 * @fileoverview The live game: its state, the flow of a move, undo, saving and
 * the page updates that follow. The rules of chess themselves are in rules.js.
 */

let boardState = getInitialPieces();
let currentPlayer = WHITE;
let moveHistory = []; // Array of move objects { from: {row, col}, to: {row, col}, piece: Piece, captured: Piece|null }
let isGameOver = false;
let kingPositions = {
    // Keep track of king positions for check detection
    [WHITE]: { row: 7, col: 4 },
    [BLACK]: { row: 0, col: 4 },
};
let currentStatus = "White's turn";
let enPassantTarget = null; // Stores coords {row, col} of square vulnerable to en passant, or null
let positionHistory = []; // Undo stack: one pre-move snapshot per move played
let halfmoveClock = 0; // Half-moves since the last pawn move or capture (fifty-move rule)
let gameResult = null; // '1-0', '0-1' or '1/2-1/2' once the game is over, else null
let endedWithoutMove = false; // True when the game ended by resignation or agreement, not by a move
let drawOffered = false; // Two-player game: a draw offer is waiting for the other side
let viewPly = null; // Number of moves played in the position being looked at; null shows the live game

const moveHistoryElement = document.getElementById('move-history');
const gameStatusElement = document.getElementById('game-status');
const liveButton = document.getElementById('live-button');
const resignButton = document.getElementById('resign-button');
const drawButton = document.getElementById('draw-button');
const capturedRows = {
    [WHITE]: document.getElementById('captured-by-white'),
    [BLACK]: document.getElementById('captured-by-black'),
};
const pendingConfirms = new Map(); // Buttons waiting for a confirming second click
let announcerElement = document.getElementById('announcer'); // Live region read out by screen readers
const resetButton = document.getElementById('reset-button');
const undoButton = document.getElementById('undo-button');
const pgnButton = document.getElementById('pgn-button');
const RESET_LABEL = resetButton ? resetButton.textContent : 'New Game';
let resetConfirmTimer = null; // Set while the New Game button is waiting for a second click

// Computer opponent
let opponentLevel = null; // null for two players, otherwise a key of AI_LEVELS ('easy', 'medium', 'hard')
let humanColor = WHITE; // The side the person plays when there is a computer opponent
let aiRequestId = 0; // Goes up whenever a pending computer move must be dropped
let aiThinking = false;
let aiWorker = null; // The Web Worker, or false once it has proved unavailable
const AI_DRAW_MARGIN = 50; // The computer agrees to a draw unless it is at least half a pawn ahead

/**
 * Initializes the game state, either from scratch or localStorage.
 */
function initializeGame() {
    loadGameState(); // Try loading saved state first
    if (moveHistory.length === 0) {
        // If no saved state or new game
        resetGame();
    }
    createBoard();
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    refreshBoardVisuals();

    // The move list: click or use the arrow keys to look at earlier positions
    moveHistoryElement.removeEventListener('click', handleMoveListClick);
    moveHistoryElement.addEventListener('click', handleMoveListClick);
    moveHistoryElement.removeEventListener('keydown', handleMoveListKeydown);
    moveHistoryElement.addEventListener('keydown', handleMoveListKeydown);
    if (liveButton) {
        liveButton.removeEventListener('click', returnToLiveGame);
        liveButton.addEventListener('click', returnToLiveGame);
    }
    if (resignButton) {
        resignButton.removeEventListener('click', handleResignClick);
        resignButton.addEventListener('click', handleResignClick);
    }
    if (drawButton) {
        drawButton.removeEventListener('click', handleDrawClick);
        drawButton.addEventListener('click', handleDrawClick);
    }

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
    debugLog('Game initialized.');
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
    debugLog('Resetting game...');
    cancelAIMove();
    boardState = getInitialPieces();
    currentPlayer = WHITE;
    moveHistory = [];
    isGameOver = false;
    kingPositions = {
        [WHITE]: { row: 7, col: 4 },
        [BLACK]: { row: 0, col: 4 },
    };
    currentStatus = "White's turn";
    enPassantTarget = null;
    positionHistory = [];
    halfmoveClock = 0;
    gameResult = null;
    endedWithoutMove = false;
    drawOffered = false;
    viewPly = null;
    cancelConfirms();
    cancelPendingPromotion();
    clearSelectedSquare();
    clearPossibleMoves();
    clearSavedGame();
    // Re-render board and pieces
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    refreshBoardVisuals();
    requestAIMove(); // The computer moves first when it plays White
}

/**
 * Handles clicks on the board squares.
 * @param {number} row
 * @param {number} col
 */
function handleBoardClick(row, col) {
    if (isBoardLocked()) return; // Game over, promotion chooser open, or the computer's turn

    const clickedPiece = boardState[row][col];
    const selected = getSelectedSquare();

    if (selected) {
        const isPossible = getPossibleMoves().some((pm) => pm.row === row && pm.col === col);
        if (isPossible) {
            playChosenMove(selected, { row, col });
        } else if (
            clickedPiece &&
            clickedPiece.color === currentPlayer &&
            (selected.row !== row || selected.col !== col)
        ) {
            // Clicked another of the player's own pieces: switch the selection to it
            setSelectedSquare(row, col);
            setPossibleMoves(generateLegalMovesForPiece(row, col));
            refreshBoardVisuals();
            return;
        }
        // Otherwise clear the selection (after a move, or a click elsewhere or on the same square)
        clearSelectedSquare();
        clearPossibleMoves();
        refreshBoardVisuals();
    } else if (clickedPiece && clickedPiece.color === currentPlayer) {
        // Selecting a piece of the current player
        setSelectedSquare(row, col);
        setPossibleMoves(generateLegalMovesForPiece(row, col));
        refreshBoardVisuals();
    }
}

/**
 * Plays a move the player picked on the board, by click or by drop. A pawn
 * reaching the last rank first asks which piece it should become; the move is
 * held until the chooser is answered.
 * @param {{row: number, col: number}} from
 * @param {{row: number, col: number}} to
 */
function playChosenMove(from, to) {
    const mover = boardState[from.row][from.col];
    const promotes = mover && mover.type === PAWN && (to.row === 0 || to.row === 7);
    if (promotes && CONFIG.FEATURES.PROMOTION_UI) {
        showPromotionChooser(mover.color, (type) => {
            makeMove(from.row, from.col, to.row, to.col, type);
        });
    } else {
        makeMove(from.row, from.col, to.row, to.col);
    }
}

/**
 * Redraws the highlights: selection, legal targets, the last move and a king in check.
 * @param {{row: number, col: number}|null} [kingInCheck] - Pass it when already known.
 */
function refreshBoardVisuals(kingInCheck) {
    const shown = shownPosition();
    if (kingInCheck === undefined || viewPly !== null) {
        kingInCheck = isInCheck(shown, shown.player) ? shown.kingPositions[shown.player] : null;
    }
    updateBoardVisuals(shown.board, kingInCheck, moveHistory[shown.ply - 1] || null);
}

/**
 * The position on screen: the live game, or an earlier position while the
 * player is looking back through the move list.
 * @returns {{board: Array, kingPositions: object, player: string, ply: number}}
 */
function shownPosition() {
    if (viewPly === null) {
        return { board: boardState, kingPositions, player: currentPlayer, ply: moveHistory.length };
    }
    const past = positionHistory[viewPly]; // The snapshot taken before move number viewPly + 1
    return {
        board: past.boardState,
        kingPositions: past.kingPositions,
        player: past.currentPlayer,
        ply: viewPly,
    };
}

/**
 * Shows the position after a number of moves without changing the game. The
 * board is locked meanwhile; showing the last position returns to the game.
 * @param {number} ply - Moves played in the position to show; 0 is the starting position.
 */
function viewMove(ply) {
    // Saves from older versions can have a move list without the positions behind it
    if (positionHistory.length !== moveHistory.length) return;
    const wanted = Math.max(0, Math.min(moveHistory.length, ply));
    viewPly = wanted === moveHistory.length ? null : wanted;
    cancelPendingPromotion();
    clearSelectedSquare();
    clearPossibleMoves();
    redraw();
    if (viewPly === null) {
        announce(`Back to the game. ${currentStatus}`);
    } else {
        announce(
            viewPly === 0 ? 'Viewing the starting position.' : `Viewing ${moveLabel(viewPly)}.`
        );
    }
}

/** Shows the live game again. */
function returnToLiveGame() {
    viewMove(moveHistory.length);
}

/** @returns {string} A move with its number, such as "12. Nf3" or "12... Nf6". */
function moveLabel(ply) {
    const dots = ply % 2 === 1 ? '.' : '...';
    return `${Math.ceil(ply / 2)}${dots} ${moveHistory[ply - 1].notation}`;
}

/** Redraws everything that depends on the position on screen. */
function redraw() {
    renderPieces(shownPosition().board);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    refreshBoardVisuals();
}

/** A click on a move in the list shows the position after it. */
function handleMoveListClick(event) {
    const entry = event.target.closest ? event.target.closest('button[data-ply]') : null;
    if (!entry) return;
    viewMove(Number(entry.dataset.ply));
    focusCurrentMove();
}

/** Left and Right step through the game from the move list; Home and End jump to its ends. */
function handleMoveListKeydown(event) {
    const shown = shownPosition().ply;
    const targets = {
        ArrowLeft: shown - 1,
        ArrowRight: shown + 1,
        Home: 0,
        End: moveHistory.length,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    viewMove(targets[event.key]);
    focusCurrentMove();
}

/** The list is rebuilt on every change, so focus has to be put back by hand. */
function focusCurrentMove() {
    const entry = moveHistoryElement.querySelector('button[tabindex="0"]');
    if (entry) entry.focus();
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
    viewPly = null; // A move (for example the computer's reply) brings the live game back
    drawOffered = false; // Playing on declines a draw offer
    cancelConfirms();

    // --- Save snapshot for undo ---
    // applyMove builds a new position and leaves the old one untouched, so the
    // snapshot can keep the current objects as they are.
    const before = {
        boardState,
        currentPlayer,
        isGameOver,
        kingPositions,
        currentStatus,
        enPassantTarget,
        halfmoveClock,
    };
    positionHistory.push(before);

    // --- Apply the move ---
    const result = applyMove(
        livePosition(),
        { row: startRow, col: startCol },
        { row: endRow, col: endCol },
        promotionType
    );
    const move = {
        ...result.move,
        notation: '',
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
    };
    boardState = result.position.board;
    kingPositions = result.position.kingPositions;
    enPassantTarget = result.position.enPassantTarget;
    halfmoveClock = move.piece.type === PAWN || move.captured ? 0 : halfmoveClock + 1; // Fifty-move rule counter
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
            gameResult = currentPlayer === WHITE ? '0-1' : '1-0';
            currentStatus = `Checkmate! ${currentPlayer === WHITE ? 'Black' : 'White'} wins.`;
        }
    } else if (isStalemate(currentPlayer)) {
        move.isStalemate = true;
        isGameOver = true;
        gameResult = '1/2-1/2';
        currentStatus = 'Stalemate! Game is a draw.';
    }
    if (!isGameOver) {
        const drawReason = findDrawReason();
        if (drawReason) {
            move.isDraw = true;
            isGameOver = true;
            gameResult = '1/2-1/2';
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
    refreshBoardVisuals(kingInCheck);
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
    } catch {
        /* ignore sound errors */
    }
}

/**
 * Undo the last move and restore previous game state
 */
function undoLastMove() {
    const reopen = endedWithoutMove; // A resignation or agreed draw is taken back on its own
    if (!reopen && (positionHistory.length === 0 || (isGameOver && moveHistory.length === 0))) {
        return;
    }
    cancelPendingPromotion();
    cancelAIMove();
    cancelConfirms();
    viewPly = null;
    drawOffered = false;
    gameResult = null;
    endedWithoutMove = false;
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
    if (reopen) {
        isGameOver = false;
        currentStatus = `${currentPlayer === WHITE ? 'White' : 'Black'}'s turn`;
    } else {
        takeBack();
        // Against the computer, also take back its reply so it is the player's turn again
        if (currentPlayer === computerColor() && positionHistory.length > 0) {
            takeBack();
        }
    }

    clearSelectedSquare();
    clearPossibleMoves();
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    refreshBoardVisuals();
    announce(reopen ? `Game reopened. ${currentStatus}` : `Move taken back. ${currentStatus}`);
    saveGameState();
    requestAIMove(); // The computer's first move was taken back, or the game was reopened on its turn
}

// --- Ending the game without a move ---

/**
 * Asks for a confirming second click on a button, so a mis-tap cannot end the
 * game. The first click changes the label for a few seconds.
 * @param {HTMLElement} button
 * @param {string} question - Label shown while waiting.
 * @returns {boolean} True on the confirming click.
 */
function confirmSecondClick(button, question) {
    if (pendingConfirms.has(button)) {
        cancelConfirm(button);
        return true;
    }
    pendingConfirms.set(button, {
        label: button.textContent,
        timer: setTimeout(() => cancelConfirm(button), CONFIG.RESET_CONFIRM_MS),
    });
    button.textContent = question;
    button.classList.add('confirming');
    return false;
}

/** Puts a button waiting for confirmation back to normal. */
function cancelConfirm(button) {
    const pending = pendingConfirms.get(button);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingConfirms.delete(button);
    button.textContent = pending.label;
    button.classList.remove('confirming');
}

/** Drops every confirmation that is waiting; used whenever the game moves on. */
function cancelConfirms() {
    for (const button of Array.from(pendingConfirms.keys())) cancelConfirm(button);
}

/**
 * Ends the game with a result that no move produced. Undo reopens it.
 * @param {string} result - '1-0', '0-1' or '1/2-1/2'.
 * @param {string} status - What the status line says.
 */
function endGameWithoutMove(result, status) {
    cancelPendingPromotion();
    cancelAIMove();
    cancelConfirms();
    isGameOver = true;
    gameResult = result;
    endedWithoutMove = true;
    drawOffered = false;
    viewPly = null;
    currentStatus = status;
    clearSelectedSquare();
    clearPossibleMoves();
    redraw();
    announce(currentStatus);
    try {
        playSound('game_end');
    } catch {
        /* ignore sound errors */
    }
    saveGameState();
}

/** @returns {boolean} True while a game with at least one move is still being played. */
function isGameInProgress() {
    return moveHistory.length > 0 && !isGameOver;
}

/**
 * Resigns the game. Against the computer it is the person who resigns; with
 * two players it is the side to move.
 */
function resign() {
    if (!isGameInProgress()) return;
    const loser = computerColor() ? humanColor : currentPlayer;
    endGameWithoutMove(
        loser === WHITE ? '0-1' : '1-0',
        loser === WHITE ? 'White resigned. Black wins.' : 'Black resigned. White wins.'
    );
}

/** Handles the Resign button, which needs a confirming second click. */
function handleResignClick() {
    if (!isGameInProgress()) return;
    if (confirmSecondClick(resignButton, 'Resign?')) resign();
}

/**
 * Handles the draw button. With two players the first click offers a draw and
 * a second one, by the other side, accepts it; playing a move declines. The
 * computer answers at once: it agrees unless it thinks it is ahead.
 */
function handleDrawClick() {
    if (!isGameInProgress()) return;
    const computer = computerColor();
    if (computer) {
        if (evaluatePosition(livePosition(), computer) < AI_DRAW_MARGIN) {
            endGameWithoutMove('1/2-1/2', 'Draw by agreement.');
        } else {
            announce('The computer declines the draw.');
            gameStatusElement.textContent = `The computer declines the draw. ${currentStatus}`;
        }
        return;
    }
    if (drawOffered) {
        endGameWithoutMove('1/2-1/2', 'Draw by agreement.');
        return;
    }
    drawOffered = true;
    updateStatusDisplay();
    announce(`${currentPlayer === WHITE ? 'White' : 'Black'} offers a draw.`);
}

/** @returns {boolean} True while the promotion chooser is waiting for an answer. */
function isPromotionPending() {
    return isPromotionChooserOpen();
}

/** Closes the promotion chooser without playing the held move. */
function cancelPendingPromotion() {
    if (isPromotionPending()) closePromotionChooser(null);
}

// --- Computer opponent ---

/** @returns {string|null} The colour the computer plays, or null in a two-player game. */
function computerColor() {
    if (!opponentLevel || !CONFIG.FEATURES.AI_OPPONENT) return null;
    return opponentOf(humanColor);
}

/** @returns {boolean} True while the player cannot move: game over, chooser open, or the computer's turn. */
function isBoardLocked() {
    return (
        isGameOver || viewPly !== null || isPromotionPending() || currentPlayer === computerColor()
    );
}

/**
 * Chooses who plays the other side. Takes effect at once, also in the middle
 * of a game: if it is now the computer's turn, it moves.
 * @param {string|null} level - 'easy', 'medium' or 'hard'; anything else means two players.
 * @param {string} [color] - The side the person plays.
 */
function setOpponent(level, color = WHITE) {
    opponentLevel = Object.prototype.hasOwnProperty.call(AI_LEVELS, level) ? level : null;
    humanColor = color === BLACK ? BLACK : WHITE;
    drawOffered = false;
    cancelConfirms();
    cancelAIMove();
    clearSelectedSquare();
    clearPossibleMoves();
    refreshBoardVisuals();
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
    const thinkHere = () =>
        setTimeout(() => {
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
    currentPlayer = currentPlayer === WHITE ? BLACK : WHITE;
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
        gameResult: gameResult,
        endedWithoutMove: endedWithoutMove,
        positionHistory: positionHistory, // Undo stack, so Undo still works after a reload
    };
    try {
        localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(gameState));
    } catch (e) {
        console.error('Error saving game state:', e);
    }
}

/** Removes the saved game. Storage may be unavailable, which must not stop the game. */
function clearSavedGame() {
    try {
        localStorage.removeItem(SAVED_GAME_KEY);
    } catch (e) {
        console.error('Error clearing saved game:', e);
    }
}

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
        if (
            !move ||
            !isValidCoords(move.from) ||
            !isValidCoords(move.to) ||
            typeof move.notation !== 'string'
        ) {
            return null;
        }
    }

    const target = saved.enPassantTarget === undefined ? null : saved.enPassantTarget;
    if (target !== null && !isValidCoords(target)) return null;

    // The undo stack is optional: saves from older versions do not have one.
    // If it is missing or damaged the game still loads, with nothing to undo.
    let undoStack = [];
    if (Array.isArray(saved.positionHistory) && saved.positionHistory.length === history.length) {
        const usable = saved.positionHistory.every(
            (s) =>
                s &&
                isValidBoard(s.boardState) &&
                (s.currentPlayer === WHITE || s.currentPlayer === BLACK) &&
                (s.enPassantTarget === null || isValidCoords(s.enPassantTarget))
        );
        if (usable) {
            undoStack = saved.positionHistory.map((s) => ({
                boardState: s.boardState,
                currentPlayer: s.currentPlayer,
                isGameOver: !!s.isGameOver,
                kingPositions: findKingPositions(s.boardState),
                currentStatus: typeof s.currentStatus === 'string' ? s.currentStatus : '',
                enPassantTarget: s.enPassantTarget,
                halfmoveClock: cleanClock(s.halfmoveClock),
            }));
        }
    }

    // Saves from before results were stored: work the result out from the last move
    const over = !!saved.isGameOver;
    let result = null;
    if (over) {
        const last = history[history.length - 1];
        if (['1-0', '0-1', '1/2-1/2'].includes(saved.gameResult)) result = saved.gameResult;
        else if (last && last.isCheckmate) result = saved.currentPlayer === WHITE ? '0-1' : '1-0';
        else result = '1/2-1/2';
    }

    return {
        gameResult: result,
        endedWithoutMove: over && saved.endedWithoutMove === true,
        boardState: saved.boardState,
        currentPlayer: saved.currentPlayer,
        moveHistory: history,
        isGameOver: over,
        kingPositions: findKingPositions(saved.boardState),
        currentStatus:
            typeof saved.currentStatus === 'string' ? saved.currentStatus : 'Game loaded',
        enPassantTarget: target,
        halfmoveClock: cleanClock(saved.halfmoveClock),
        positionHistory: undoStack,
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
        console.error('Error loading game state:', e);
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
    gameResult = state.gameResult;
    endedWithoutMove = state.endedWithoutMove;
    return true;
}

// --- UI Updates ---

/**
 * Updates the move history display in the DOM.
 */
function updateMoveHistoryDisplay() {
    moveHistoryElement.innerHTML = ''; // Clear existing
    const shownPly = shownPosition().ply;
    const canView = positionHistory.length === moveHistory.length;
    let listItem = null;
    let current = null; // The entry for the position on screen

    moveHistory.forEach((move, index) => {
        const ply = index + 1;
        if (index % 2 === 0) {
            // White's move starts a new row
            listItem = document.createElement('li');
            const turnSpan = document.createElement('span');
            turnSpan.classList.add('turn-number');
            turnSpan.textContent = `${index / 2 + 1}.`;
            listItem.appendChild(turnSpan);
            moveHistoryElement.appendChild(listItem);
        }

        // Each move is a button that shows the position after it. Only one is
        // in the tab order; the arrow keys step between them.
        const entry = document.createElement('button');
        entry.type = 'button';
        entry.classList.add('move', index % 2 === 0 ? 'white-move' : 'black-move');
        entry.textContent = move.notation;
        entry.dataset.ply = ply;
        entry.tabIndex = -1;
        entry.disabled = !canView;
        if (ply === shownPly) {
            entry.setAttribute('aria-current', 'true');
            current = entry;
        }
        listItem.appendChild(entry);
    });

    const tabStop = current || moveHistoryElement.querySelector('button[data-ply]');
    if (tabStop) tabStop.tabIndex = 0;

    // Highlight the row of the last move played
    if (moveHistoryElement.lastElementChild) {
        moveHistoryElement.lastElementChild.classList.add('last-move-entry');
    }

    if (viewPly === null) {
        moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight; // Follow the game
    } else if (current && typeof current.scrollIntoView === 'function') {
        current.scrollIntoView({ block: 'nearest' });
    }

    updateCapturedDisplay(); // Follows the same position as the list
}

/**
 * Lists what each side has captured up to the position on screen, and how far
 * ahead in material the leading side is.
 */
function updateCapturedDisplay() {
    const shown = shownPosition();
    const taken = { [WHITE]: [], [BLACK]: [] }; // Keyed by the side that made the captures
    for (const move of moveHistory.slice(0, shown.ply)) {
        if (move.captured && move.piece) taken[move.piece.color].push(move.captured.type);
    }
    // The lead is counted on the board, so promotions are included
    let lead = 0;
    for (const row of shown.board) {
        for (const piece of row) {
            if (piece) lead += (piece.color === WHITE ? 1 : -1) * PIECE_POINTS[piece.type];
        }
    }

    const order = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN];
    for (const color of [WHITE, BLACK]) {
        const rowElement = capturedRows[color];
        if (!rowElement) continue;
        const side = color === WHITE ? 'White' : 'Black';
        const ahead = color === WHITE ? lead : -lead;
        const types = taken[color].sort((a, b) => order.indexOf(a) - order.indexOf(b));

        rowElement.innerHTML = '';
        for (const type of types) {
            const icon = document.createElement('span');
            icon.classList.add('captured-piece');
            icon.style.backgroundImage = `url('assets/${opponentOf(color)}${type}.svg')`;
            rowElement.appendChild(icon);
        }
        if (ahead > 0) {
            const leadElement = document.createElement('span');
            leadElement.classList.add('material-lead');
            leadElement.textContent = `+${ahead}`;
            rowElement.appendChild(leadElement);
        }

        const counts = order
            .map((type) => [type, types.filter((t) => t === type).length])
            .filter(([, count]) => count > 0)
            .map(([type, count]) =>
                count === 1 ? PIECE_NAMES[type] : `${count} ${PIECE_NAMES[type]}s`
            );
        let label = `${side} has captured ${counts.length ? counts.join(', ') : 'nothing'}.`;
        if (ahead > 0) label += ` ${side} is ahead by ${ahead}.`;
        rowElement.setAttribute('aria-label', label);
    }
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
    if (viewPly !== null) {
        gameStatusElement.textContent =
            viewPly === 0 ? 'Viewing the starting position' : `Viewing ${moveLabel(viewPly)}`;
    } else if (aiThinking) {
        gameStatusElement.textContent = `${currentStatus} (computer is thinking)`;
    } else if (drawOffered) {
        gameStatusElement.textContent = `${currentStatus} (draw offered)`;
    } else {
        gameStatusElement.textContent = currentStatus;
    }
    if (liveButton) {
        liveButton.hidden = viewPly === null;
    }
    // Undo is only available while there is a move, or a resignation or agreed draw, to take back
    if (undoButton) {
        undoButton.disabled = positionHistory.length === 0 && !endedWithoutMove;
    }
    if (pgnButton) {
        pgnButton.disabled = moveHistory.length === 0;
    }
    if (resignButton) {
        resignButton.disabled = !isGameInProgress();
    }
    if (drawButton) {
        drawButton.disabled = !isGameInProgress();
        drawButton.textContent = drawOffered ? 'Accept draw?' : 'Offer draw';
        drawButton.classList.toggle('confirming', drawOffered);
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
    const result = (isGameOver && gameResult) || '*'; // "*" marks a game still in progress

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
        ['Result', result],
    ].map(([name, value]) => `[${name} "${value}"]`);

    const moves = moveHistory.map((move, index) => {
        const san = move.notation.replace(' e.p.', ''); // Not valid in PGN
        return index % 2 === 0 ? `${index / 2 + 1}. ${san}` : san;
    });

    // A resignation or agreed draw is not visible in the moves, so say it in a comment
    const ending = endedWithoutMove ? [`{${currentStatus.replace(/[{}]/g, '')}}`] : [];

    return `${tags.join('\n')}\n\n${[...moves, ...ending, result].join(' ')}\n`;
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
        setTimeout(() => {
            pgnButton.textContent = original;
        }, 1500);
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
                            if (isPathObstructed(r, c, move.to.row, move.to.col, boardBefore))
                                continue;
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
            if (!rivals.some((o) => o.col === move.from.col)) disambiguation = from[0];
            else if (!rivals.some((o) => o.row === move.from.row)) disambiguation = from[1];
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

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeGame,
        handleBoardClick,
        playChosenMove,
        refreshBoardVisuals,
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
        viewMove,
        returnToLiveGame,
        resign,
        handleResignClick,
        handleDrawClick,
        get gameResult() {
            return gameResult;
        },
        get viewPly() {
            return viewPly;
        },
        // Export state variables for test access
        get boardState() {
            return boardState;
        },
        get currentPlayer() {
            return currentPlayer;
        },
        get moveHistory() {
            return moveHistory;
        },
        get isGameOver() {
            return isGameOver;
        },
        get kingPositions() {
            return kingPositions;
        },
        get currentStatus() {
            return currentStatus;
        },
        get enPassantTarget() {
            return enPassantTarget;
        },
        get positionHistory() {
            return positionHistory;
        },
        get halfmoveClock() {
            return halfmoveClock;
        },
    };
}
