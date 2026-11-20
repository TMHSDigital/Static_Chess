/**
 * @fileoverview What the game looks like on the page, apart from the board:
 * the status line, the buttons, the clocks, the move list, the captured
 * pieces, announcements for screen readers, and the Load dialog. Nothing here
 * holds or changes the state of a game. game.js says what to show, in plain
 * values, and is called back when a control is used.
 */

const moveHistoryElement = document.getElementById('move-history');
const gameStatusElement = document.getElementById('game-status');
const statusBar = document.getElementById('status-bar');
const resultActions = document.getElementById('result-actions');
const reviewButton = document.getElementById('review-button');
const againButton = document.getElementById('again-button');
const liveButton = document.getElementById('live-button');
const reviewActions = document.getElementById('review-actions');
const playHereButton = document.getElementById('play-here-button');
const stepButtons = document.getElementById('step-buttons');
const autoplayButton = document.getElementById('autoplay-button');
const reviewScoreElement = document.getElementById('review-score');
const resignButton = document.getElementById('resign-button');
const drawButton = document.getElementById('draw-button');
const hintButton = document.getElementById('hint-button');
const resetButton = document.getElementById('reset-button');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const pgnButton = document.getElementById('pgn-button');
const downloadButton = document.getElementById('download-button');
const fenButton = document.getElementById('fen-button');
const linkButton = document.getElementById('link-button');
const capturedRows = {
    [WHITE]: document.getElementById('captured-by-white'),
    [BLACK]: document.getElementById('captured-by-black'),
};
const sideRows = {
    [WHITE]: document.getElementById('side-white'),
    [BLACK]: document.getElementById('side-black'),
};
const clockElements = {
    [WHITE]: document.getElementById('clock-white'),
    [BLACK]: document.getElementById('clock-black'),
};
let announcerElement = document.getElementById('announcer'); // Live region read out by screen readers
const pendingConfirms = new Map(); // Buttons waiting for a confirming second click
const importButton = document.getElementById('import-button');
const importDialog = document.getElementById('import-dialog');
const importText = document.getElementById('import-text');
const importError = document.getElementById('import-error');
const importLoadButton = document.getElementById('import-load');
const importCancelButton = document.getElementById('import-cancel');
const importFileButton = document.getElementById('import-file-button');
const importFile = document.getElementById('import-file');
const archiveSection = document.getElementById('archive-section');
const archiveList = document.getElementById('archive-list');
const archiveClearButton = document.getElementById('archive-clear');
const moreSettings = document.getElementById('more-settings');
const shortcutsButton = document.getElementById('shortcuts-button');
const shortcutsDialog = document.getElementById('shortcuts-dialog');
const shortcutsList = document.getElementById('shortcuts-list');
const shortcutsCloseButton = document.getElementById('shortcuts-close');
let shortcutsReturnFocus = null; // Focus restored when the Keyboard shortcuts dialog closes

// --- Connecting the controls ---

let pageKeyHandler = null; // What the game does with a key pressed outside the board and the form fields
let redoHandler = null; // What Ctrl+Y and Ctrl+Shift+Z do, when Undo is offered
// What the Load dialog asks of the game, given by bindControls
let gameHandlers = {
    importGame: () => ({ ok: false, error: 'The game is not ready.' }),
    isGameInProgress: () => false,
    openArchivedGame: () => ({ ok: false, error: 'The game is not ready.' }),
};
let stopAutoplayHandler = null; // Stops the Play button stepping through the game

/**
 * Any press or key other than on the Play button itself stops it stepping:
 * the player has taken over. Listened for before anything else sees it.
 */
function stopAutoplayOnInput(event) {
    if (!stopAutoplayHandler || !autoplayButton) return;
    if (autoplayButton.contains(event.target)) return;
    stopAutoplayHandler();
}

/** @returns {boolean} True for Ctrl+Y or Ctrl+Shift+Z (Cmd on a Mac). */
function isRedoKey(event) {
    return matchesKeyBinding('redo', event);
}

