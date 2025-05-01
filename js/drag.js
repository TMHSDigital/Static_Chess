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
    currentPos: { x: 0, y: 0 }
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
    
    // Check if it's a valid piece to move (correct color for current turn)
    // This validation will be handled by the game logic
    
    // Set up drag state
    dragState.isDragging = true;
    dragState.piece = target;
    dragState.element = target;
    dragState.startSquare = { row, col };
    
    // Get start position
    const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX;
    const clientY = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY;
    
    dragState.startPos = { x: clientX, y: clientY };
    dragState.currentPos = { x: clientX, y: clientY };
    
    // Add dragging class for styling
    target.classList.add('dragging');
    
    // Highlight possible moves for this piece
    // Call into game.js to get valid moves
    // TODO: Implement this when integrating with game logic
    
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
    
    // Calculate the difference from start position
    const deltaX = dragState.currentPos.x - dragState.startPos.x;
    const deltaY = dragState.currentPos.y - dragState.startPos.y;
    
    // Update the position of the dragged element
    dragState.element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
}

/**
 * Handle the end of a drag operation.
 * @param {MouseEvent|TouchEvent} event - The mouse or touch event.
 */
function handleDragEnd(event) {
    if (!CONFIG.FEATURES.DRAG_AND_DROP || !dragState.isDragging) return;
    
    // Reset transform
    dragState.element.style.transform = '';
    
    // Remove dragging class
    dragState.element.classList.remove('dragging');
    
    // Find the square element under the current position
    // This needs a more robust implementation based on board coordinates
    
    // For now, we'll use a simple example of finding the element at the position
    const elementsAtPoint = document.elementsFromPoint(
        dragState.currentPos.x, 
        dragState.currentPos.y
    );
    
    // Find the first square element in the elements at point
    const targetSquare = elementsAtPoint.find(el => el.classList.contains('square'));
    
    if (targetSquare) {
        const row = parseInt(targetSquare.dataset.row, 10);
        const col = parseInt(targetSquare.dataset.col, 10);
        
        debugLog('Dropped at square', row, col);
        
        // Call into game.js to try to make the move
        // handleSquareClickCallback(dragState.startSquare.row, dragState.startSquare.col);
        // handleSquareClickCallback(row, col);
        
        // TODO: Implement when integrating with game logic
    }
    
    // Reset drag state
    dragState.isDragging = false;
    dragState.piece = null;
    dragState.element = null;
}

// Export the initialization function
if (typeof window !== 'undefined') {
    window.initDragAndDrop = initDragAndDrop;
} 