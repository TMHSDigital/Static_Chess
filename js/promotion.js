/**
 * @fileoverview Pawn promotion UI for Static Chess
 * Displays a modal dialog allowing players to choose a piece for pawn promotion.
 */

let promotionCallback = null;
let promotionState = {
    isActive: false,
    color: null,
    position: { row: 0, col: 0 }
};

/**
 * Initialize the promotion UI.
 * Creates the modal dialog if it doesn't exist yet.
 */
function initPromotionUI() {
    if (!CONFIG.FEATURES.PROMOTION_UI) return;
    
    debugLog('Initializing promotion UI');
    
    // Create modal if it doesn't exist
    if (!document.getElementById('promotion-modal')) {
        createPromotionModal();
    }
}

/**
 * Create the modal dialog for piece selection.
 * @private
 */
function createPromotionModal() {
    // Create the modal container
    const modal = document.createElement('div');
    modal.id = 'promotion-modal';
    modal.className = 'promotion-modal';
    modal.style.display = 'none';
    
    // Create the modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'promotion-modal-content';
    
    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Promote Pawn';
    modalContent.appendChild(title);
    
    // Add piece selection container
    const pieceContainer = document.createElement('div');
    pieceContainer.className = 'promotion-pieces';
    
    // The pieces to choose from
    const pieces = ['q', 'r', 'b', 'n'];
    
    // Create piece selection buttons
    pieces.forEach(piece => {
        const pieceButton = document.createElement('div');
        pieceButton.className = 'promotion-piece';
        pieceButton.dataset.piece = piece;
        
        // We'll set the background image dynamically based on the color
        pieceButton.addEventListener('click', () => {
            selectPromotionPiece(piece);
        });
        
        pieceContainer.appendChild(pieceButton);
    });
    
    modalContent.appendChild(pieceContainer);
    modal.appendChild(modalContent);
    
    // Add to the document
    document.body.appendChild(modal);
    
    // Add CSS if not already added
    addPromotionStyles();
}

/**
 * Add the necessary CSS styles for the promotion modal.
 * @private
 */
function addPromotionStyles() {
    // Check if styles already exist
    if (document.getElementById('promotion-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'promotion-styles';
    
    style.textContent = `
        .promotion-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .promotion-modal-content {
            background-color: var(--panel-bg);
            padding: 20px;
            border-radius: var(--border-radius);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        
        .promotion-modal-content h3 {
            color: var(--text-color);
            margin-top: 0;
            margin-bottom: 15px;
        }
        
        .promotion-pieces {
            display: flex;
            justify-content: center;
            gap: 15px;
        }
        
        .promotion-piece {
            width: 60px;
            height: 60px;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            cursor: pointer;
            border: 2px solid transparent;
            border-radius: 5px;
            transition: all 0.2s ease;
        }
        
        .promotion-piece:hover {
            transform: scale(1.1);
            border-color: var(--accent-color);
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
        }
    `;
    
    document.head.appendChild(style);
}

/**
 * Show the promotion modal and wait for the player's choice.
 * @param {string} color - The color of the pawn being promoted ('w' or 'b').
 * @param {number} row - The row of the pawn.
 * @param {number} col - The column of the pawn.
 * @returns {Promise<string>} A promise that resolves to the selected piece type.
 */
function showPromotionModal(color, row, col) {
    if (!CONFIG.FEATURES.PROMOTION_UI) {
        // If the UI feature is disabled, default to queen promotion
        return Promise.resolve('q');
    }
    
    // Ensure the modal exists
    if (!document.getElementById('promotion-modal')) {
        createPromotionModal();
    }
    
    // Set promotion state
    promotionState.isActive = true;
    promotionState.color = color;
    promotionState.position = { row, col };
    
    // Get the modal
    const modal = document.getElementById('promotion-modal');
    modal.style.display = 'flex';
    
    // Set the images for the pieces based on color
    const pieceButtons = document.querySelectorAll('.promotion-piece');
    pieceButtons.forEach(button => {
        const piece = button.dataset.piece;
        const cacheBuster = Date.now();
        button.style.backgroundImage = `url('assets/${color}${piece}.svg?v=${cacheBuster}')`;
    });
    
    // Return a promise that will resolve when a piece is selected
    return new Promise(resolve => {
        promotionCallback = resolve;
    });
}

/**
 * Handle the selection of a promotion piece.
 * @param {string} pieceType - The type of piece selected.
 * @private
 */
function selectPromotionPiece(pieceType) {
    if (!promotionState.isActive || !promotionCallback) return;
    
    // Hide the modal
    const modal = document.getElementById('promotion-modal');
    modal.style.display = 'none';
    
    // Reset the state
    promotionState.isActive = false;
    
    // Resolve the promise with the selected piece
    const callback = promotionCallback;
    promotionCallback = null;
    
    debugLog(`Promotion piece selected: ${pieceType}`);
    callback(pieceType);
}

// Export functions
if (typeof window !== 'undefined') {
    window.initPromotionUI = initPromotionUI;
    window.showPromotionModal = showPromotionModal;
} 