/** @returns {{dialog: HTMLElement, close: () => void}|null} The open modal dialog, if any. */
function openModalDialog() {
    if (shortcutsDialog && !shortcutsDialog.hidden) {
        return { dialog: shortcutsDialog, close: closeShortcutsDialog };
    }
    if (importDialog && !importDialog.hidden) {
        return { dialog: importDialog, close: closeImportDialog };
    }
    return null;
}

/**
 * Keys that work anywhere on the page. The board, form fields and dialogs
 * keep their own keys: there the arrows move between squares, change a
 * setting or choose a piece. A key another handler has used is left alone.
 */
function handlePageKeydown(event) {
    if (event.defaultPrevented) return;
    const modal = openModalDialog();
    if (modal) {
        handleOpenDialogKey(event, modal.dialog, modal.close); // Nothing behind an open dialog reacts to keys
        return;
    }
    const target = event.target;
    const inField = (selector) => target && target.closest && target.closest(selector);
    // Text fields keep their own redo; the board has no use for it
    if (redoHandler && isRedoKey(event)) {
        if (inField('input, select, textarea, [role="dialog"], .promotion-backdrop')) return;
        event.preventDefault();
        redoHandler();
        return;
    }
    // "?" opens the keyboard shortcuts panel (Shift is held on most layouts)
    if (
        shortcutsDialog &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        matchesKeyBinding('shortcuts-help', event)
    ) {
        if (
            inField(
                'input, select, textarea, [contenteditable], [role="dialog"], .promotion-backdrop'
            )
        ) {
            return;
        }
        event.preventDefault();
        openShortcutsDialog();
        return;
    }
    if (!pageKeyHandler) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (inField('#chess-board, input, select, textarea, [role="dialog"], .promotion-backdrop')) {
        return;
    }
    if (pageKeyHandler(event.key)) event.preventDefault();
}

/**
 * A square pressed with a mouse or a finger does not keep the keyboard focus.
 * Otherwise the arrow keys would go on walking the board for someone who
 * never meant to use them there, instead of stepping through the game. A
 * square reached with the keyboard keeps its focus: no pointer is released.
 */
function releaseBoardFocus() {
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains('square')) active.blur();
}

/**
 * Brings Settings into view when it has just been opened. Beside the board the
 * panel scrolls inside itself, and Settings opens below what is showing.
 */
function showOpenedSettings() {
    if (moreSettings.open && typeof moreSettings.scrollIntoView === 'function') {
        moreSettings.scrollIntoView({ block: 'nearest' });
    }
}

/** Calls a handler for an event on an element, once, however often this is asked for. */
function listen(element, type, handler) {
    if (!element) return;
    element.removeEventListener(type, handler);
    element.addEventListener(type, handler);
}

/**
 * Connects the controls on the page to the game. It can be called again, as
 * when the game is started anew, without anything being called twice.
 * @param {object} handlers - What the game does on a click in the move list
 *   (moveListClick) or a key there (moveListKeydown), and on the buttons: live,
 *   playHere, step, resign, draw, hint, reset, review, copyPGN, downloadPGN,
 *   copyFEN, copyLink, undo, redo and autoplay. undoOffered: false hides Undo
 *   and Redo. pageKey: given a key pressed elsewhere on the page, returns true
 *   if it used it. stopAutoplay: stops the Play button. For the Load dialog:
 *   importGame(text, validateOnly), isGameInProgress() and
 *   openArchivedGame(entry), so nothing here calls into game.js.
 */
