/**
 * @fileoverview The live game: its state, the flow of a move, undo, saving and
 * the page updates that follow. The rules of chess themselves are in rules.js.
 */

let gameStart = STANDARD_START; // How this game began; fen is its first position unless that is the usual one

let boardState = initialPosition().board;
let currentPlayer = WHITE;
let moveHistory = []; // The moves played: each is the record applyMove returns, plus its notation and check flags
let isGameOver = false;
let kingPositions = initialPosition().kingPositions; // Kept for check detection
let currentStatus = "White's turn";
let enPassantTarget = null; // Stores coords {row, col} of square vulnerable to en passant, or null
let positionHistory = []; // Undo stack: one pre-move snapshot per move played
let redoStack = []; // Moves Undo took back, the last taken back on top: { from, to, promotion }
let halfmoveClock = 0; // Half-moves since the last pawn move or capture (fifty-move rule)
let gameResult = null; // '1-0', '0-1' or '1/2-1/2' once the game is over, else null
let endedWithoutMove = false; // True when the game ended by resignation or agreement, not by a move
let drawOffered = false; // Two-player game: a draw offer is waiting for the other side
let viewPly = null; // Number of moves played in the position being looked at; null shows the live game
let autoplayTimer = null; // While the Play button steps through the game

let chosenTimeControl = null; // Key of CONFIG.TIME_CONTROLS for the next game; null for no clock
// The clock of the game being played, or null: { control, base, increment,
// remaining: {w, b} } in milliseconds, and turnStartedAt, the time the side to
// move was put on the clock (null while no clock is running)
let clock = null;
let clockTimer = null; // Interval that redraws a running clock
let hintMove = null; // The move the engine suggested, if asked
let hintPending = false; // True while the engine is working out a hint
let hintPly = null; // Moves played in the position the hint is for
let hintChannel = 'play'; // The engine channel the hint was asked on
// Engine channels for review, apart from 'play' so that neither can cancel the computer's move
const REVIEW_HINT_CHANNEL = 'review-hint';
const REVIEW_SCORES_CHANNEL = 'review-scores';
let gameScores = null; // Once the game is over: what the engine makes of every position, first to last
let scoredGame = null; // The finished game (gameSignature) gameScores was asked for, or null

// Computer opponent
let opponentLevel = null; // null for two players, otherwise a key of AI_LEVELS ('easy', 'medium', 'hard')
let humanColor = WHITE; // The side the person plays when there is a computer opponent
let randomSide = false; // True when the person's side is drawn at each new game
let sideListener = null; // Told when the game chooses the person's side itself
let aiThinking = false;
// Who plays the game on the board: the computer's level and colour, or nulls for two
// players. Follows the settings while the game goes on and is kept once it is over, so
// changing them afterwards does not rename the players of a finished game.
let gamePlayers = { level: null, computer: null };
// The date of the past game the live game was opened from, or null: put back,
// the game replaces that entry instead of being listed twice
let archivedFrom = null;
// False until initializeGame has put the real game in place. The settings read
// before then are only noted: there is no board yet, and the game on it is
// about to be replaced by the saved one.
let gameReady = false;

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
    gameReady = true; // From here on the settings act on this game
    loadGameState();
    if (moveHistory.length === 0 && !gameStart.fen) {
        // No saved game, or one without a move: start afresh. A position that
        // was loaded from FEN is kept even before its first move.
        resetGame();
    } else if (randomSide) {
        // A game that goes on keeps the side it was begun with, not a new draw
        if (gamePlayers.computer) chooseSide(opponentOf(gamePlayers.computer));
        else drawSide();
    }
    createBoard();
    renderPieces(boardState);
    updateStatusDisplay();
    updateMoveHistoryDisplay();
    refreshBoardVisuals();

    bindControls({
        moveListClick: handleMoveListClick,
        moveListKeydown: handleMoveListKeydown,
        live: returnToLiveGame,
        playHere: handlePlayHereClick,
        step: handleStepClick,
        resign: handleResignClick,
        draw: handleDrawClick,
        hint: requestHint,
        reset: handleResetClick,
        review: reviewFromStart,
        pageKey: handlePageKey,
        copyPGN,
        downloadPGN,
        copyFEN,
        copyLink,
        undo: undoLastMove,
        redo: redoMove,
        autoplay: toggleAutoplay,
        stopAutoplay,
        undoOffered: CONFIG.FEATURES.UNDO_MOVE,
    });
    // Keep the clock times when the page is closed in the middle of a turn
    window.removeEventListener('pagehide', saveGameInProgress);
    window.addEventListener('pagehide', saveGameInProgress);
    runClockTimer();

    // Add event listener for board clicks (delegated)
    boardElement.removeEventListener('click', handleBoardClickEvent);
    boardElement.addEventListener('click', handleBoardClickEvent);

    requestAIMove(); // In case it is the computer's turn in the loaded game
    debugLog('Game initialized.');
}

/**
 * Event handler for board clicks, delegates to handleBoardClick function
 * @param {Event} event - The click event
 */
