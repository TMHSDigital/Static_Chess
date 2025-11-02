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
    offset: { x: 0, y: 0 }
};

/**
 * Initialize drag and drop functionality for chess pieces.
 * Called from main.js when the feature is enabled.
 */
function initDragAndDrop() {
    if (!CONFIG.FEATURES.DRAG_AND_DROP) return;
    
    debugLog('Initializing drag and drop functionality');
    
    // Add the drag event listeners to the chess board
    const boardElement = document.getElementById('chess-board');
    
    // Mouse events
    boardElement.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    
    // Touch events for mobile
    boardElement.addEventListener('touchstart', handleDragStart);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('touchend', handleDragEnd);
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
    
    // Only start drag on pieces
    if (!target.classList.contains('piece')) return;
    
    // Get the square element that contains the piece
    const squareElement = target.closest('.square');
    if (!squareElement) return;
    
    // Get row and column from the square
    const row = parseInt(squareElement.dataset.row, 10);
    const col = parseInt(squareElement.dataset.col, 10);
    
    // Select the piece first (this highlights possible moves)
    if (typeof window.handleBoardClick === 'function') {
        window.handleBoardClick(row, col);
    }
    
    // Get start position
    const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX;
    const clientY = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY;
    
    // Get bounding rect for initial positioning (before adding dragging class)
    const rect = target.getBoundingClientRect();
    const offsetX = clientX - rect.left - rect.width / 2;
    const offsetY = clientY - rect.top - rect.height / 2;
    
    // Set up drag state
    dragState.isDragging = true;
    dragState.piece = target;
    dragState.element = target;
    dragState.startSquare = { row, col };
    dragState.startPos = { x: clientX, y: clientY };
    dragState.currentPos = { x: clientX, y: clientY };
    dragState.offset = { x: offsetX, y: offsetY };
    
    // Add dragging class for styling and set initial position
    target.classList.add('dragging');
    target.style.left = `${rect.left}px`;
    target.style.top = `${rect.top}px`;
    
    // Prevent click event from firing (we're handling via drag)
    event.stopPropagation();
    
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
    dragState.element.classList.remove('dragging');
    
    // Find the square element under the drop position
    const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
    
    // Find the first square element in the elements at point
    const targetSquare = elementsAtPoint.find(el => el.classList.contains('square'));
    
    if (targetSquare) {
        const row = parseInt(targetSquare.dataset.row, 10);
        const col = parseInt(targetSquare.dataset.col, 10);
        
        debugLog('Dropped at square', row, col);
        
        // Make the move (piece is already selected from drag start)
        if (typeof window.handleBoardClick === 'function') {
            window.handleBoardClick(row, col);
        }
    } else {
        // Dropped outside board - cancel selection
        if (typeof window.clearSelectedSquare === 'function') {
            window.clearSelectedSquare();
        }
        if (typeof window.clearPossibleMoves === 'function') {
            window.clearPossibleMoves();
        }
    }
    
    // Prevent click event from firing (we handled it via drag)
    event.stopPropagation();
    
    // Reset drag state
    dragState.isDragging = false;
    dragState.piece = null;
    dragState.element = null;
}

// Export the initialization function
if (typeof window !== 'undefined') {
    window.initDragAndDrop = initDragAndDrop;
} 