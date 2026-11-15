/**
 * @fileoverview The live game: its state, the flow of a move, undo, saving and
 * the page updates that follow. The rules of chess themselves are in rules.js.
 */

// How a game begins unless it is started from another position: White to move, move 1
const STANDARD_START = { player: WHITE, halfmoveClock: 0, fullmove: 1, fen: null };
let gameStart = STANDARD_START; // How this game began; fen is its first position unless that is the usual one

let boardState = initialPosition().board;
let currentPlayer = WHITE;
let moveHistory = []; // Array of move objects { from: {row, col}, to: {row, col}, piece: Piece, captured: Piece|null }
let isGameOver = false;
let kingPositions = initialPosition().kingPositions; // Kept for check detection
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
const stepButtons = document.getElementById('step-buttons');
const reviewScoreElement = document.getElementById('review-score');
const resignButton = document.getElementById('resign-button');
const drawButton = document.getElementById('draw-button');
const capturedRows = {
    [WHITE]: document.getElementById('captured-by-white'),
    [BLACK]: document.getElementById('captured-by-black'),
};
const pendingConfirms = new Map(); // Buttons waiting for a confirming second click
const clockElements = {
    [WHITE]: document.getElementById('clock-white'),
    [BLACK]: document.getElementById('clock-black'),
};
let chosenTimeControl = null; // Key of CONFIG.TIME_CONTROLS for the next game; null for no clock
// The clock of the game being played, or null: { control, base, increment,
// remaining: {w, b} } in milliseconds, and turnStartedAt, the time the side to
// move was put on the clock (null while no clock is running)
let clock = null;
let clockTimer = null; // Interval that redraws a running clock
const hintButton = document.getElementById('hint-button');
let hintMove = null; // The move the engine suggested for the current position, if asked
let hintPending = false; // True while the engine is working out a hint
let announcerElement = document.getElementById('announcer'); // Live region read out by screen readers
const resetButton = document.getElementById('reset-button');
const undoButton = document.getElementById('undo-button');
const pgnButton = document.getElementById('pgn-button');
const fenButton = document.getElementById('fen-button');
const importButton = document.getElementById('import-button');
const importDialog = document.getElementById('import-dialog');
const importText = document.getElementById('import-text');
const importError = document.getElementById('import-error');
const importLoadButton = document.getElementById('import-load');
const importCancelButton = document.getElementById('import-cancel');
const archiveSection = document.getElementById('archive-section');
const archiveList = document.getElementById('archive-list');
const RESET_LABEL = resetButton ? resetButton.textContent : 'New Game';
let resetConfirmTimer = null; // Set while the New Game button is waiting for a second click

// Computer opponent
let opponentLevel = null; // null for two players, otherwise a key of AI_LEVELS ('easy', 'medium', 'hard')
let humanColor = WHITE; // The side the person plays when there is a computer opponent
let aiRequestId = 0; // Goes up whenever a pending computer move must be dropped
let aiThinking = false;
let aiWorker = null; // The Web Worker, or false once it has proved unavailable
let aiWorkerBusy = false; // True from a request to the worker until its answer
const AI_DRAW_MARGIN = 50; // The computer agrees to a draw unless it is at least half a pawn ahead

/**
 * The live position as one record. These two functions are the only places
 * that list its fields: the undo stack, saving, loading and a new game all go
 * through them.
 * @returns {object}
 */
function currentSnapshot() {
    return {
        boardState,
        currentPlayer,
        isGameOver,
        kingPositions,
        currentStatus,
        enPassantTarget,
        halfmoveClock,
    };
}

/** Makes a record from currentSnapshot the live position. */
function restoreSnapshot(snapshot) {
    boardState = snapshot.boardState;
    currentPlayer = snapshot.currentPlayer;
    isGameOver = snapshot.isGameOver;
    kingPositions = snapshot.kingPositions;
    currentStatus = snapshot.currentStatus;
    enPassantTarget = snapshot.enPassantTarget;
    halfmoveClock = snapshot.halfmoveClock || 0;
}

/**
 * Initializes the game state, either from scratch or localStorage.
 */