function bindControls(handlers) {
    pageKeyHandler = handlers.pageKey || null;
    gameHandlers = {
        importGame: handlers.importGame,
        isGameInProgress: handlers.isGameInProgress,
        openArchivedGame: handlers.openArchivedGame,
    };
    listen(document, 'keydown', handlePageKeydown);
    listen(document, 'pointerup', releaseBoardFocus);
    listen(moreSettings, 'toggle', showOpenedSettings);
    listen(moveHistoryElement, 'click', handlers.moveListClick);
    listen(moveHistoryElement, 'keydown', handlers.moveListKeydown);
    listen(liveButton, 'click', handlers.live);
    listen(playHereButton, 'click', handlers.playHere);
    listen(stepButtons, 'click', handlers.step);
    listen(autoplayButton, 'click', handlers.autoplay);
    stopAutoplayHandler = handlers.stopAutoplay || null;
    for (const type of ['pointerdown', 'keydown']) {
        document.removeEventListener(type, stopAutoplayOnInput, true);
        document.addEventListener(type, stopAutoplayOnInput, true);
    }
    listen(resignButton, 'click', handlers.resign);
    listen(drawButton, 'click', handlers.draw);
    listen(hintButton, 'click', handlers.hint);
    listen(resetButton, 'click', handlers.reset);
    // Beside the result of a finished game
    listen(reviewButton, 'click', handlers.review);
    listen(againButton, 'click', handlers.reset);
    listen(pgnButton, 'click', handlers.copyPGN);
    listen(downloadButton, 'click', handlers.downloadPGN);
    listen(fenButton, 'click', handlers.copyFEN);
    listen(linkButton, 'click', handlers.copyLink);
    if (undoButton) {
        undoButton.removeEventListener('click', handlers.undo);
        if (handlers.undoOffered) {
            undoButton.addEventListener('click', handlers.undo);
        } else {
            undoButton.hidden = true;
        }
    }
    // Redo is offered with Undo, as it only brings back what Undo took
    redoHandler = handlers.undoOffered && handlers.redo ? handlers.redo : null;
    if (redoButton) {
        if (handlers.redo) redoButton.removeEventListener('click', handlers.redo);
        if (redoHandler) redoButton.addEventListener('click', redoHandler);
        else redoButton.hidden = true;
    }

    // The Load dialog and the past games in it
    listen(archiveList, 'click', handleArchiveClick);
    listen(archiveClearButton, 'click', handleArchiveClear);
    if (importButton && importDialog) {
        listen(importButton, 'click', openImportDialog);
        listen(importLoadButton, 'click', handleImportLoad);
        listen(importCancelButton, 'click', closeImportDialog);
        // A file can be dropped anywhere on the dialog
        for (const type of ['dragover', 'dragleave', 'drop']) {
            listen(importDialog, type, handleImportDrag);
        }
    }
    if (importFileButton && importFile) {
        listen(importFileButton, 'click', chooseImportFile);
        listen(importFile, 'change', handleImportFileChosen);
    }

    // The Keyboard shortcuts dialog
    if (shortcutsDialog) {
        listen(shortcutsButton, 'click', handleShortcutsButtonClick);
        listen(shortcutsCloseButton, 'click', closeShortcutsDialog);
        listen(shortcutsDialog, 'click', handleShortcutsBackdropClick);
    }
}

// --- Status line, buttons and clocks ---

/** Shows a text in the status line. */
function renderStatus(text) {
    gameStatusElement.textContent = text;
}

/**
 * Switches the buttons on and off and sets their labels.
 * @param {object} view - reviewing: an earlier position is on the board.
 *   canView: the positions behind the moves are there to look at. shownPly:
 *   moves played in the position on screen. moveCount: moves played in the
 *   game. gameOver: the result of a finished game is on screen. canReview:
 *   that game has moves to go through. canUndo, canRedo, inProgress, canHint,
 *   hintPending, drawOffered: as named.
 */
function renderControls(view) {
    const focused = document.activeElement; // Kept below if the change switches it off
    applyControls(view);
    if (focused && focused !== document.body && isSwitchedOff(focused)) handOnFocus(focused);
}

/** @returns {boolean} True for an element that is disabled or hidden, and so cannot keep the focus. */
function isSwitchedOff(element) {
    return (
        element.disabled === true ||
        !!(element.closest && element.closest('[hidden], .holds-place'))
    );
}

