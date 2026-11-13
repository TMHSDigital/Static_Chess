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
    if (event.type === 'mousedown' && event.button !== 0) return; // Left button only

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
    
    // Get start position
    const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX;
    const clientY = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY;

    // Get bounding rect for initial positioning (before adding dragging class)
    const rect = pieceElement.getBoundingClientRect();
    const offsetX = clientX - rect.left - rect.width / 2;
    const offsetY = clientY - rect.top - rect.height / 2;

    // Arm a potential drag. Nothing is selected or styled yet: a press that never
    // moves is a plain click or tap, and the board's click handler owns that.
    dragState.isDragging = true;
    dragState.piece = pieceElement;
    dragState.element = pieceElement;
    dragState.startSquare = { row, col };
    dragState.startPos = { x: clientX, y: clientY };
    dragState.currentPos = { x: clientX, y: clientY };
    dragState.offset = { x: offsetX, y: offsetY };
    dragState.rect = rect;
    dragState.hasMoved = false;
    dragJustEnded = false;

    // Stop the browser starting a text selection on mouse press. This does not
    // suppress the click event. Touch is left alone so a tap still produces a click.
    if (event.type === 'mousedown') {
        event.preventDefault();
    }
}

/**
 * Turn an armed press into a real drag: select the piece, show its moves and lift it.
 */
function beginDrag() {
    const { row, col } = dragState.startSquare;
    const pieceElement = dragState.element;
    const rect = dragState.rect;

    window.setSelectedSquare(row, col);
    window.setPossibleMoves(window.generateLegalMovesForPiece(row, col));
    window.updateBoardVisuals(window.boardState, window.findKingInCheck(window.currentPlayer));

    // Add dragging class for styling and set initial position
    pieceElement.classList.add('dragging');
    // Store original size to maintain during drag (fixed positioning can lose relative sizing)
    pieceElement.style.width = `${rect.width}px`;
    pieceElement.style.height = `${rect.height}px`;
    pieceElement.style.left = `${rect.left}px`;
    pieceElement.style.top = `${rect.top}px`;

    dragState.hasMoved = true;
    debugLog('Started dragging piece at', row, col);
}

/**
 * Handle the movement during a drag operation.
 * @param {MouseEvent|TouchEvent} event - The mouse or touch event.
 */
function handleDragMove(event) {
    if (!CONFIG.FEATURES.DRAG_AND_DROP || !dragState.isDragging) return;
    
    // Prevent default behavior for touch events (stops the page scrolling mid-drag)
    if (event.type === 'touchmove' && event.cancelable) {
        event.preventDefault();
    }

    // Get current position
    const clientX = event.type === 'touchmove' ? event.touches[0].clientX : event.clientX;
    const clientY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY;

    dragState.currentPos = { x: clientX, y: clientY };

    // The drag only starts once the pointer has moved significantly (more than 5px)
    if (!dragState.hasMoved) {
        const deltaX = Math.abs(clientX - dragState.startPos.x);
        const deltaY = Math.abs(clientY - dragState.startPos.y);
        if (deltaX <= 5 && deltaY <= 5) return;
        beginDrag();
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

    // A press that never became a drag is a click or tap: leave it to the click handler
    if (!dragState.hasMoved) {
        dragState.isDragging = false;
        dragState.piece = null;
        dragState.element = null;
        return;
    }

    // Get drop position (use currentPos if event coordinates aren't available)
    const clientX = event.type === 'touchend' 
        ? (event.changedTouches[0]?.clientX || dragState.currentPos.x) 
        : (event.clientX || dragState.currentPos.x);
    const clientY = event.type === 'touchend' 
        ? (event.changedTouches[0]?.clientY || dragState.currentPos.y) 
        : (event.clientY || dragState.currentPos.y);
    
    // Store drag state before resetting
    const wasDrag = dragState.hasMoved;
    const startSquare = dragState.startSquare;
    const dragElement = dragState.element;
    
    // Temporarily hide the dragged piece to find the square underneath
    const originalDisplay = dragElement.style.display;
    dragElement.style.display = 'none';
    
    // Find the square element under the drop position
    let targetSquare = null;
    if (wasDrag) {
        const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
        // Find the first square element (the piece is hidden so it won't interfere)
        targetSquare = elementsAtPoint.find(el => el.classList.contains('square'));
    }
    
    // Restore display and reset styles
    dragElement.style.display = originalDisplay;
    dragElement.style.left = '';
    dragElement.style.top = '';
    dragElement.style.width = '';
    dragElement.style.height = '';
    dragElement.classList.remove('dragging');
    
    // Process drop if it was a drag (not just a click)
    if (wasDrag && targetSquare) {
        const endRow = parseInt(targetSquare.dataset.row, 10);
        const endCol = parseInt(targetSquare.dataset.col, 10);
        
        debugLog('Dropped at square', endRow, endCol);
        
        // Check if the drop square is a valid move (piece is already selected from drag start)
        if (typeof window.selectedSquare !== 'undefined' && 
            typeof window.possibleMoves !== 'undefined' &&
            typeof window.makeMove === 'function') {
            
            // Verify the piece is still selected and this is a valid move
            const isPossible = window.possibleMoves.some(pm => pm.row === endRow && pm.col === endCol);
            
            if (isPossible && window.selectedSquare && 
                window.selectedSquare.row === startSquare.row &&
                window.selectedSquare.col === startSquare.col) {
                // Make the move directly
                window.makeMove(
                    startSquare.row, 
                    startSquare.col, 
                    endRow, 
                    endCol
                );
            } else {
                debugLog('Invalid drop: not a possible move or selection changed', {
                    isPossible,
                    selectedSquare: window.selectedSquare,
                    startSquare: startSquare,
                    possibleMoves: window.possibleMoves
                });
            }
        } else {
            debugLog('Required functions not available for drop');
        }
    }

    // A drag always ends with nothing selected, whether or not it made a move
    window.clearSelectedSquare();
    window.clearPossibleMoves();
    window.updateBoardVisuals(window.boardState, window.findKingInCheck(window.currentPlayer));

    // Swallow the click the browser may fire after the drag
    dragJustEnded = true;
    setTimeout(() => { dragJustEnded = false; }, 100);
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();

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

// Export for Node/Jest tests (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDragAndDrop, handleDragStart, handleDragMove, handleDragEnd };
}