function initializeGame() {
    if (loadGameState()) {
        // A computer move asked for before the saved game was loaded belongs to another position
        cancelAIMove();
    }
    if (moveHistory.length === 0 && !gameStart.fen) {
        // No saved game, or one without a move: start afresh. A position that
        // was loaded from FEN is kept even before its first move.
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
    if (stepButtons) {
        stepButtons.removeEventListener('click', handleStepClick);
        stepButtons.addEventListener('click', handleStepClick);
    }
    if (archiveList) {
        archiveList.removeEventListener('click', handleArchiveClick);
        archiveList.addEventListener('click', handleArchiveClick);
    }
    if (resignButton) {
        resignButton.removeEventListener('click', handleResignClick);
        resignButton.addEventListener('click', handleResignClick);
    }
    if (drawButton) {
        drawButton.removeEventListener('click', handleDrawClick);
        drawButton.addEventListener('click', handleDrawClick);
    }
    if (hintButton) {
        hintButton.removeEventListener('click', requestHint);
        hintButton.addEventListener('click', requestHint);
    }
    // Keep the clock times when the page is closed in the middle of a turn
    window.removeEventListener('pagehide', saveGameInProgress);
    window.addEventListener('pagehide', saveGameInProgress);
    runClockTimer();

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
    if (fenButton) {
        fenButton.removeEventListener('click', copyFEN);
        fenButton.addEventListener('click', copyFEN);
    }
    if (importButton && importDialog) {
        importButton.removeEventListener('click', openImportDialog);
        importButton.addEventListener('click', openImportDialog);
        importLoadButton.removeEventListener('click', handleImportLoad);
        importLoadButton.addEventListener('click', handleImportLoad);
        importCancelButton.removeEventListener('click', closeImportDialog);
        importCancelButton.addEventListener('click', closeImportDialog);
        importDialog.removeEventListener('keydown', handleImportKeydown);
        importDialog.addEventListener('keydown', handleImportKeydown);
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
 * Starts a game from a position, by default the usual one, without drawing it
 * or asking the computer for a move.
 * @param {object} [position] - A rules.js position.
 * @param {string} [player] - The side to move.
 * @param {number} [startClock] - Half-moves since the last pawn move or capture.
 * @param {number} [fullmove] - Number of the move about to be played.
 */
function startGameFrom(position = initialPosition(), player = WHITE, startClock = 0, fullmove = 1) {
    cancelAIMove();
    archiveCurrentGame(); // The game being replaced stays in the list of past games
    const fen = positionToFEN(position, player, startClock, fullmove);
    const usual = fen === positionToFEN(initialPosition(), WHITE, 0, 1);
    gameStart = { player, halfmoveClock: startClock, fullmove, fen: usual ? null : fen };
    restoreSnapshot({
        boardState: position.board,
        currentPlayer: player,
        isGameOver: false,
        kingPositions: position.kingPositions,
        currentStatus: `${player === WHITE ? 'White' : 'Black'}'s turn`,
        enPassantTarget: position.enPassantTarget,
        halfmoveClock: startClock,
    });
    moveHistory = [];
    positionHistory = [];
    gameResult = null;
    endedWithoutMove = false;
    drawOffered = false;
    viewPly = null;
    clock = newClock();
    runClockTimer();
    cancelConfirms();
    cancelPendingPromotion();
    clearSelectedSquare();
    clearPossibleMoves();
    clearSavedGame();
}

/**
 * Resets the game to the initial state.
 */
function resetGame() {
    debugLog('Resetting game...');
    startGameFrom();
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
    showHintOnBoard();
}

/**
 * The position on screen: the live game, or an earlier position while the
 * player is looking back through the move list.
 * @returns {{board: Array, kingPositions: object, player: string, ply: number}}
 */
function shownPosition() {
    // While looking back: the snapshot taken before move number viewPly + 1
    const shown = viewPly === null ? currentSnapshot() : positionHistory[viewPly];
    return {
        board: shown.boardState,
        kingPositions: shown.kingPositions,
        enPassantTarget: shown.enPassantTarget,
        halfmoveClock: shown.halfmoveClock || 0,
        player: shown.currentPlayer,
        ply: viewPly === null ? moveHistory.length : viewPly,
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
    showReviewScore();
    if (viewPly === null) {
        announce(`Back to the game. ${currentStatus}`);
    } else {
        announce(
            viewPly === 0 ? 'Viewing the starting position.' : `Viewing ${moveLabel(viewPly)}.`
        );
    }
}

/**
 * Says what the engine makes of the position being looked at, in a line under
 * the move list. It is worked out on the page, so a computer move being
 * thought about in the worker is not disturbed, and it is not announced:
 * screen reader users find it under the move list when they want it.
 */
function showReviewScore() {
    if (!reviewScoreElement || viewPly === null) return;
    const shown = shownPosition();
    const { score, mate, over } = assessPosition(shown, shown.player);
    const ahead = score > 0 ? 'White' : 'Black';
    const pawns = Math.abs(score) / 100;
    let text;
    if (over) {
        text = mate ? 'Checkmate.' : 'Stalemate.';
    } else if (mate) {
        text = `Engine thinks ${ahead} can force mate.`;
    } else if (pawns < 0.3) {
        text = 'Engine thinks the position is about equal.';
    } else {
        text = `Engine thinks ${ahead} is ahead by ${pawns.toFixed(1)}.`;
    }
    reviewScoreElement.textContent = text;
}

/** Shows the live game again. */
function returnToLiveGame() {
    viewMove(moveHistory.length);
}

/**
 * The number a move carries in the move list, in PGN and in FEN. Everything
 * that numbers moves asks here, so a game need not begin with White's move 1.
 * @param {number} index - How many moves were played before it.
 * @param {object} [start] - How the game began; this game by default.
 * @returns {{number: number, white: boolean}} The move number and whose move it is.
 */
function moveNumberAt(index, start = gameStart) {
    const halfMoves = index + (start.player === BLACK ? 1 : 0);
    return { number: start.fullmove + Math.floor(halfMoves / 2), white: halfMoves % 2 === 0 };
}

/** @returns {string} A move number as written before the move: "12." for White, "12..." for Black. */
function moveNumberText(index, start = gameStart) {
    const { number, white } = moveNumberAt(index, start);
    return `${number}${white ? '.' : '...'}`;
}

/** @returns {string} A move with its number, such as "12. Nf3" or "12... Nf6". */
function moveLabel(ply) {
    return `${moveNumberText(ply - 1)} ${moveHistory[ply - 1].notation}`;
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

/** The buttons under the move list step to the first, previous, next or last position. */
function handleStepClick(event) {
    const button = event.target.closest ? event.target.closest('button[data-step]') : null;
    if (!button || button.disabled) return;
    const shown = shownPosition().ply;
    const targets = {
        first: 0,
        previous: shown - 1,
        next: shown + 1,
        last: moveHistory.length,
    };
    viewMove(targets[button.dataset.step]);
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
 * Plays a move in the live game and then updates the page: clock, board, move
 * list, announcement, sound, the saved game and the computer's reply. The
 * move is not checked for legality; callers pick it from
 * generateLegalMovesForPiece. A finished game takes no more moves.
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 * @param {string} [promotionType] - Piece a pawn reaching the last rank becomes; queen by default.
 */
function makeMove(startRow, startCol, endRow, endCol, promotionType = QUEEN) {
    if (isGameOver || !boardState[startRow][startCol]) return;
    viewPly = null; // A move (for example the computer's reply) brings the live game back
    drawOffered = false; // Playing on declines a draw offer
    clearHint();
    cancelConfirms();
    // The mover's clock stops and gains the increment. White's first move is not timed.
    if (clock && clock.turnStartedAt !== null) {
        clock.remaining[currentPlayer] = clockRemaining(currentPlayer) + clock.increment;
        clock.turnStartedAt = null;
    }

    const { move, kingInCheck } = playMove(startRow, startCol, endRow, endCol, promotionType);
    endIfAutomaticDraw(move);
    debugLog(move.notation, '-', currentStatus);
    if (clock && !isGameOver) clock.turnStartedAt = Date.now(); // The other side is on the clock
    runClockTimer();

    showMoveResult(move, kingInCheck);
    saveGameState();
    requestAIMove();
}

/**
 * The change a move makes to the game itself: applies it, records it for the
 * move list and for undo, and ends the game on checkmate or stalemate.
 * Nothing on the page changes and nothing is saved, so a loaded game can be
 * played in through this alone. A draw by repetition, the fifty-move rule or
 * lack of material is for the caller to declare (endIfAutomaticDraw).
 * @returns {{move: object, kingInCheck: {row: number, col: number}|null}|null}
 *   The move as recorded and the square of a king it checks; null if the game
 *   is over or the start square is empty.
 */
function playMove(startRow, startCol, endRow, endCol, promotionType = QUEEN) {
    if (isGameOver) return null; // Nothing is added to a finished game
    if (!boardState[startRow][startCol]) return null; // Should not happen if logic is correct

    // --- Save snapshot for undo ---
    // applyMove builds a new position and leaves the old one untouched, so the
    // snapshot can keep the current objects as they are.
    const before = currentSnapshot();
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
    move.notation = generateNotationWithDisambiguation(move, {
        board: before.boardState,
        kingPositions: before.kingPositions,
        enPassantTarget: before.enPassantTarget,
    });
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
        currentStatus = `${currentPlayer === WHITE ? 'White' : 'Black'}'s turn`;
    }
    return { move, kingInCheck: opponentKingInCheck };
}

/**
 * Ends the game as a draw if the position on the board is drawn by the rules
 * (insufficient material, threefold repetition or the fifty-move rule).
 * @param {object} move - The move that led to the position.
 */
function endIfAutomaticDraw(move) {
    const drawReason = isGameOver ? null : findDrawReason();
    if (!drawReason) return;
    move.isDraw = true;
    isGameOver = true;
    gameResult = '1/2-1/2';
    currentStatus = `Draw by ${drawReason}.`;
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
    if (clock) return; // No taking moves back on the clock
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
        restoreSnapshot(positionHistory.pop());
        moveHistory.pop(); // Each snapshot is taken right before exactly one move is recorded
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
    if (clock && clock.turnStartedAt !== null) {
        clock.remaining[currentPlayer] = clockRemaining(currentPlayer); // Stop the clock
        clock.turnStartedAt = null;
    }
    runClockTimer();
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
    stopWorkerSearch();
    aiThinking = false;
    hintPending = false; // A hint being worked out shares the engine and is dropped with it
    hintMove = null;
}

/**
 * Stops a search the worker is still running. A worker cannot be interrupted,
 * so it is shut down and a new one is started with the next request; that
 * request then does not have to wait for a search nobody wants any more.
 */
function stopWorkerSearch() {
    if (aiWorker && aiWorkerBusy) {
        aiWorker.terminate();
        aiWorker = null;
    }
    aiWorkerBusy = false;
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

    const started = Date.now();
    aiThinking = true;
    updateStatusDisplay();

    const id = askEngine(livePosition(), color, opponentLevel, (move) => {
        // A short pause, so the reply does not land in the same instant as the player's move
        const wait = Math.max(0, CONFIG.AI_MOVE_DELAY_MS - (Date.now() - started));
        setTimeout(() => {
            if (id !== aiRequestId) return; // Undone, reset or switched off in the meantime
            aiThinking = false;
            // The move was worked out for one position: never play it on another
            const stillItsTurn = !isGameOver && currentPlayer === color;
            const legal =
                stillItsTurn &&
                move &&
                generateLegalMovesForPiece(move.from.row, move.from.col).some(
                    (target) => target.row === move.to.row && target.col === move.to.col
                );
            if (legal) {
                makeMove(move.from.row, move.from.col, move.to.row, move.to.col, move.promotion);
            } else {
                updateStatusDisplay();
            }
        }, wait);
    });
}

/**
 * Asks the engine for a move. The search runs in a Web Worker so the page
 * stays responsive; without one it runs here after the page has had a chance
 * to draw. Only the latest request is answered: a newer one, or cancelAIMove,
 * drops it.
 * @param {object} position - A rules.js position.
 * @param {string} color - The side to find a move for.
 * @param {string} level - A key of AI_LEVELS.
 * @param {(move: object|null) => void} onMove - Called with the engine's move.
 * @returns {number} The id of the request, to compare with aiRequestId later.
 */
function askEngine(position, color, level, onMove) {
    const id = ++aiRequestId;
    stopWorkerSearch(); // A request still being worked on is replaced by this one
    // The positions the game has been through, so the engine can avoid repeating them
    const seen = positionHistory.map((past) =>
        positionKey(past.boardState, past.currentPlayer, past.enPassantTarget)
    );
    const thinkHere = () =>
        setTimeout(() => {
            if (id !== aiRequestId) return;
            onMove(chooseAIMove(position, color, level, Math.random, { seen }));
        }, 0);

    const worker = getAIWorker();
    if (!worker) {
        thinkHere();
        return id;
    }
    worker.onmessage = (event) => {
        if (event.data.id !== id) return;
        aiWorkerBusy = false;
        onMove(event.data.move);
    };
    worker.onerror = (event) => {
        if (event && event.preventDefault) event.preventDefault();
        aiWorker = false; // Do not try the worker again
        aiWorkerBusy = false;
        thinkHere();
    };
    aiWorkerBusy = true;
    worker.postMessage({ id, position, color, level, seen });
    return id;
}

// --- Clock ---

/**
 * Chooses the clock for the next game. A game that has not started yet takes
 * it at once; a game in progress keeps the clock it started with.
 * @param {string} key - A key of CONFIG.TIME_CONTROLS; anything without minutes means no clock.
 */
function setTimeControl(key) {
    const known = Object.prototype.hasOwnProperty.call(CONFIG.TIME_CONTROLS, key);
    chosenTimeControl =
        CONFIG.FEATURES.GAME_TIMER && known && CONFIG.TIME_CONTROLS[key].minutes ? key : null;
    if (moveHistory.length === 0 && !isGameOver) {
        clock = newClock();
        updateStatusDisplay();
    }
}

/** @returns {object|null} A full clock for the chosen time control, or null without one. */
function newClock() {
    if (!chosenTimeControl) return null;
    const control = CONFIG.TIME_CONTROLS[chosenTimeControl];
    const base = control.minutes * 60000;
    return {
        control: chosenTimeControl,
        base,
        increment: (control.increment || 0) * 1000,
        remaining: { [WHITE]: base, [BLACK]: base },
        turnStartedAt: null,
    };
}

/** @returns {number} Milliseconds a side has left right now; never below zero. */
function clockRemaining(color) {
    if (!clock) return 0;
    const running = clock.turnStartedAt !== null && color === currentPlayer;
    const used = running ? Date.now() - clock.turnStartedAt : 0;
    return Math.max(0, clock.remaining[color] - used);
}

/** @returns {string} A time as "m:ss", with tenths of a second in the last ten seconds. */
function formatClock(ms) {
    if (ms < 10000) return `0:0${Math.floor(ms / 1000)}.${Math.floor((ms % 1000) / 100)}`;
    const seconds = Math.ceil(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Shows both clocks, or hides them in a game without one. */
function updateClockDisplay() {
    for (const color of [WHITE, BLACK]) {
        const element = clockElements[color];
        if (!element) continue;
        element.hidden = !clock;
        if (!clock) continue;
        const left = clockRemaining(color);
        const running = clock.turnStartedAt !== null && color === currentPlayer;
        element.textContent = formatClock(left);
        element.classList.toggle('running', running);
        element.classList.toggle('low', left < 20000);
        // A timer is not read out on every change; the label is there when asked for
        element.setAttribute(
            'aria-label',
            `${color === WHITE ? 'White' : 'Black'} clock: ${formatClock(left)}`
        );
    }
}

/** Runs the ticking while a clock is running, and stops it otherwise. */
function runClockTimer() {
    const shouldRun = !!clock && clock.turnStartedAt !== null && !isGameOver;
    if (shouldRun && clockTimer === null) {
        clockTimer = setInterval(tickClock, CONFIG.CLOCK_TICK_MS);
    } else if (!shouldRun && clockTimer !== null) {
        clearInterval(clockTimer);
        clockTimer = null;
    }
}

/** Redraws the running clock and ends the game when it reaches zero. */
function tickClock() {
    if (!clock || clock.turnStartedAt === null || isGameOver) {
        runClockTimer();
        return;
    }
    if (clockRemaining(currentPlayer) > 0) {
        updateClockDisplay();
        return;
    }
    const loser = currentPlayer;
    const winner = opponentOf(loser);
    const name = (color) => (color === WHITE ? 'White' : 'Black');
    if (canDeliverMate(boardState, winner)) {
        endGameWithoutMove(
            winner === WHITE ? '1-0' : '0-1',
            `${name(loser)} ran out of time. ${name(winner)} wins.`
        );
    } else {
        endGameWithoutMove(
            '1/2-1/2',
            `${name(loser)} ran out of time, but ${name(winner)} cannot checkmate. Draw.`
        );
    }
}

/**
 * @returns {boolean} False if that side could never checkmate: a lone king, or
 * a king with a single bishop or knight.
 */
function canDeliverMate(board, color) {
    const others = [];
    for (const row of board) {
        for (const piece of row) {
            if (piece && piece.color === color && piece.type !== KING) others.push(piece.type);
        }
    }
    return !(others.length === 0 || (others.length === 1 && [BISHOP, KNIGHT].includes(others[0])));
}

/** Saves a game that has started; used when the page is being closed. */
function saveGameInProgress() {
    if (moveHistory.length > 0) saveGameState();
}

// --- Hint ---

/**
 * Asks the engine what it would play for the side to move and marks that move
 * on the board. Nothing is played. The marks stay until the position changes.
 */
function requestHint() {
    if (isBoardLocked() || hintPending) return;
    hintPending = true;
    hintMove = null;
    updateStatusDisplay();
    refreshBoardVisuals();
    const position = livePosition();
    const id = askEngine(position, currentPlayer, CONFIG.HINT_LEVEL, (move) => {
        if (id !== aiRequestId) return;
        hintPending = false;
        hintMove = move;
        updateStatusDisplay();
        refreshBoardVisuals();
        if (move) {
            const piece = position.board[move.from.row][move.from.col];
            const from = coordsToAlgebraic(move.from.row, move.from.col);
            const to = coordsToAlgebraic(move.to.row, move.to.col);
            announce(`Hint: ${PIECE_NAMES[piece.type]} from ${from} to ${to}.`);
        }
    });
}

/** Removes the hint, and drops one that is still being worked out. */
function clearHint() {
    if (hintPending) {
        aiRequestId++;
        stopWorkerSearch();
    }
    hintPending = false;
    hintMove = null;
}

/** Marks the hinted move's two squares, or removes the marks when there is no hint. */
function showHintOnBoard() {
    boardElement
        .querySelectorAll('.hint-from, .hint-to')
        .forEach((el) => el.classList.remove('hint-from', 'hint-to'));
    if (!hintMove || viewPly !== null) return;
    const from = getSquareElement(hintMove.from.row, hintMove.from.col);
    const to = getSquareElement(hintMove.to.row, hintMove.to.col);
    if (from) from.classList.add('hint-from');
    if (to) to.classList.add('hint-to');
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
        ...currentSnapshot(),
        gameStart: gameStart,
        moveHistory: moveHistory,
        gameResult: gameResult,
        endedWithoutMove: endedWithoutMove,
        // Times as of now. After a reload the side to move gets back on the clock.
        clock: clock && {
            control: clock.control,
            base: clock.base,
            increment: clock.increment,
            remaining: { [WHITE]: clockRemaining(WHITE), [BLACK]: clockRemaining(BLACK) },
            running: clock.turnStartedAt !== null,
        },
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
 * Checks a position record read from storage, either the saved game itself or
 * an entry of its undo stack.
 * @param {object} saved
 * @param {string} statusIfMissing - Status line to use when none was saved.
 * @returns {object|null} A record for restoreSnapshot, or null if it cannot be trusted.
 */
function cleanSnapshot(saved, statusIfMissing) {
    if (!saved || typeof saved !== 'object') return null;
    if (!isValidBoard(saved.boardState)) return null;
    if (saved.currentPlayer !== WHITE && saved.currentPlayer !== BLACK) return null;
    const target = saved.enPassantTarget === undefined ? null : saved.enPassantTarget;
    if (target !== null && !isValidCoords(target)) return null;
    return {
        boardState: saved.boardState,
        currentPlayer: saved.currentPlayer,
        isGameOver: !!saved.isGameOver,
        kingPositions: findKingPositions(saved.boardState),
        currentStatus:
            typeof saved.currentStatus === 'string' ? saved.currentStatus : statusIfMissing,
        enPassantTarget: target,
        halfmoveClock: cleanClock(saved.halfmoveClock),
    };
}

/**
 * Checks a parsed saved game and returns a clean state object, or null if it
 * cannot be trusted. Nothing in the live game is touched here.
 */
function validateSavedGame(saved) {
    if (!saved || typeof saved !== 'object') return null;
    if (saved.version !== undefined && saved.version !== SAVED_GAME_VERSION) return null;
    const position = cleanSnapshot(saved, 'Game loaded');
    if (!position) return null;

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

    // The undo stack is optional: saves from older versions do not have one.
    // If it is missing or damaged the game still loads, with nothing to undo.
    let undoStack = [];
    if (Array.isArray(saved.positionHistory) && saved.positionHistory.length === history.length) {
        const snapshots = saved.positionHistory.map((entry) =>
            entry && entry.enPassantTarget !== undefined ? cleanSnapshot(entry, '') : null
        );
        if (snapshots.every(Boolean)) undoStack = snapshots;
    }

    // Saves from before results were stored: work the result out from the last move
    const over = position.isGameOver;
    let result = null;
    if (over) {
        const last = history[history.length - 1];
        if (['1-0', '0-1', '1/2-1/2'].includes(saved.gameResult)) result = saved.gameResult;
        else if (last && last.isCheckmate) result = saved.currentPlayer === WHITE ? '0-1' : '1-0';
        else result = '1/2-1/2';
    }

    // The clock is optional; a damaged one is dropped and the game goes on without
    let savedClock = null;
    const c = saved.clock;
    const isTime = (value) => Number.isFinite(value) && value >= 0;
    if (
        c &&
        typeof c === 'object' &&
        c.remaining &&
        [c.base, c.increment, c.remaining[WHITE], c.remaining[BLACK]].every(isTime)
    ) {
        savedClock = {
            control: typeof c.control === 'string' ? c.control : '',
            base: c.base,
            increment: c.increment,
            remaining: { [WHITE]: c.remaining[WHITE], [BLACK]: c.remaining[BLACK] },
            turnStartedAt: c.running === true && !over ? Date.now() : null,
        };
    }

    // How the game began is optional: saves from older versions began in the usual way
    const begun = saved.gameStart;
    const start =
        begun &&
        typeof begun === 'object' &&
        (begun.player === WHITE || begun.player === BLACK) &&
        Number.isInteger(begun.fullmove) &&
        begun.fullmove >= 1
            ? {
                  player: begun.player,
                  halfmoveClock: cleanClock(begun.halfmoveClock),
                  fullmove: begun.fullmove,
                  fen: typeof begun.fen === 'string' ? begun.fen : null,
              }
            : STANDARD_START;

    return {
        ...position,
        gameStart: start,
        clock: savedClock,
        gameResult: result,
        endedWithoutMove: over && saved.endedWithoutMove === true,
        moveHistory: history,
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

    restoreSnapshot(state);
    gameStart = state.gameStart;
    moveHistory = state.moveHistory;
    positionHistory = state.positionHistory;
    gameResult = state.gameResult;
    endedWithoutMove = state.endedWithoutMove;
    clock = state.clock;
    return true;
}

// --- Past games ---

const ARCHIVE_KEY = CONFIG.STORAGE_KEYS.GAME_ARCHIVE;

/**
 * Reads the past games from localStorage. A missing or damaged value gives an
 * empty list, and entries that are not complete are left out.
 * @returns {Array<{pgn: string, result: string, opponent: string, date: string, moves: number}>}
 *   Newest first.
 */
function readArchive() {
    try {
        const saved = JSON.parse(localStorage.getItem(ARCHIVE_KEY));
        if (!Array.isArray(saved)) return [];
        return saved
            .filter(
                (entry) =>
                    entry &&
                    typeof entry.pgn === 'string' &&
                    typeof entry.result === 'string' &&
                    typeof entry.opponent === 'string' &&
                    typeof entry.date === 'string' &&
                    !Number.isNaN(Date.parse(entry.date)) &&
                    Number.isInteger(entry.moves)
            )
            .slice(0, CONFIG.ARCHIVE_LIMIT);
    } catch {
        return [];
    }
}

/** @returns {string} What makes a PGN the game it is: where it began, its moves and its result. */
function pgnMovetext(pgn) {
    const start = /^\[FEN "([^"]*)"\]/m.exec(pgn);
    return `${start ? start[1] : ''} ${pgn.trim().split('\n').pop()}`;
}

/**
 * Puts the current game at the top of the past games, if it has any moves.
 * Only the newest CONFIG.ARCHIVE_LIMIT games are kept, as PGN text of about a
 * kilobyte each, so the storage quota is not at risk.
 */
function archiveCurrentGame() {
    if (moveHistory.length === 0) return;
    const pgn = buildPGN();
    const same = (entry) => pgnMovetext(entry.pgn) === pgnMovetext(pgn);
    const archive = readArchive();
    // A game opened from the list and put back keeps its entry instead of appearing twice
    const entry = archive.find(same) || {
        pgn,
        result: (isGameOver && gameResult) || '*',
        opponent: computerColor() ? `Computer (${opponentLevel})` : 'Two players',
        date: new Date().toISOString(),
        moves: moveHistory.length,
    };
    const updated = [entry, ...archive.filter((past) => !same(past))];
    try {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated.slice(0, CONFIG.ARCHIVE_LIMIT)));
    } catch (e) {
        console.error('Error saving past games:', e);
    }
}

/** @returns {string} One line about a past game: date, opponent, result and length. */
function describeArchivedGame(entry) {
    const results = { '1-0': 'White won', '0-1': 'Black won', '1/2-1/2': 'Draw' };
    const date = new Date(entry.date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    const moves = Math.ceil(entry.moves / 2);
    return [
        date,
        entry.opponent,
        results[entry.result] || 'Not finished',
        `${moves} ${moves === 1 ? 'move' : 'moves'}`,
    ].join(' \u00b7 ');
}

/** Fills the list of past games in the Load dialog; the section is hidden while there are none. */
function showArchive() {
    if (!archiveSection || !archiveList) return;
    const archive = readArchive();
    archiveSection.hidden = archive.length === 0;
    archiveList.innerHTML = '';
    archive.forEach((entry, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add('btn');
        button.dataset.index = index;
        button.textContent = describeArchivedGame(entry);
        item.appendChild(button);
        archiveList.appendChild(item);
    });
}

/** A click on a past game loads it. The game it replaces goes into the list itself. */
function handleArchiveClick(event) {
    const button = event.target.closest ? event.target.closest('button[data-index]') : null;
    if (!button) return;
    const entry = readArchive()[Number(button.dataset.index)];
    const result = entry ? importPGN(entry.pgn) : { ok: false, error: 'That game is gone.' };
    if (!result.ok) {
        importError.textContent = `${result.error} The current game was not changed.`;
        return;
    }
    closeImportDialog();
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
        const { number, white } = moveNumberAt(index);
        if (white || index === 0) {
            // White's move starts a new row
            listItem = document.createElement('li');
            const turnSpan = document.createElement('span');
            turnSpan.classList.add('turn-number');
            turnSpan.textContent = `${number}.`;
            listItem.appendChild(turnSpan);
            if (!white) {
                // The game began with Black to move: White's place in the first row stays empty
                const gap = document.createElement('span');
                gap.classList.add('move', 'white-move');
                gap.textContent = '...';
                listItem.appendChild(gap);
            }
            moveHistoryElement.appendChild(listItem);
        }

        // Each move is a button that shows the position after it. Only one is
        // in the tab order; the arrow keys step between them.
        const entry = document.createElement('button');
        entry.type = 'button';
        entry.classList.add('move', white ? 'white-move' : 'black-move');
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
    if (reviewScoreElement) {
        reviewScoreElement.hidden = viewPly === null;
    }
    if (stepButtons) {
        // Off at the end already reached, and when the positions behind the moves are missing
        const canView = positionHistory.length === moveHistory.length;
        const shown = shownPosition().ply;
        for (const button of stepButtons.querySelectorAll('button[data-step]')) {
            const back = button.dataset.step === 'first' || button.dataset.step === 'previous';
            button.disabled = !canView || shown === (back ? 0 : moveHistory.length);
        }
    }
    // Undo is only available while there is a move, or a resignation or agreed draw, to take back
    if (undoButton) {
        undoButton.disabled = !!clock || (positionHistory.length === 0 && !endedWithoutMove);
    }
    updateClockDisplay();
    if (pgnButton) {
        pgnButton.disabled = moveHistory.length === 0;
    }
    if (resignButton) {
        resignButton.disabled = !isGameInProgress();
    }
    if (hintButton) {
        hintButton.disabled = isBoardLocked() || hintPending;
        hintButton.textContent = hintPending ? 'Thinking' : 'Hint';
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
        ...(clock ? [['TimeControl', `${clock.base / 1000}+${clock.increment / 1000}`]] : []),
        // A game that did not begin from the usual position says where it began
        ...(gameStart.fen
            ? [
                  ['SetUp', '1'],
                  ['FEN', gameStart.fen],
              ]
            : []),
    ].map(([name, value]) => `[${name} "${value}"]`);

    const moves = moveHistory.map((move, index) => {
        const san = move.notation.replace(' e.p.', ''); // Not valid in PGN
        // White's moves carry their number, and so does a first move by Black
        const numbered = moveNumberAt(index).white || index === 0;
        return numbered ? `${moveNumberText(index)} ${san}` : san;
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
    copyOrDownload(buildPGN(), pgnButton, 'Copy PGN', 'static-chess-game.pgn');
}

/**
 * Copies the position on the board to the clipboard as FEN, for an analysis
 * board. While an earlier move is being viewed, it is that position.
 */
function copyFEN() {
    copyOrDownload(buildFEN(), fenButton, 'Copy FEN', 'static-chess-position.fen');
}

/** @returns {string} The position on screen in Forsyth-Edwards Notation. */
function buildFEN() {
    const shown = shownPosition();
    return positionToFEN(shown, shown.player, shown.halfmoveClock, moveNumberAt(shown.ply).number);
}

/**
 * Copies text to the clipboard and says so on the button. Where the clipboard
 * is not available, the text is downloaded as a file instead.
 * @param {string} text
 * @param {HTMLElement} button - The button that was pressed.
 * @param {string} label - The button's normal label, put back after the notice.
 * @param {string} filename - Name of the file if it has to be downloaded.
 */
function copyOrDownload(text, button, label, filename) {
    const flash = (notice) => {
        button.textContent = notice;
        setTimeout(() => {
            button.textContent = label;
        }, 1500);
    };
    const download = () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }));
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
        flash('Downloaded');
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => flash('Copied!'), download);
    } else {
        download();
    }
}

// --- Loading a game from PGN ---

/**
 * @param {string} text - PGN that may hold several games.
 * @returns {string} The first game: everything up to the tags of a second one.
 */
function firstPGNGame(text) {
    const lines = String(text).split('\n');
    let inMoves = false;
    const end = lines.findIndex((line) => {
        const isTag = /^\s*\[\w+\s+"[^"\n]*"\]\s*$/.test(line);
        if (!isTag && line.trim()) inMoves = true;
        return isTag && inMoves;
    });
    return (end === -1 ? lines : lines.slice(0, end)).join('\n');
}

/**
 * Finds how a game given as PGN ended: the result after the moves, or else
 * the Result tag. The comment this app writes before the result of a game
 * ended by resignation, agreement or on time becomes the status again.
 * @param {string} text
 * @returns {{result: string, status: string}|null} Null for a game in progress.
 */
function pgnResult(text) {
    const game = firstPGNGame(text);
    const RESULT = '1-0|0-1|1\\/2-1\\/2';
    const closing = new RegExp(`(?:\\{([^}]*)\\}\\s*)?(?:^|\\s)(${RESULT}|\\*)\\s*$`).exec(game);
    const tag = new RegExp(`^\\s*\\[Result\\s+"(${RESULT})"\\]`, 'm').exec(game);
    const result = closing ? closing[2] : tag && tag[1];
    if (!result || result === '*') return null;

    const comment = closing && closing[1] ? closing[1].trim() : '';
    const ownWording =
        /^(?:(?:White|Black) resigned\. (?:White|Black) wins\.|Draw by agreement\.|(?:White|Black) ran out of time[.,] .+)$/;
    const fallback = {
        '1-0': 'White won (result from the loaded game).',
        '0-1': 'Black won (result from the loaded game).',
        '1/2-1/2': 'Draw (result from the loaded game).',
    };
    return { result, status: ownWording.test(comment) ? comment : fallback[result] };
}

/**
 * Takes the moves out of PGN text: tags, comments, variations, annotation
 * codes, move numbers and the result are dropped.
 * @param {string} text
 * @returns {string[]} The moves in standard algebraic notation.
 */
function pgnMoveTokens(text) {
    let body = firstPGNGame(text)
        .replace(/^\s*\[[^\]\n]*\]\s*$/gm, ' ') // Tag pairs
        .replace(/\{[^}]*\}/g, ' ') // Comments in braces
        .replace(/;[^\n]*/g, ' '); // Comments to the end of the line
    while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, ' '); // Variations, innermost first
    return body
        .replace(/\$\d+/g, ' ') // Annotation codes
        .replace(/\d+\.+/g, ' ') // Move numbers, also when attached: "1.e4"
        .split(/\s+/)
        .filter((token) => token && !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
}

/**
 * Replaces the current game with one given as PGN. Every move is checked
 * first; if one cannot be played, nothing is changed. A game with a FEN tag
 * begins from that position instead of the usual one. A result the moves do
 * not show (resignation, agreed draw, time) ends the loaded game as well;
 * Undo reopens it. Of several games in the text, the first is loaded.
 * @param {string} text
 * @param {boolean} validateOnly - Check the moves without replacing the game.
 * @returns {{ok: boolean, error?: string, moves?: number}}
 */
function importPGN(text, validateOnly = false) {
    const tokens = pgnMoveTokens(text);
    if (tokens.length === 0) return { ok: false, error: 'No moves found in the text.' };

    // The game begins from the usual position unless a FEN tag says otherwise
    let start = { ...STANDARD_START, position: initialPosition() };
    const fenTag = /^\s*\[FEN\s+"([^"]*)"\]/m.exec(firstPGNGame(text));
    if (fenTag) {
        start = positionFromFEN(fenTag[1]);
        if (start.error) return { ok: false, error: `The FEN tag cannot be used. ${start.error}` };
    }

    let position = start.position;
    let color = start.player;
    const moves = [];
    for (const [index, token] of tokens.entries()) {
        const move = findSANMove(position, color, token);
        if (!move) {
            const number = moveNumberText(index, start);
            return { ok: false, error: `Move ${number} ${token} cannot be played.` };
        }
        moves.push(move);
        position = applyMove(position, move.from, move.to, move.promotion).position;
        color = opponentOf(color);
    }

    if (validateOnly) return { ok: true, moves: moves.length };

    // The moves go in without sounds, saving or computer replies; the page is drawn once at the end
    startGameFrom(start.position, start.player, start.halfmoveClock, start.fullmove);
    clock = null; // A loaded game is not played on the clock: its moves took no time here
    runClockTimer();
    for (const move of moves) {
        playMove(move.from.row, move.from.col, move.to.row, move.to.col, move.promotion);
    }
    // A game may play on through a draw nobody claimed, so that is looked at only now
    endIfAutomaticDraw(moveHistory[moveHistory.length - 1]);
    const ending = isGameOver ? null : pgnResult(text);
    if (ending) {
        isGameOver = true;
        gameResult = ending.result;
        endedWithoutMove = true;
        currentStatus = ending.status;
    }
    redraw();
    saveGameState();
    announce(`Game loaded, ${moves.length} moves. ${currentStatus}`);
    requestAIMove();
    return { ok: true, moves: moves.length };
}

/** @returns {boolean} True for text that begins like a FEN position: eight ranks of pieces and numbers. */
function looksLikeFEN(text) {
    return /^\s*[pnbrqk1-8]+(\/[pnbrqk1-8]+){7}(\s|$)/i.test(String(text));
}

/**
 * Replaces the current game with a new one that begins from a position given
 * in FEN. If the text cannot be used, nothing is changed.
 * @param {string} text
 * @param {boolean} validateOnly - Check the position without replacing the game.
 * @returns {{ok: boolean, error?: string}}
 */
function importFEN(text, validateOnly = false) {
    const start = positionFromFEN(text);
    if (start.error) return { ok: false, error: start.error };
    if (validateOnly) return { ok: true };

    startGameFrom(start.position, start.player, start.halfmoveClock, start.fullmove);
    endIfAlreadyDecided();
    redraw();
    saveGameState();
    announce(`Position loaded. ${currentStatus}`);
    requestAIMove();
    return { ok: true };
}

/** A game may begin from a position in which it is already over: mate, stalemate or bare kings. */
function endIfAlreadyDecided() {
    if (generateAllLegalMoves(currentPlayer).length === 0) {
        isGameOver = true;
        if (findKingInCheck(currentPlayer)) {
            gameResult = currentPlayer === WHITE ? '0-1' : '1-0';
            currentStatus = `Checkmate! ${currentPlayer === WHITE ? 'Black' : 'White'} wins.`;
        } else {
            gameResult = '1/2-1/2';
            currentStatus = 'Stalemate! Game is a draw.';
        }
    } else if (hasInsufficientMaterial(boardState)) {
        isGameOver = true;
        gameResult = '1/2-1/2';
        currentStatus = 'Draw by insufficient material.';
    }
}

/** Opens the dialog for pasting a game or a position. */
function openImportDialog() {
    if (!importDialog) return;
    importError.textContent = '';
    showArchive();
    importDialog.hidden = false;
    importText.focus();
}

/** Closes the dialog and gives the focus back to the button that opened it. */
function closeImportDialog() {
    if (!importDialog || importDialog.hidden) return;
    cancelConfirm(importLoadButton);
    importDialog.hidden = true;
    if (importButton) importButton.focus();
}

/**
 * Loads the pasted game or position. A game in progress needs a confirming
 * second click first.
 */
function handleImportLoad() {
    const load = looksLikeFEN(importText.value) ? importFEN : importPGN;
    if (load === importPGN && pgnMoveTokens(importText.value).length === 0) {
        importError.textContent = 'Paste a game in PGN format, or a position in FEN, first.';
        return;
    }
    const validation = load(importText.value, true);
    if (!validation.ok) {
        cancelConfirm(importLoadButton);
        importError.textContent = validation.error + ' The current game was not changed.';
        return;
    }
    importError.textContent = '';
    if (isGameInProgress() && !confirmSecondClick(importLoadButton, 'Discard current game?')) {
        return;
    }
    const result = load(importText.value);
    if (!result.ok) {
        importError.textContent = `${result.error} The current game was not changed.`;
        return;
    }
    importText.value = '';
    closeImportDialog();
}

/** Escape closes the dialog. */
function handleImportKeydown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeImportDialog();
    }
}