/**
 * A control that switches itself off when pressed would drop the keyboard
 * focus to the page, and the next Tab would start from the top. The focus goes
 * instead to the nearest step button still on, for a step button, or else to
 * the board.
 */
function handOnFocus(control) {
    const usable = (element) => element && !isSwitchedOff(element);
    let next = null;
    if (stepButtons && stepButtons.contains(control)) {
        const steps = Array.from(stepButtons.querySelectorAll('button[data-step]'));
        const at = steps.indexOf(control);
        const byDistance = steps
            .map((button, index) => ({ button, distance: Math.abs(index - at) }))
            .sort((a, b) => a.distance - b.distance);
        const found = byDistance.find(({ button }) => usable(button));
        next = found ? found.button : null;
    }
    if (!next) next = document.querySelector('#chess-board .square[tabindex="0"]');
    if (usable(next)) next.focus();
}

/** Sets what renderControls describes, without minding the focus. */
function applyControls(view) {
    // A finished game: the result stands out and offers what to do next
    if (statusBar) statusBar.classList.toggle('is-over', view.gameOver);
    if (resultActions) {
        // While a finished game is looked back on, its buttons keep their room out
        // of sight, so the bar keeps its height and the board does not move
        const holdPlace = view.reviewing && view.finished;
        resultActions.hidden = !view.gameOver && !holdPlace;
        resultActions.classList.toggle('holds-place', holdPlace);
    }
    if (reviewButton) reviewButton.hidden = !view.canReview;
    if (liveButton) liveButton.hidden = !view.reviewing;
    if (reviewActions) reviewActions.hidden = !view.reviewing;
    if (reviewScoreElement) reviewScoreElement.hidden = !view.reviewing;
    if (stepButtons) {
        // Off at the end already reached, and when there are no positions to look at
        for (const button of stepButtons.querySelectorAll('button[data-step]')) {
            const back = button.dataset.step === 'first' || button.dataset.step === 'previous';
            button.disabled = !view.canView || view.shownPly === (back ? 0 : view.moveCount);
        }
    }
    if (autoplayButton) {
        autoplayButton.disabled = !view.canView || view.moveCount === 0;
        autoplayButton.setAttribute(
            'aria-label',
            view.autoplaying ? 'Pause' : 'Play through the moves'
        );
        autoplayButton.classList.toggle('is-playing', !!view.autoplaying);
    }
    if (undoButton) undoButton.disabled = !view.canUndo;
    if (redoButton) redoButton.disabled = !view.canRedo;
    if (pgnButton) pgnButton.disabled = view.moveCount === 0;
    if (downloadButton) downloadButton.disabled = view.moveCount === 0;
    if (resignButton) resignButton.disabled = !view.inProgress;
    if (hintButton) {
        hintButton.disabled = !view.canHint;
        hintButton.textContent = view.hintPending ? 'Thinking' : 'Hint';
    }
    if (drawButton) {
        drawButton.disabled = !view.inProgress;
        drawButton.textContent = view.drawOffered ? 'Accept draw?' : 'Offer draw';
        drawButton.classList.toggle('confirming', view.drawOffered);
    }
}

/**
 * Fills the two player bars: who plays each side, whose move it is, and
 * whether the computer is working out its move.
 * @param {object} players - For each colour { name, toMove, thinking }.
 */
function renderPlayers(players) {
    for (const color of [WHITE, BLACK]) {
        const row = sideRows[color];
        if (!row) continue;
        const { name, toMove, thinking } = players[color];
        row.querySelector('.side-name').textContent = name;
        row.classList.toggle('to-move', toMove);
        // Decoration only: the status line says the same to screen readers
        row.querySelector('.thinking').hidden = !thinking;
    }
}

/**
 * Shows both clocks, or hides them in a game without one.
 * @param {object|null} clocks - For each colour { left, running }: the
 *   milliseconds left and whether that clock is running; null for no clock.
 */
