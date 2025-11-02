/**
 * @fileoverview Drag and drop functionality for chess pieces.
 * This file manages the dragging interaction for chess pieces.
 */

// Drag state tracking
let dragState = {
    isDragging: false,
    piece: null,
    element: null,
    startPos: { x: 0, y: 0 },
    startSquare: { row: 0, col: 0 },
    currentPos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    hasMoved: false // Track if mouse actually moved during drag
};

// Flag to prevent click events after drag
let dragJustEnded = false;

// Expose flag globally for game.js to check
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'dragJustEnded', {
        get: function() { return dragJustEnded; },
        set: function(value) { dragJustEnded = value; }
    });
}

/**
 * Initialize drag and drop functionality for chess pieces.
 * Called from main.js when the feature is enabled.
 */
function initDragAndDrop() {
    if (!CONFIG.FEATURES.DRAG_AND_DROP) {
        debugLog('Drag and drop is disabled in config');
        return;
    }
    
    debugLog('Initializing drag and drop functionality');
    
    // Add the drag event listeners to the chess board
    const boardElement = document.getElementById('chess-board');
    
    if (!boardElement) {
        console.error('Chess board element not found! Drag and drop cannot be initialized.');
        return;
    }
    
    // Mouse events - use capture phase to handle before click
    boardElement.addEventListener('mousedown', handleDragStart, true);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd, true);
    
    // Touch events for mobile
    boardElement.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    
    debugLog('Drag and drop event listeners attached');
}

/**
 * Handle the start of a drag operation.
 * @param {MouseEvent|TouchEvent} event - The mouse or touch event.
 */
function handleDragStart(event) {
    if (!CONFIG.FEATURES.DRAG_AND_DROP) return;
    
    // Prevent default behavior for touch events
    if (event.type === 'touchstart') {
        event.preventDefault();
    }
    
    const target = event.target;
    
    // Find the piece element (could be the target itself or a parent)
    const pieceElement = target.classList.contains('piece') 
        ? target 
        : target.closest('.piece');
    
    if (!pieceElement) {
        return; // Not clicking on a piece
    }
    
    // Get the square element that contains the piece
    const squareElement = pieceElement.closest('.square');
    if (!squareElement) {
        debugLog('Could not find square element for piece');
        return;
    }
    
    // Get row and column from the square
    const row = parseInt(squareElement.dataset.row, 10);
    const col = parseInt(squareElement.dataset.col, 10);
    
    // Check if this piece belongs to the current player
    if (typeof window.boardState !== 'undefined' && typeof window.currentPlayer !== 'undefined') {
        const piece = window.boardState[row][col];
        if (!piece || piece.color !== window.currentPlayer) {
            return; // Can't drag opponent's pieces
        }
    }
    
    // Select the piece and show possible moves before starting drag
    if (typeof window.setSelectedSquare === 'function' && 
        typeof window.generateLegalMovesForPiece === 'function' &&
        typeof window.setPossibleMoves === 'function' &&
        typeof window.updateBoardVisuals === 'function' &&
        typeof window.findKingInCheck === 'function' &&
        typeof window.currentPlayer !== 'undefined') {
        window.setSelectedSquare(row, col);
        const moves = window.generateLegalMovesForPiece(row, col);
        window.setPossibleMoves(moves);
        window.updateBoardVisuals(window.boardState, window.findKingInCheck(window.currentPlayer));
    }
    
    // Get start position
    const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX;
    const clientY = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY;
    
    // Get bounding rect for initial positioning (before adding dragging class)
    const rect = pieceElement.getBoundingClientRect();
    const offsetX = clientX - rect.left - rect.width / 2;
    const offsetY = clientY - rect.top - rect.height / 2;
    
    // Set up drag state
    dragState.isDragging = true;
    dragState.piece = pieceElement;
    dragState.element = pieceElement;
    dragState.startSquare = { row, col };
    dragState.startPos = { x: clientX, y: clientY };
    dragState.currentPos = { x: clientX, y: clientY };
    dragState.offset = { x: offsetX, y: offsetY };
    dragState.hasMoved = false;
    dragJustEnded = false;
    
    // Add dragging class for styling and set initial position
    pieceElement.classList.add('dragging');
    // Store original size to maintain during drag (fixed positioning can lose relative sizing)
    pieceElement.style.width = `${rect.width}px`;
    pieceElement.style.height = `${rect.height}px`;
    pieceElement.style.left = `${rect.left}px`;
    pieceElement.style.top = `${rect.top}px`;
    
    // Prevent click event from firing (we're handling via drag)
    event.stopPropagation();
    event.preventDefault();
    
    debugLog('Started dragging piece at', row, col);
}

