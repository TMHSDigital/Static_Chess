/**
 * @fileoverview Pawn promotion chooser: a small dialog with one button per
 * piece. game.js opens it when a pawn is about to reach the last rank and
 * finishes the move once a piece has been picked.
 */

const PROMOTION_CHOICES = [
    { type: 'q', label: 'Queen' },
    { type: 'r', label: 'Rook' },
    { type: 'b', label: 'Bishop' },
    { type: 'n', label: 'Knight' },
];

let promotionRequest = null; // { onChoose, onCancel, returnFocus } while the dialog is open

/** Builds the dialog once and returns it. */
function getPromotionDialog() {
    let dialog = document.getElementById('promotion-dialog');
    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.id = 'promotion-dialog';
    dialog.className = 'promotion-backdrop';
    dialog.hidden = true;

    const panel = document.createElement('div');
    panel.className = 'promotion-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'promotion-title');

    const title = document.createElement('h3');
    title.id = 'promotion-title';
    title.textContent = 'Promote pawn to';
    panel.appendChild(title);

    const choices = document.createElement('div');
    choices.className = 'promotion-choices';
    for (const choice of PROMOTION_CHOICES) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'promotion-choice';
        button.dataset.piece = choice.type;
        button.setAttribute('aria-label', choice.label);
        button.title = choice.label;
        button.addEventListener('click', () => closePromotionChooser(choice.type));
        choices.appendChild(button);
    }
    panel.appendChild(choices);
    dialog.appendChild(panel);

    // A click on the dimmed area around the panel cancels the move
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closePromotionChooser(null);
    });
    dialog.addEventListener('keydown', handlePromotionKeydown);

    document.body.appendChild(dialog);
    return dialog;
}

/** Escape cancels; Tab and the arrow keys stay inside the four buttons. */
function handlePromotionKeydown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closePromotionChooser(null);
        return;
    }
    const step =
        { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key] ||
        (event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0);
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const buttons = Array.from(getPromotionDialog().querySelectorAll('.promotion-choice'));
    const current = buttons.indexOf(document.activeElement);
    buttons[(current + step + buttons.length) % buttons.length].focus();
}

/**
 * Opens the chooser.
 * @param {string} color - Colour of the promoting pawn ('w' or 'b').
 * @param {(type: string) => void} onChoose - Called with 'q', 'r', 'b' or 'n'.
 * @param {() => void} [onCancel] - Called if the player backs out.
 */
function showPromotionChooser(color, onChoose, onCancel) {
    const dialog = getPromotionDialog();
    dialog.querySelectorAll('.promotion-choice').forEach((button) => {
        button.style.backgroundImage = `url('assets/${color}${button.dataset.piece}.svg')`;
    });
    promotionRequest = { onChoose, onCancel, returnFocus: document.activeElement };
    dialog.hidden = false;
    dialog.querySelector('.promotion-choice').focus();
}

/**
 * Closes the chooser and reports the result.
 * @param {string|null} type - The chosen piece type, or null to cancel.
 */
function closePromotionChooser(type) {
    if (!promotionRequest) return;
    const request = promotionRequest;
    promotionRequest = null;
    getPromotionDialog().hidden = true;
    if (request.returnFocus && typeof request.returnFocus.focus === 'function') {
        request.returnFocus.focus();
    }
    if (type) request.onChoose(type);
    else if (request.onCancel) request.onCancel();
}

/** @returns {boolean} True while the chooser is waiting for an answer. */
function isPromotionChooserOpen() {
    return promotionRequest !== null;
}

if (typeof window !== 'undefined') {
    window.showPromotionChooser = showPromotionChooser;
    window.closePromotionChooser = closePromotionChooser;
    window.isPromotionChooserOpen = isPromotionChooserOpen;
}

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showPromotionChooser, closePromotionChooser, isPromotionChooserOpen };
}