function renderClocks(clocks) {
    for (const color of [WHITE, BLACK]) {
        const element = clockElements[color];
        if (!element) continue;
        element.hidden = !clocks;
        if (!clocks) continue;
        const { left, running } = clocks[color];
        element.textContent = formatClock(left);
        element.classList.toggle('running', running);
        element.classList.toggle('low', left < Math.max(...CONFIG.LOW_TIME_WARNINGS));
        // A timer is not read out on every change; the label is there when asked for
        element.setAttribute('aria-label', `${sideName(color)} clock: ${formatClock(left)}`);
    }
}

/** Shows a text in the line under the move list, seen while looking back. */
function renderReviewScore(text) {
    if (reviewScoreElement) reviewScoreElement.textContent = text;
}

/**
 * Marks the two squares of a suggested move on the board, or removes the marks.
 * @param {{from: {row, col}, to: {row, col}}|null} move
 */
function renderHint(move) {
    boardElement
        .querySelectorAll('.hint-from, .hint-to')
        .forEach((el) => el.classList.remove('hint-from', 'hint-to'));
    if (!move) return;
    const from = getSquareElement(move.from.row, move.from.col);
    const to = getSquareElement(move.to.row, move.to.col);
    if (from) from.classList.add('hint-from');
    if (to) to.classList.add('hint-to');
}

// --- Move list and captured pieces ---

/**
 * Rebuilds the move list.
 * @param {{notation: string, number: number, white: boolean, cost: string|null}[]} moves -
 *   The moves in order. number and white: the move number and whose move it
 *   is. cost: a sentence on what the move lost, for a move to be marked.
 * @param {{shownPly: number, canView: boolean, live: boolean}} view - shownPly:
 *   moves played in the position on screen. canView: the moves can be clicked
 *   to look at their positions. live: the live game is on the board.
 */