/**
 * Handle the movement during a drag operation.
 * @param {MouseEvent|TouchEvent} event - The mouse or touch event.
 */
function handleDragMove(event) {
    if (!CONFIG.FEATURES.DRAG_AND_DROP || !dragState.isDragging) return;
    
    // Prevent default behavior for touch events
    if (event.type === 'touchmove') {
        event.preventDefault();
    }
    
    // Get current position
    const clientX = event.type === 'touchmove' ? event.touches[0].clientX : event.clientX;
    const clientY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY;
    
    dragState.currentPos = { x: clientX, y: clientY };
    
    // Check if mouse has moved significantly (more than 5px)
    const deltaX = Math.abs(clientX - dragState.startPos.x);
    const deltaY = Math.abs(clientY - dragState.startPos.y);
    if (deltaX > 5 || deltaY > 5) {
        dragState.hasMoved = true;
    }
    
    // Update the position of the dragged element (using fixed positioning with stored offset)
    dragState.element.style.left = `${clientX - dragState.offset.x}px`;
    dragState.element.style.top = `${clientY - dragState.offset.y}px`;
}

/**
 * Handle the end of a drag operation.
 * @param {MouseEvent|TouchEvent} event - The mouse or touch event.
 */
function handleDragEnd(event) {
    if (!CONFIG.FEATURES.DRAG_AND_DROP || !dragState.isDragging) return;
    
    // Get drop position
    const clientX = event.type === 'touchend' ? (event.changedTouches[0]?.clientX || dragState.currentPos.x) : event.clientX;
    const clientY = event.type === 'touchend' ? (event.changedTouches[0]?.clientY || dragState.currentPos.y) : event.clientY;
    
    // Reset position and remove dragging class
    dragState.element.style.left = '';
    dragState.element.style.top = '';
    dragState.element.style.width = '';
    dragState.element.style.height = '';
    dragState.element.classList.remove('dragging');
    
    // Only process drop if mouse actually moved (was a drag, not just a click)
    if (dragState.hasMoved) {
        // Find the square element under the drop position
        const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
        
        // Find the first square element in the elements at point
        const targetSquare = elementsAtPoint.find(el => el.classList.contains('square'));
        
        if (targetSquare) {
            const endRow = parseInt(targetSquare.dataset.row, 10);
            const endCol = parseInt(targetSquare.dataset.col, 10);
            
            debugLog('Dropped at square', endRow, endCol);
            
            // Select the piece first, then make the move
            if (typeof window.handleBoardClick === 'function') {
                // Select the starting square
                window.handleBoardClick(dragState.startSquare.row, dragState.startSquare.col);
                // Make the move to the destination
                window.handleBoardClick(endRow, endCol);
            }
        } else {
            // Dropped outside board - ensure no selection
            if (typeof window.clearSelectedSquare === 'function') {
                window.clearSelectedSquare();
            }
            if (typeof window.clearPossibleMoves === 'function') {
                window.clearPossibleMoves();
            }
        }
        
        // Set flag to prevent click event
        dragJustEnded = true;
        setTimeout(() => { dragJustEnded = false; }, 100);
    } else {
        // Was just a click, not a drag - let the click handler deal with it
        // Clear any temporary state but don't interfere with click
    }
    
    // Prevent click event from firing
    event.stopPropagation();
    event.preventDefault();
    
    // Reset drag state
    dragState.isDragging = false;
    dragState.piece = null;
    dragState.element = null;
    dragState.hasMoved = false;
}

// Export the initialization function
if (typeof window !== 'undefined') {
    window.initDragAndDrop = initDragAndDrop;
} 