/**
 * Writes a move in standard algebraic notation. A file or rank is added only
 * when another piece of the same type could legally have made the move.
 * @param {object} move - The move as recorded by applyMove.
 * @param {object} positionBefore - The rules.js position the move was played in.
 * @returns {string}
 */
function generateNotationWithDisambiguation(move, positionBefore) {
    const piece = move.piece;
    const toAlg = coordsToAlgebraic(move.to.row, move.to.col);
    if (move.isCastling) {
        return move.to.col > move.from.col ? 'O-O' : 'O-O-O';
    }

    let disambiguation = '';
    if (piece.type !== PAWN) {
        // Other pieces of the same type that could legally have gone to the square.
        // A piece that is pinned could not, so it does not count, which is also
        // how findSANMove reads the move back.
        const rivals = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (r === move.from.row && c === move.from.col) continue;
                const other = positionBefore.board[r][c];
                if (!other || other.type !== piece.type || other.color !== piece.color) continue;
                const reaches = legalMovesFrom(positionBefore, r, c).some(
                    (to) => to.row === move.to.row && to.col === move.to.col
                );
                if (reaches) rivals.push({ row: r, col: c });
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
        requestHint,
        importPGN,
        importFEN,
        pgnMoveTokens,
        pgnResult,
        readArchive,
        openImportDialog,
        buildFEN,
        setTimeControl,
        clockRemaining,
        formatClock,
        saveGameState,
        get clock() {
            return clock;
        },
        get hintMove() {
            return hintMove;
        },
        resign,
        handleResignClick,
        handleDrawClick,
        get gameStart() {
            return gameStart;
        },
        startGameFrom,
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