function renderMoveList(moves, view) {
    // Rebuilding drops the focused entry; it is put back below, also when the
    // change comes from the computer's move or the review scores, not a key
    const hadFocus = moveHistoryElement.contains(document.activeElement);
    moveHistoryElement.innerHTML = ''; // Clear existing
    let listItem = null;
    let current = null; // The entry for the position on screen

    moves.forEach((move, index) => {
        const ply = index + 1;
        if (move.white || index === 0) {
            // White's move starts a new row
            listItem = document.createElement('li');
            const turnSpan = document.createElement('span');
            turnSpan.classList.add('turn-number');
            turnSpan.textContent = `${move.number}.`;
            listItem.appendChild(turnSpan);
            if (!move.white) {
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
        entry.classList.add('move', move.white ? 'white-move' : 'black-move');
        entry.textContent = move.notation;
        entry.dataset.ply = ply;
        entry.tabIndex = -1;
        entry.disabled = !view.canView;
        if (move.cost) {
            // The "?" comes from the stylesheet; the reason is in the name and the tooltip
            entry.classList.add('lost-ground');
            entry.title = move.cost;
            entry.setAttribute('aria-label', `${move.notation}. ${move.cost}`);
        }
        if (ply === view.shownPly) {
            entry.setAttribute('aria-current', 'true');
            current = entry;
        }
        listItem.appendChild(entry);
    });

    const tabStop = current || moveHistoryElement.querySelector('button[data-ply]');
    if (tabStop) tabStop.tabIndex = 0;
    if (hadFocus && tabStop && !tabStop.disabled) tabStop.focus();

    // Highlight the row of the last move played
    if (moveHistoryElement.lastElementChild) {
        moveHistoryElement.lastElementChild.classList.add('last-move-entry');
    }

    if (view.live) {
        moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight; // Follow the game
    } else if (current && typeof current.scrollIntoView === 'function') {
        current.scrollIntoView({ block: 'nearest' });
    }
}

/** The list is rebuilt on every change, so focus has to be put back by hand. */
function focusCurrentMove() {
    const entry = moveHistoryElement.querySelector('button[tabindex="0"]');
    if (entry) entry.focus();
}

/**
 * Lists what each side has captured, and how far ahead in material the
 * leading side is.
 * @param {object} taken - For each colour, the types of the pieces it has captured.
 * @param {number} lead - White's material less Black's, in pawns.
 */
function renderCaptured(taken, lead) {
    const order = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN];
    for (const color of [WHITE, BLACK]) {
        const rowElement = capturedRows[color];
        if (!rowElement) continue;
        const side = sideName(color);
        const ahead = color === WHITE ? lead : -lead;
        const types = [...taken[color]].sort((a, b) => order.indexOf(a) - order.indexOf(b));

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

// --- Announcements for screen readers ---

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
    // The same text set again is no change, and would not be read again: a
    // repeat goes in with a trailing no-break space, or without the one it had
    const current = announcerElement.textContent;
    announcerElement.textContent = current === message ? `${message}\u00A0` : message;
}

// --- Buttons that ask twice, and short notices on buttons ---

// The buttons the game asks twice on, or puts a notice on, by what they do.
// Their own labels are kept from the page, so a notice always goes back to
// what index.html says and game.js holds neither elements nor labels.
const actionButtons = {
    playHere: playHereButton,
    resign: resignButton,
    reset: resetButton,
    pgn: pgnButton,
    download: downloadButton,
    fen: fenButton,
    link: linkButton,
};
const actionLabels = new Map(
    Object.values(actionButtons)
        .filter(Boolean)
        .map((button) => [button, button.textContent.trim()])
);

/**
 * Asks for a confirming second click on the button for an action.
 * @param {string} action - 'playHere', 'resign' or 'reset'.
 * @param {string} question - Label shown while waiting.
 * @returns {boolean} True on the confirming click, or if the page has no such button.
 */
function askToConfirm(action, question) {
    const button = actionButtons[action];
    return button ? confirmSecondClick(button, question) : true;
}

/** Withdraws a question asked on the button for an action, if one is showing. */
function withdrawQuestion(action) {
    if (actionButtons[action]) cancelConfirm(actionButtons[action]);
}

/**
 * Copies text with the button for an action, which then says whether it was
 * copied or downloaded and goes back to its own label.
 * @param {string} action - 'pgn', 'fen' or 'link'.
 * @param {string} text
 * @param {string} filename - Name of the file if it has to be downloaded.
 */
function copyFromButton(action, text, filename) {
    const button = actionButtons[action];
    if (!button) return;
    copyOrDownload(text, button, actionLabels.get(button), filename);
}

/** Shows a short notice on the button for an action, then its own label again. */
function notifyOnButton(action, notice) {
    const button = actionButtons[action];
    if (button) flashButton(button, notice, actionLabels.get(button));
}

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
        timer: setTimeout(() => cancelConfirm(button), CONFIG.CONFIRM_MS),
    });
    button.textContent = question;
    button.classList.add('confirming');
    announce(`${question} Press again to confirm.`);
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

/** Shows a short notice on a button, then its normal label again. */
function flashButton(button, notice, label) {
    button.textContent = notice;
    announce(notice);
    setTimeout(() => {
        button.textContent = label;
    }, CONFIG.NOTICE_MS);
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
    const download = () => {
        downloadText(text, filename);
        flashButton(button, 'Downloaded', label);
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
            .writeText(text)
            .then(() => flashButton(button, 'Copied!', label), download);
    } else {
        download();
    }
}

/** Hands text to the browser as a file to save: a PGN file as such, anything else as plain text. */
function downloadText(text, filename) {
    const type = filename.endsWith('.pgn') ? 'application/x-chess-pgn' : 'text/plain';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type }));
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

// --- The Load dialog ---

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
        button.classList.add('btn', 'archive-open');
        button.dataset.index = index;
        button.dataset.date = entry.date; // Names the game if another tab changes the list
        button.textContent = describeArchivedGame(entry);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.classList.add('btn', 'archive-delete');
        remove.dataset.delete = index;
        remove.dataset.date = entry.date;
        remove.textContent = 'Delete';
        remove.setAttribute('aria-label', `Delete ${button.textContent}`);
        item.append(button, remove);
        archiveList.appendChild(item);
    });
}