function handleBoardClickEvent(event) {
    // Ignore clicks that happen right after a drag operation
    if (window.dragJustEnded) {
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
    stopAutoplay(); // A new or loaded game
    archiveCurrentGame(); // The game being replaced stays in the list of past games
    const fen = positionToFEN(position, player, startClock, fullmove);
    const usual = fen === positionToFEN(initialPosition(), WHITE, 0, 1);
    gameStart = { player, halfmoveClock: startClock, fullmove, fen: usual ? null : fen };
    restoreSnapshot({
        boardState: position.board,
        currentPlayer: player,
        isGameOver: false,
        kingPositions: position.kingPositions,
        currentStatus: `${sideName(player)}'s turn`,
        enPassantTarget: position.enPassantTarget,
        halfmoveClock: startClock,
    });
    recordPlayers();
    moveHistory = [];
    positionHistory = [];
    redoStack = [];
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
    clearStoredGame();
}

/**
 * Resets the game to the initial state.
 */
function resetGame() {
    debugLog('Resetting game...');
    if (randomSide) drawSide(); // Before the game records who plays it
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
    updateBoardVisuals(kingInCheck, moveHistory[shown.ply - 1] || null);
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
    if (playHereButton) cancelConfirm(playHereButton); // The question was about another position
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
    if (viewPly === null) return;
    // After a finished game has been gone through: also what the move that led here cost
    const cost = viewPly > 0 ? moveCostText(viewPly - 1) : null;
    const score = positionScoreText(shownPosition());
    renderReviewScore(cost ? `${score} ${cost}` : score);
}

/**
 * @param {object} shown - A position as shownPosition() gives it.
 * @returns {string} What the engine makes of it, as a sentence.
 */
function positionScoreText(shown) {
    return scoreText(assessPosition(shown, shown.player));
}

// --- Review of a finished game ---

/** @returns {string} Tells one finished game from another: how it began and its moves. */
function gameSignature() {
    return `${gameStart.fen || ''}|${moveHistory.map((move) => move.notation).join(' ')}`;
}

/** @returns {object} A snapshot of this game as a position for the functions in rules.js. */
function snapshotPosition(snapshot) {
    return {
        board: snapshot.boardState,
        kingPositions: snapshot.kingPositions,
        enPassantTarget: snapshot.enPassantTarget,
    };
}

/**
 * Once a game is over, asks the engine what it makes of every position in it,
 * so the move list can mark the moves that lost ground. It is asked once per
 * game, on a channel of its own, and forgotten when the game goes on (Undo,
 * Play from here) or another one starts.
 */
function scoreFinishedGame() {
    const wanted =
        isGameOver && moveHistory.length > 0 && positionHistory.length === moveHistory.length;
    if (!wanted) {
        if (scoredGame !== null) dropEngineRequests(REVIEW_SCORES_CHANNEL);
        scoredGame = null;
        gameScores = null;
        return;
    }
    const signature = gameSignature();
    if (scoredGame === signature) return;
    scoredGame = signature;
    gameScores = null;
    const positions = [...positionHistory, currentSnapshot()].map((snapshot) => ({
        position: snapshotPosition(snapshot),
        color: snapshot.currentPlayer,
    }));
    const id = askEngineForScores(
        positions,
        (scores) => {
            if (!isLatestEngineRequest(id, REVIEW_SCORES_CHANNEL) || scoredGame !== signature) {
                return;
            }
            gameScores = scores;
            updateMoveHistoryDisplay();
            showReviewScore();
        },
        REVIEW_SCORES_CHANNEL
    );
}

/**
 * What a move cost the side that played it, by the engine's count. Only for a
 * finished game that has been gone through.
 * @param {number} index - How many moves were played before it.
 * @returns {{lost: number, allowedMate: boolean, missedMate: boolean}|null}
 *   As scoreDrop in review.js gives it; null when the move is not marked.
 */
function moveCost(index) {
    if (!gameScores || gameScores.length !== moveHistory.length + 1) return null;
    return scoreDrop(gameScores[index], gameScores[index + 1], moveHistory[index].piece.color);
}

/** @returns {string|null} moveCost as a sentence, or null when the move is not marked. */
function moveCostText(index) {
    const cost = moveCost(index);
    return cost && scoreDropText(moveLabel(index + 1), cost);
}

/** Handles "Play from here", which needs a confirming second click because it drops the later moves. */
function handlePlayHereClick() {
    if (viewPly === null) return;
    if (confirmSecondClick(playHereButton, 'Drop later moves?')) playFromHere();
}

/**
 * Makes the position being looked at the live one, so the game goes on from
 * there. The moves after it are dropped; the game as it was goes into the past
 * games first. The clock is dropped too, since the time those moves took
 * cannot be given back, which also makes Undo available again.
 */
function playFromHere() {
    if (viewPly === null) return;
    const ply = viewPly;
    cancelPendingPromotion();
    cancelAIMove();
    cancelConfirms();
    archiveCurrentGame();
    restoreSnapshot(positionHistory[ply]); // Taken before the move that followed, as for undo
    moveHistory = moveHistory.slice(0, ply);
    positionHistory = positionHistory.slice(0, ply);
    redoStack = [];
    isGameOver = false;
    gameResult = null;
    endedWithoutMove = false;
    drawOffered = false;
    viewPly = null;
    clock = null;
    runClockTimer();
    clearSelectedSquare();
    clearPossibleMoves();
    redraw();
    saveGameState();
    announce(`Playing on from here. ${currentStatus}`);
    requestAIMove();
}

/**
 * Starts going through the game from its first position, with the focus in
 * the move list so the arrow keys step on from there.
 */
function reviewFromStart() {
    viewMove(0);
    focusCurrentMove();
}

/** Shows the live game again. */
function returnToLiveGame() {
    viewMove(moveHistory.length);
}

/** @returns {{number: number, white: boolean}} The number of a move of this game and whose move it is. */
function moveNumberAt(index) {
    return moveNumber(index, gameStart);
}

/** @returns {string} A move with its number, such as "12. Nf3" or "12... Nf6". */
function moveLabel(ply) {
    return `${moveNumberPrefix(ply - 1, gameStart)} ${moveHistory[ply - 1].notation}`;
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

/**
 * Keys that work anywhere on the page: Left and Right step through the game,
 * Escape returns to it. game-ui.js leaves out the board, form fields and
 * dialogs, which have keys of their own.
 * @param {string} key - The key's name, as a keyboard event gives it.
 * @returns {boolean} True if the key did something.
 */
function handlePageKey(key) {
    if (positionHistory.length !== moveHistory.length) return false; // Nothing to look at
    const shown = shownPosition().ply;
    if (key === 'ArrowLeft' && shown > 0) {
        viewMove(shown - 1);
        return true;
    }
    if (key === 'ArrowRight' && shown < moveHistory.length) {
        viewMove(shown + 1);
        return true;
    }
    if (key === 'Escape' && viewPly !== null) {
        returnToLiveGame();
        return true;
    }
    return false;
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

/**
 * The Play button under the move list: steps through the game a move at a
 * time, from the start when the latest move is on screen, and stops at the
 * end. Pressed again it pauses. The board has no animation to slow down, so
 * a reduced-motion setting changes nothing here.
 */
function toggleAutoplay() {
    if (autoplayTimer !== null) {
        stopAutoplay();
        return;
    }
    if (positionHistory.length !== moveHistory.length || moveHistory.length === 0) return;
    if (shownPosition().ply >= moveHistory.length) viewMove(0);
    autoplayTimer = setInterval(autoplayStep, CONFIG.AUTOPLAY_STEP_MS);
    renderControls(controlsView());
}

/** One step of the Play button; the last one brings back the live game and stops. */
function autoplayStep() {
    const next = shownPosition().ply + 1;
    if (next <= moveHistory.length) viewMove(next);
    if (next >= moveHistory.length) stopAutoplay();
}

/**
 * Stops the Play button stepping. Any other control, a new or loaded game,
 * and leaving the page stop it.
 */
function stopAutoplay() {
    if (autoplayTimer === null) return;
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    renderControls(controlsView());
}

/** @returns {boolean} True if the square holds a piece of the side to move. */
function isOwnPiece(row, col) {
    const piece = boardState[row][col];
    return !!piece && piece.color === currentPlayer;
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
    // A flag that fell between two ticks still ends the game: a side with no
    // time left does not get to move, and is not given the increment.
    if (clock && clock.turnStartedAt !== null && clockRemaining(currentPlayer) === 0) {
        endGameOnTime();
        return;
    }
    viewPly = null; // A move (for example the computer's reply) brings the live game back
    drawOffered = false; // Playing on declines a draw offer
    redoStack = []; // A new move: what was taken back cannot come back on top of it
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
    move.notation = writeSAN(
        move,
        {
            board: before.boardState,
            kingPositions: before.kingPositions,
            enPassantTarget: before.enPassantTarget,
        },
        result.position
    );
    moveHistory.push(move);

    // --- Has the game ended? ---
    // Only by mate or stalemate here; the draws are endIfAutomaticDraw's
    const opponentKingInCheck = findKingInCheck(currentPlayer);
    move.isCheck = !!opponentKingInCheck;
    const outcome = gameOutcome(livePosition(), currentPlayer);
    if (outcome) {
        move.isCheckmate = outcome.reason === 'checkmate';
        move.isStalemate = outcome.reason === 'stalemate';
        endWith(outcome);
    } else {
        currentStatus = `${sideName(currentPlayer)}'s turn`;
    }
    return { move, kingInCheck: opponentKingInCheck };
}

/**
 * @param {{result: string, reason: string}} outcome - As gameOutcome in rules.js gives it.
 * @returns {string} The status line for a game that ended so.
 */
function statusForOutcome({ result, reason }) {
    if (reason === 'checkmate')
        return `Checkmate! ${sideName(result === '1-0' ? WHITE : BLACK)} wins.`;
    if (reason === 'stalemate') return 'Stalemate! Game is a draw.';
    return `Draw by ${reason}.`;
}

/** Ends the game with an outcome gameOutcome in rules.js decided. */
function endWith(outcome) {
    isGameOver = true;
    gameResult = outcome.result;
    currentStatus = statusForOutcome(outcome);
}

/**
 * Ends the game as a draw if the position on the board is drawn by the rules
 * (insufficient material, threefold repetition or the fifty-move rule).
 * @param {object} move - The move that led to the position.
 */
function endIfAutomaticDraw(move) {
    if (isGameOver) return;
    const outcome = gameOutcome(livePosition(), currentPlayer, {
        halfmoveClock,
        repeated: isThreefoldRepetition(),
    });
    if (!outcome) return;
    move.isDraw = true;
    endWith(outcome);
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
        const move = moveHistory.pop(); // Each snapshot is taken right before exactly one move is recorded
        redoStack.push({ from: move.from, to: move.to, promotion: move.promotion || QUEEN });
    };
    if (reopen) {
        isGameOver = false;
        currentStatus = `${sideName(currentPlayer)}'s turn`;
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

/**
 * Plays again the move Undo took back last, and against the computer its
 * reply too, as Undo took both back. Any other move forgets what can be redone.
 */
function redoMove() {
    if (clock || isGameOver || redoStack.length === 0) return;
    cancelPendingPromotion();
    cancelAIMove();
    cancelConfirms();
    clearHint();
    viewPly = null;
    drawOffered = false;
    const replay = () => {
        const { from, to, promotion } = redoStack.pop();
        const played = playMove(from.row, from.col, to.row, to.col, promotion);
        endIfAutomaticDraw(played.move);
        return played;
    };
    let last = replay();
    if (redoStack.length > 0 && !isGameOver && currentPlayer === computerColor()) last = replay();

    clearSelectedSquare();
    clearPossibleMoves();
    showMoveResult(last.move, last.kingInCheck);
    saveGameState();
    requestAIMove();
}

// --- Ending the game without a move ---

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
        if (evaluatePosition(livePosition(), computer) < CONFIG.AI_DRAW_MARGIN) {
            endGameWithoutMove('1/2-1/2', 'Draw by agreement.');
        } else {
            announce('The computer declines the draw.');
            renderStatus(`The computer declines the draw. ${currentStatus}`);
        }
        return;
    }
    if (drawOffered) {
        endGameWithoutMove('1/2-1/2', 'Draw by agreement.');
        return;
    }
    drawOffered = true;
    updateStatusDisplay();
    announce(`${sideName(currentPlayer)} offers a draw.`);
}

/** Closes the promotion chooser without playing the held move. */
function cancelPendingPromotion() {
    if (isPromotionChooserOpen()) closePromotionChooser(null);
}

// --- Computer opponent ---

/** @returns {string|null} The colour the computer plays, or null in a two-player game. */
function computerColor() {
    if (!opponentLevel || !CONFIG.FEATURES.AI_OPPONENT) return null;
    return opponentOf(humanColor);
}

/** Notes who plays the game on the board from the settings, unless the game is over. */
function recordPlayers() {
    if (isGameOver) return;
    const computer = computerColor();
    gamePlayers = { level: computer ? opponentLevel : null, computer };
}

/**
 * @param {string} color
 * @param {string} plain - The name to use for a side the computer did not play.
 * @returns {string} The name of a side of the game on the board, as the PGN and past games give it.
 */
function recordedName(color, plain) {
    return gamePlayers.computer === color ? `Computer (${gamePlayers.level})` : plain;
}

/** @returns {boolean} True while the player cannot move: game over, chooser open, or the computer's turn. */
function isBoardLocked() {
    return (
        isGameOver ||
        viewPly !== null ||
        isPromotionChooserOpen() ||
        currentPlayer === computerColor()
    );
}

/**
 * Chooses who plays the other side. Takes effect at once, also in the middle
 * of a game: if it is now the computer's turn, it moves.
 * @param {string|null} level - 'easy', 'medium' or 'hard'; anything else means two players.
 * @param {string} [color] - The side the person plays, or 'random' for a side
 *   drawn at each new game. A game already begun keeps the side it has.
 */
function setOpponent(level, color = WHITE) {
    opponentLevel = Object.prototype.hasOwnProperty.call(AI_LEVELS, level) ? level : null;
    randomSide = color === 'random';
    if (!randomSide) humanColor = color === BLACK ? BLACK : WHITE;
    if (!gameReady) return; // initializeGame applies it
    if (randomSide && moveHistory.length === 0 && !isGameOver && !gameStart.fen) drawSide();
    drawOffered = false;
    cancelConfirms();
    cancelAIMove();
    clearSelectedSquare();
    clearPossibleMoves();
    refreshBoardVisuals();
    updateStatusDisplay();
    requestAIMove();
}

/**
 * Makes a colour the person's side and tells the page, which turns the board to it.
 * @param {string} color
 */
function chooseSide(color) {
    humanColor = color;
    if (sideListener) sideListener(color);
}

/** Draws the person's side at random, for the "Random" setting. */
function drawSide() {
    chooseSide(Math.random() < 0.5 ? WHITE : BLACK);
}

/**
 * @param {((color: string) => void)|null} listener - Called when the game
 *   chooses the person's side itself, as it does for "Random".
 */
function setSideListener(listener) {
    sideListener = listener;
}

/** Drops a computer move that is being worked out or waiting to be played. */
function cancelAIMove() {
    dropEngineRequests();
    aiThinking = false;
    // A hint being worked out for the live game shares the engine and is dropped
    // with it; one for a position being reviewed has to be dropped on its own
    if (hintPending && hintChannel !== 'play') dropEngineRequests(hintChannel);
    hintPending = false;
    hintMove = null;
    hintPly = null;
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
    // Short of time on its own clock, the computer does not pause before it moves
    const pause =
        clock && clockRemaining(color) < CONFIG.AI_HURRY_BELOW_MS ? 0 : CONFIG.AI_MOVE_DELAY_MS;

    const id = askEngineAbout(livePosition(), color, opponentLevel, (move) => {
        // A short pause, so the reply does not land in the same instant as the player's move
        const wait = Math.max(0, pause - (Date.now() - started));
        setTimeout(() => {
            if (!isLatestEngineRequest(id)) return; // Undone, reset or switched off in the meantime
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
 * Asks the engine for a move in a position of this game, telling it what only
 * the game knows: the positions that have occurred, so it can avoid repeating
 * them, and for the computer's move in a game on the clock how long it may think.
 * @param {object} position - A rules.js position.
 * @param {string} color - The side to find a move for.
 * @param {string} level - A key of AI_LEVELS.
 * @param {(move: object|null) => void} onMove - Called with the engine's move.
 * @param {string} [channel] - The engine channel; 'play' for the live game.
 * @param {number} [ply] - Moves played before the position; the live one by default.
 * @returns {number} The id of the request, for isLatestEngineRequest.
 */
function askEngineAbout(
    position,
    color,
    level,
    onMove,
    channel = 'play',
    ply = moveHistory.length
) {
    const seen = positionHistory
        .slice(0, ply)
        .map((past) => positionKey(past.boardState, past.currentPlayer, past.enPassantTarget));
    // Only the computer's own move is budgeted against the clock. A hint is for
    // the player, whose clock is running, or for a position being reviewed: it
    // gets the level's usual time
    const onItsClock = channel === 'play' && clock && color === computerColor();
    const budgetMs = onItsClock
        ? searchBudget(clockRemaining(color), clock.increment, level)
        : null;
    return askEngine({ position, color, level, seen, budgetMs }, onMove, channel);
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
    // Before the game is in place, the new game initializeGame starts takes it up
    if (gameReady && moveHistory.length === 0 && !isGameOver) {
        clock = newClock();
        updateStatusDisplay();
    }
}

/** @returns {object|null} A full clock for the chosen time control, or null without one. */
function newClock() {
    return makeClock(chosenTimeControl);
}

/** @returns {number} Milliseconds a side has left right now; never below zero. */
function clockRemaining(color) {
    return timeLeft(clock, color, currentPlayer);
}

/** Shows both clocks, or hides them in a game without one. */
function updateClockDisplay() {
    const side = (color) => ({
        left: clockRemaining(color),
        running: clock.turnStartedAt !== null && color === currentPlayer,
    });
    renderClocks(clock ? { [WHITE]: side(WHITE), [BLACK]: side(BLACK) } : null);
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

/**
 * Stops everything this game started that could outlive it: the clock interval,
 * a computer move or hint still being worked out, and a pending confirm button.
 * A move worked out after this call is void (see cancelAIMove), so nothing it
 * does can land on another game. The tests call this when a game is replaced
 * or a test ends; the page itself never needs it.
 */
function stopAllTimers() {
    if (clockTimer !== null) {
        clearInterval(clockTimer);
        clockTimer = null;
    }
    stopAutoplay();
    cancelAIMove();
    dropEngineRequests(REVIEW_HINT_CHANNEL);
    dropEngineRequests(REVIEW_SCORES_CHANNEL);
    cancelConfirms();
}

/** Redraws the running clock and ends the game when it reaches zero. */
function tickClock() {
    if (!clock || clock.turnStartedAt === null || isGameOver) {
        runClockTimer();
        return;
    }
    if (clockRemaining(currentPlayer) > 0) {
        updateClockDisplay();
        warnIfTimeIsLow();
        return;
    }
    endGameOnTime();
}

/** Ends the game because the side to move has run out of time. */
function endGameOnTime() {
    const winnerCanMate = canDeliverMate(boardState, opponentOf(currentPlayer));
    const { result, status } = timeoutResult(currentPlayer, winnerCanMate);
    endGameWithoutMove(result, status);
}

/**
 * Tells the side to move, with a sound and an announcement, that its time is
 * running out. Each threshold in CONFIG.LOW_TIME_WARNINGS warns once as the
 * clock goes down past it; if an increment takes the clock back above a
 * threshold, that one warns again on the next way down.
 */
function warnIfTimeIsLow() {
    const level = lowTimeLevel(clockRemaining(currentPlayer));
    clock.warned = clock.warned || { [WHITE]: null, [BLACK]: null };
    const before = clock.warned[currentPlayer];
    clock.warned[currentPlayer] = level;
    if (level === null || (before !== null && level >= before)) return;

    const name = sideName(currentPlayer);
    announce(`${name} has ${level / 1000} seconds left.`);
    try {
        playSound('low_time');
    } catch {
        /* ignore sound errors */
    }
}

/** Saves a game that has started; used when the page is being closed. */
function saveGameInProgress() {
    stopAutoplay(); // Leaving the page
    if (moveHistory.length > 0) saveGameState();
}

// --- Hint ---

/**
 * @returns {boolean} True if a hint can be asked for the position on screen:
 *   in the live game on the player's own turn, and for any earlier position
 *   while looking back (there the engine says what it would have played).
 */
function canHint() {
    if (hintPending || isPromotionChooserOpen()) return false;
    return viewPly !== null || !isBoardLocked();
}

/**
 * Asks the engine for its move in the position on screen and marks it on the
 * board. Nothing is played. For an earlier position the question goes out on
 * a channel of its own, so a computer move being worked out is not disturbed.
 */
function requestHint() {
    if (!canHint()) return;
    const reviewing = viewPly !== null;
    const shown = shownPosition();
    const channel = reviewing ? REVIEW_HINT_CHANNEL : 'play';
    hintPending = true;
    hintMove = null;
    hintPly = shown.ply;
    hintChannel = channel;
    updateStatusDisplay();
    refreshBoardVisuals();
    const position = reviewing ? snapshotPosition(positionHistory[shown.ply]) : livePosition();
    const id = askEngineAbout(
        position,
        shown.player,
        CONFIG.HINT_LEVEL,
        (move) => {
            if (!isLatestEngineRequest(id, channel)) return;
            hintPending = false;
            hintMove = move;
            updateStatusDisplay();
            refreshBoardVisuals();
            if (move) {
                const piece = position.board[move.from.row][move.from.col];
                const from = coordsToAlgebraic(move.from.row, move.from.col);
                const to = coordsToAlgebraic(move.to.row, move.to.col);
                const suggestion = `${PIECE_NAMES[piece.type]} from ${from} to ${to}.`;
                // Asked while looking back, the hint is also the request to hear the score
                announce(
                    reviewing
                        ? `${positionScoreText(shown)} Best move here: ${suggestion}`
                        : `Hint: ${suggestion}`
                );
            }
        },
        channel,
        shown.ply
    );
}

/** Removes the hint, and drops one that is still being worked out. */
function clearHint() {
    if (hintPending) dropEngineRequests(hintChannel);
    hintPending = false;
    hintMove = null;
    hintPly = null;
}

/**
 * Marks the hinted move's two squares while the position it was asked for is
 * on the board, and removes the marks otherwise.
 */
function showHintOnBoard() {
    renderHint(hintMove && hintPly === shownPosition().ply ? hintMove : null);
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

// --- Persistence ---

/** Saves the game, with its undo stack and clock, so it is there after a reload. */
function saveGameState() {
    storeGame({
        version: SAVED_GAME_VERSION,
        ...currentSnapshot(),
        gameStart: gameStart,
        moveHistory: moveHistory,
        gameResult: gameResult,
        endedWithoutMove: endedWithoutMove,
        players: gamePlayers,
        archivedFrom,
        // Times as of now. After a reload the side to move gets back on the clock.
        clock: clock && {
            control: clock.control,
            base: clock.base,
            increment: clock.increment,
            remaining: { [WHITE]: clockRemaining(WHITE), [BLACK]: clockRemaining(BLACK) },
            running: clock.turnStartedAt !== null,
        },
        // The undo stack is not saved: loadGameState plays the moves again to rebuild it
    });
}

/**
 * Makes the saved game, if there is a usable one, the live game.
 * @returns {boolean} True if a saved game was loaded.
 */
function loadGameState() {
    const state = readStoredGame();
    if (!state) return false;
    restoreSnapshot(state);
    gameStart = state.gameStart;
    moveHistory = state.moveHistory;
    // Saves from older versions also carry the undo stack itself
    positionHistory = replayUndoStack(gameStart, moveHistory, state) || state.positionHistory;
    gameResult = state.gameResult;
    endedWithoutMove = state.endedWithoutMove;
    if (state.players) gamePlayers = state.players; // Saves from older versions follow the settings
    archivedFrom = state.archivedFrom;
    clock = state.clock;
    return true;
}

/**
 * Works the undo stack out again by playing the moves from where the game
 * began. The stack is not saved: one board per move made every save larger
 * and slower as a game went on.
 * @param {{player: string, halfmoveClock: number, fen: string|null}} start - How the game began.
 * @param {object[]} moves - The moves played, as moveHistory holds them.
 * @param {object} saved - The saved position, which the moves must lead to.
 * @returns {object[]|null} One snapshot per move, taken before it, or null if
 *   the moves cannot be played or lead elsewhere.
 */
function replayUndoStack(start, moves, saved) {
    const begun = start.fen ? positionFromFEN(start.fen) : { position: initialPosition() };
    if (begun.error) return null;
    let position = begun.position;
    let player = start.player;
    let count = start.halfmoveClock;
    const stack = [];
    for (const move of moves) {
        const piece = position.board[move.from.row][move.from.col];
        const legal = legalMovesFrom(position, move.from.row, move.from.col).some(
            (to) => to.row === move.to.row && to.col === move.to.col
        );
        if (!piece || piece.color !== player || !legal) return null;
        stack.push({
            boardState: position.board,
            currentPlayer: player,
            isGameOver: false,
            kingPositions: position.kingPositions,
            currentStatus: `${sideName(player)}'s turn`,
            enPassantTarget: position.enPassantTarget,
            halfmoveClock: count,
        });
        const played = applyMove(position, move.from, move.to, move.promotion || QUEEN);
        count = piece.type === PAWN || played.move.captured ? 0 : count + 1;
        position = played.position;
        player = opponentOf(player);
    }
    const reached = positionKey(position.board, player, position.enPassantTarget);
    const savedKey = positionKey(saved.boardState, saved.currentPlayer, saved.enPassantTarget);
    return reached === savedKey ? stack : null;
}

// --- Past games ---

/**
 * Puts the current game at the top of the past games, if it has any moves.
 * Whatever is on the board afterwards is a game of its own.
 */
function archiveCurrentGame() {
    const from = archivedFrom;
    archivedFrom = null;
    if (moveHistory.length === 0) return;
    addToArchive(
        {
            pgn: buildPGN(),
            result: (isGameOver && gameResult) || '*',
            opponent: gamePlayers.computer ? recordedName(gamePlayers.computer) : 'Two players',
            date: new Date().toISOString(),
            moves: moveHistory.length,
        },
        from
    );
}

/**
 * Opens a past game. Put back later, it replaces its own entry in the list.
 * @param {{pgn: string, date: string}} entry - As readArchive gives it.
 * @returns {{ok: boolean, error?: string}} As importPGN.
 */
function openArchivedGame(entry) {
    const result = importPGN(entry.pgn);
    if (result.ok) {
        archivedFrom = entry.date;
        saveGameState();
    }
    return result;
}

// --- What the page shows (drawn by game-ui.js) ---

/** Shows the move list for the position on screen, and with it what each side has captured. */
function updateMoveHistoryDisplay() {
    const moves = moveHistory.map((move, index) => ({
        notation: move.notation,
        ...moveNumberAt(index),
        cost: moveCostText(index),
    }));
    renderMoveList(moves, {
        shownPly: shownPosition().ply,
        canView: positionHistory.length === moveHistory.length,
        live: viewPly === null,
    });
    updateCapturedDisplay(); // Follows the same position as the list
}

/**
 * Shows what each side has captured up to the position on screen, and how far
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
    renderCaptured(taken, lead);
}

/**
 * Puts a move into words, followed by the new status:
 * "White knight takes on f3. Check. Black's turn".
 * @param {object} move - An entry of moveHistory.
 * @returns {string}
 */
function describeMove(move) {
    const side = sideName(move.piece.color);
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

/** @returns {string} What the status line says about the position on screen. */
function statusText() {
    if (viewPly !== null) {
        return viewPly === 0 ? 'Viewing the starting position' : `Viewing ${moveLabel(viewPly)}`;
    }
    if (aiThinking) return `${currentStatus} (computer is thinking)`;
    if (drawOffered) return `${currentStatus} (draw offered)`;
    return currentStatus;
}

/** @returns {object} What the buttons depend on, for renderControls in game-ui.js. */
function controlsView() {
    return {
        reviewing: viewPly !== null,
        gameOver: isGameOver && viewPly === null,
        finished: isGameOver,
        canReview: moveHistory.length > 0 && positionHistory.length === moveHistory.length,
        // False for a save from an older version without the positions behind its moves
        canView: positionHistory.length === moveHistory.length,
        shownPly: shownPosition().ply,
        moveCount: moveHistory.length,
        // There must be a move, or a resignation or agreed draw, to take back; never on the clock
        canUndo: !clock && (positionHistory.length > 0 || endedWithoutMove),
        canRedo: !clock && !isGameOver && redoStack.length > 0,
        autoplaying: autoplayTimer !== null,
        inProgress: isGameInProgress(),
        canHint: canHint(),
        hintPending,
        drawOffered,
    };
}

/**
 * @returns {object} For each colour: the name on its bar, whether it is to
 *   move in the live game, and whether the computer is thinking for it.
 */
function playersView() {
    // The names are those of the game on the board, so a finished or loaded
    // game keeps its own players when the settings change
    const named = gamePlayers.computer;
    const side = (color, plain) => ({
        name: !named ? plain : color === named ? recordedName(color, plain) : 'You',
        toMove: !isGameOver && viewPly === null && currentPlayer === color,
        thinking: aiThinking && color === computerColor(),
    });
    return { [WHITE]: side(WHITE, 'White'), [BLACK]: side(BLACK, 'Black') };
}

/** Brings the status line, the player bars, the buttons and the clocks up to date with the game. */
function updateStatusDisplay() {
    recordPlayers(); // A change of settings, or a game going on again after Undo
    renderStatus(statusText());
    renderPlayers(playersView());
    renderControls(controlsView());
    updateClockDisplay();
    // Every way a game ends or goes on again passes through here
    scoreFinishedGame();
}

/**
 * Handles the New Game button. A game in progress needs a second click within
 * a few seconds, so a mis-tap next to Undo cannot wipe it. With no moves played,
 * or once the game is over, there is nothing to lose and it resets at once.
 * Like the other confirmations, the question is withdrawn when the game moves on.
 */
function handleResetClick() {
    if (isGameInProgress() && !confirmSecondClick(resetButton, 'Discard game?')) return;
    resetGame(); // Also puts the button back to normal
    announce(`New game. ${currentStatus}`);
}

/** @returns {string} This game as PGN text. */
function buildPGN() {
    return writePGN({
        moves: moveHistory.map((move) => move.notation),
        start: gameStart,
        result: (isGameOver && gameResult) || '*', // "*" marks a game still in progress
        white: recordedName(WHITE, 'White'),
        black: recordedName(BLACK, 'Black'),
        timeControl: clock ? `${clock.base / 1000}+${clock.increment / 1000}` : null,
        // A resignation or agreed draw is not visible in the moves, so it goes in as a comment
        comment: endedWithoutMove ? currentStatus : null,
        date: new Date(),
    });
}

/**
 * Copies the game to the clipboard as PGN. If the clipboard is not available
 * (older browser, or a page opened from a file), downloads it as a file instead.
 */
function copyPGN() {
    copyOrDownload(buildPGN(), pgnButton, 'Copy PGN', 'static-chess-game.pgn');
}

/** Saves the game as a PGN file, whether or not the clipboard is available. */
function downloadPGN() {
    if (moveHistory.length === 0) return;
    downloadText(buildPGN(), 'static-chess-game.pgn');
    flashButton(downloadButton, 'Saved', 'Save PGN');
}

/**
 * Copies the position on the board to the clipboard as FEN, for an analysis
 * board. While an earlier move is being viewed, it is that position.
 */
function copyFEN() {
    copyOrDownload(buildFEN(), fenButton, 'Copy FEN', 'static-chess-position.fen');
}

/**
 * @returns {string} An address of this page that opens the game: the whole
 *   game while the live position is shown and the link is not too long, else
 *   the position on screen.
 */
function buildShareLink() {
    const base = location.href.split('#')[0];
    if (viewPly === null && moveHistory.length > 0) {
        const link = `${base}#pgn=${encodeURIComponent(buildPGN())}`;
        if (link.length <= CONFIG.SHARE_LINK_MAX_LENGTH) return link;
    }
    return `${base}#fen=${encodeURIComponent(buildFEN())}`;
}

/** Copies a link to the game, or to the position on screen, to the clipboard. */
function copyLink() {
    copyOrDownload(buildShareLink(), linkButton, 'Copy link', 'static-chess-link.txt');
}

/** @returns {string} The position on screen in Forsyth-Edwards Notation. */
function buildFEN() {
    const shown = shownPosition();
    return positionToFEN(shown, shown.player, shown.halfmoveClock, moveNumberAt(shown.ply).number);
}

// --- Loading a game from PGN or FEN ---

/**
 * Replaces the current game with one given as PGN. Every move is checked
 * first (readPGN in notation.js); if one cannot be played, nothing is changed.
 * A result the moves do not show (resignation, agreed draw, time) ends the
 * loaded game as well; Undo reopens it.
 * @param {string} text
 * @param {boolean} validateOnly - Check the moves without replacing the game.
 * @returns {{ok: boolean, error?: string, empty?: boolean, moves?: number}} empty: the
 *   text holds no move at all.
 */
function importPGN(text, validateOnly = false) {
    const game = readPGN(text);
    if (!game.ok) return game;
    const { start, moves } = game;
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
    // A finished game was played by whoever its tags name, not by the opponent chosen now
    if (isGameOver) gamePlayers = playersFromPGN(text);
    redraw();
    saveGameState();
    announce(`Game loaded, ${moves.length} moves. ${currentStatus}`);
    requestAIMove();
    return { ok: true, moves: moves.length };
}

/**
 * @param {string} text - A game as PGN.
 * @returns {{level: string|null, computer: string|null}} Who played it: the
 *   computer if a White or Black tag names it as this app writes it, else two players.
 */
function playersFromPGN(text) {
    const game = firstPGNGame(text);
    for (const [color, tag] of [
        [WHITE, 'White'],
        [BLACK, 'Black'],
    ]) {
        const named = /^Computer \((\w+)\)$/.exec(pgnTag(game, tag) || '');
        if (named && Object.prototype.hasOwnProperty.call(AI_LEVELS, named[1])) {
            return { level: named[1], computer: color };
        }
    }
    return { level: null, computer: null };
}

/**
 * Replaces the current game with a new one that begins from a position given
 * in FEN. If the text cannot be used, nothing is changed.
 * @param {string} text
 * @param {boolean} validateOnly - Check the position without replacing the game.
 * @returns {{ok: boolean, error?: string}}
 */
function importFEN(text, validateOnly = false) {
    const read = readFEN(text);
    if (!read.ok) return read;
    if (validateOnly) return { ok: true };

    const { start } = read;
    startGameFrom(start.position, start.player, start.halfmoveClock, start.fullmove);
    endIfAlreadyDecided();
    redraw();
    saveGameState();
    announce(`Position loaded. ${currentStatus}`);
    requestAIMove();
    return { ok: true };
}

/**
 * A game may begin from a position in which it is already over: mate,
 * stalemate, bare kings, or a half-move count that has reached the fifty-move rule.
 */
function endIfAlreadyDecided() {
    // A position that has just been set up has not been repeated
    const outcome = gameOutcome(livePosition(), currentPlayer, { halfmoveClock, repeated: false });
    if (outcome) endWith(outcome);
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
        handleResetClick,
        buildPGN,
        hasInsufficientMaterial,
        viewMove,
        returnToLiveGame,
        reviewFromStart,
        handlePageKey,
        requestHint,
        importPGN,
        importFEN,
        downloadPGN,
        pgnMoveTokens,
        pgnResult,
        readArchive,
        openImportDialog,
        importSizeError,
        isGameInProgress,
        buildFEN,
        buildShareLink,
        openArchivedGame,
        copyLink,
        setTimeControl,
        setSideListener,
        redoMove,
        toggleAutoplay,
        stopAutoplay,
        clockRemaining,
        formatClock,
        stopAllTimers,
        saveGameState,
        get clock() {
            return clock;
        },
        get hintMove() {
            return hintMove;
        },
        get gameScores() {
            return gameScores;
        },
        moveCost,
        playersView,
        resign,
        handleResignClick,
        handleDrawClick,
        playFromHere,
        isOwnPiece,
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