/**
 * Deletes a past game on a confirming second click. The focus stays in the
 * list, on the entry that took its place, or leaves for the text box when the
 * list is empty.
 * @param {HTMLElement} button - The entry's Delete button.
 */
function deleteArchivedGame(button) {
    if (!confirmSecondClick(button, 'Delete?')) return;
    const index = Number(button.dataset.delete);
    if (!removeFromArchive(index, button.dataset.date)) {
        importError.textContent = 'That game could not be deleted.';
        return;
    }
    showArchive();
    const rows = archiveList.querySelectorAll('.archive-delete');
    const next = rows[Math.min(index, rows.length - 1)];
    if (next) next.focus();
    else importText.focus();
    announce('Game deleted.');
}

/** Clears the past games on a confirming second click. */
function handleArchiveClear() {
    if (!confirmSecondClick(archiveClearButton, 'Clear all?')) return;
    clearArchive();
    showArchive();
    importText.focus();
    announce('Past games cleared.');
}

/** A click on a past game loads it. The game it replaces goes into the list itself. */
function handleArchiveClick(event) {
    const remove = event.target.closest ? event.target.closest('button[data-delete]') : null;
    if (remove) {
        deleteArchivedGame(remove);
        return;
    }
    const button = event.target.closest ? event.target.closest('button[data-index]') : null;
    if (!button) return;
    const entry = readArchive()[findInArchive(Number(button.dataset.index), button.dataset.date)];
    const result = entry
        ? gameHandlers.openArchivedGame(entry)
        : { ok: false, error: 'That game is gone.' };
    if (!result.ok) {
        importError.textContent = `${result.error} The current game was not changed.`;
        return;
    }
    closeImportDialog();
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
    const load = gameHandlers.importGame;
    const validation = load(importText.value, true);
    if (!validation.ok) {
        cancelConfirm(importLoadButton);
        importError.textContent = validation.empty
            ? 'Paste a game in PGN format, or a position in FEN, first.'
            : `${validation.error} The current game was not changed.`;
        return;
    }
    importError.textContent = '';
    if (
        gameHandlers.isGameInProgress() &&
        !confirmSecondClick(importLoadButton, 'Discard current game?')
    ) {
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

/**
 * Loads a game or position that came in a shared link, through the Load
 * dialog: the text is checked like pasted text, an error is shown there, and
 * a game in progress is replaced only after Load is pressed again.
 * @param {string} text
 */
function openSharedText(text) {
    if (!importDialog) return;
    openImportDialog();
    importText.value = text;
    handleImportLoad();
}

/** "Open file" opens the browser's file chooser. */
function chooseImportFile() {
    importFile.click();
}

/** A file was chosen: its text goes into the box, where Load checks it like pasted text. */
function handleImportFileChosen() {
    const file = importFile.files && importFile.files[0];
    importFile.value = ''; // So choosing the same file again is noticed
    if (file) readImportFile(file);
}

/** A file dragged over the dialog is marked as welcome; dropped, it is read. */
function handleImportDrag(event) {
    const types = event.dataTransfer ? Array.from(event.dataTransfer.types || []) : [];
    if (!types.includes('Files')) return; // Dragged text is left to the text box
    event.preventDefault();
    const panel = importDialog.querySelector('.import-panel') || importDialog;
    panel.classList.toggle('drop-target', event.type === 'dragover');
    if (event.type === 'drop' && event.dataTransfer.files[0]) {
        readImportFile(event.dataTransfer.files[0]);
    }
}

/**
 * Puts the text of a file into the Load dialog's box. Nothing is loaded yet:
 * the Load button then checks it and asks before a game in progress is replaced.
 * @param {File} file
 */
function readImportFile(file) {
    cancelConfirm(importLoadButton);
    const tooLong = importSizeError(file.size);
    if (tooLong) {
        importError.textContent = tooLong;
        return;
    }
    file.text().then(
        (text) => {
            importText.value = text;
            importError.textContent = '';
            importLoadButton.focus();
        },
        () => {
            importError.textContent = 'That file could not be read.';
        }
    );
}

// --- The Keyboard shortcuts dialog ---

/** Fills the Keyboard shortcuts dialog from KEY_BINDINGS so it cannot drift from the handlers. */
function renderShortcutsList() {
    if (!shortcutsList || shortcutsList.childElementCount > 0) return;
    const sections = new Map();
    for (const binding of KEY_BINDINGS) {
        if (!sections.has(binding.section)) sections.set(binding.section, []);
        sections.get(binding.section).push(binding);
    }
    for (const [heading, entries] of sections) {
        const group = document.createElement('section');
        group.className = 'shortcuts-section';
        const title = document.createElement('h4');
        title.textContent = heading;
        group.appendChild(title);
        const list = document.createElement('dl');
        list.className = 'shortcuts-entries';
        for (const entry of entries) {
            const row = document.createElement('div');
            row.className = 'shortcuts-row';
            const dt = document.createElement('dt');
            entry.labels.forEach((label, index) => {
                if (index > 0) dt.appendChild(document.createTextNode(' / '));
                const kbd = document.createElement('kbd');
                kbd.textContent = label;
                dt.appendChild(kbd);
            });
            const dd = document.createElement('dd');
            dd.textContent = entry.description;
            row.append(dt, dd);
            list.appendChild(row);
        }
        group.appendChild(list);
        shortcutsList.appendChild(group);
    }
}

/** Opens the Keyboard shortcuts dialog and remembers where to put the focus back. */
function openShortcutsDialog(trigger = null) {
    if (!shortcutsDialog) return;
    shortcutsReturnFocus = trigger || document.activeElement;
    renderShortcutsList();
    shortcutsDialog.hidden = false;
    if (shortcutsCloseButton) shortcutsCloseButton.focus();
}

/** Closes the Keyboard shortcuts dialog and returns focus to where it was before. */
function closeShortcutsDialog() {
    if (!shortcutsDialog || shortcutsDialog.hidden) return;
    const returnFocus = shortcutsReturnFocus;
    shortcutsReturnFocus = null;
    shortcutsDialog.hidden = true;
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
}

/** Opens the Keyboard shortcuts dialog from the link in Settings. */
function handleShortcutsButtonClick() {
    openShortcutsDialog(shortcutsButton);
}

/** A click on the dimmed area around the Keyboard shortcuts panel closes it. */
function handleShortcutsBackdropClick(event) {
    if (event.target === shortcutsDialog) closeShortcutsDialog();
}

/**
 * Keys pressed while a modal dialog is open, wherever the focus is, as after
 * a click on the dimmed backdrop: Escape closes it, and Tab and Shift+Tab go
 * round its own controls instead of reaching the page behind it.
 */
function handleOpenDialogKey(event, dialog, close) {
    if (matchesKeyBinding('dialog-close', event)) {
        event.preventDefault();
        close();
        return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(
        dialog.querySelectorAll('textarea, button, input, a[href], [tabindex="0"]')
    ).filter((element) => !element.disabled && !element.closest('[hidden]'));
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = document.activeElement;
    const inside = dialog.contains(active);
    if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
    }
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        bindControls,
        renderStatus,
        renderControls,
        renderClocks,
        renderPlayers,
        renderReviewScore,
        renderHint,
        renderMoveList,
        renderCaptured,
        focusCurrentMove,
        announce,
        confirmSecondClick,
        cancelConfirm,
        cancelConfirms,
        flashButton,
        copyOrDownload,
        downloadText,
        openImportDialog,
        closeImportDialog,
        openShortcutsDialog,
        closeShortcutsDialog,
        openSharedText,
        askToConfirm,
        withdrawQuestion,
        copyFromButton,
        notifyOnButton,
    };
}
